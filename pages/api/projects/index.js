import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';
import { withAuditLog, logCreate, logUpdate, logDelete } from '../../../lib/auditLog.js';

async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const { professor_id } = req.query;
      
      // Normalizar role para comparação
      const userRole = req.user?.role?.toLowerCase()?.trim();
      
      let whereClause = '';
      let queryParams = [];
      
      // Professores e servidores só podem ver seus próprios projetos
      // Ignorar professor_id da query se for professor ou servidor (sempre usar req.user.id)
      if (userRole === 'professor' || userRole === 'servidor') {
        whereClause = 'WHERE p.professor_id = $1';
        queryParams = [req.user.id];
      } else if (userRole === 'admin' && professor_id) {
        // Admins podem buscar por qualquer professor_id
        whereClause = 'WHERE p.professor_id = $1';
        queryParams = [professor_id];
      } else if (userRole === 'admin') {
        // Admins sem professor_id veem todos os projetos
        whereClause = '';
        queryParams = [];
      }

      // Buscar projetos com informações do professor
      const result = await query(`
        SELECT 
          p.*,
          u.name as professor_name,
          u.email as professor_email,
          COUNT(ps.student_id) as student_count
        FROM projects p
        LEFT JOIN users u ON p.professor_id = u.id
        LEFT JOIN project_students ps ON p.id = ps.project_id
        ${whereClause}
        GROUP BY p.id, u.name, u.email
        ORDER BY p.created_at DESC
      `, queryParams);

      return res.status(200).json({
        success: true,
        projects: result.rows
      });

    } catch (error) {
      console.error('Erro ao buscar projetos:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else if (req.method === 'POST') {
    // Professores, servidores e admins podem criar projetos
    const userRole = req.user.role?.toLowerCase()?.trim();
    if (!['professor', 'servidor', 'admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Apenas professores, servidores e administradores podem criar projetos' });
    }

    try {
      const { name, type } = req.body;

      // Validar dados obrigatórios
      if (!name || !type) {
        return res.status(400).json({ 
          error: 'Nome e tipo do projeto são obrigatórios' 
        });
      }

      // Inserir novo projeto
      const result = await query(`
        INSERT INTO projects (name, type, professor_id) 
        VALUES ($1, $2, $3) 
        RETURNING *
      `, [name, type, req.user.id]);

      const newProject = result.rows[0];

      // Registrar log de auditoria
      await logCreate(req, 'projects', newProject.id, {
        name: newProject.name,
        type: newProject.type,
        professor_id: newProject.professor_id,
        created_at: newProject.created_at
      });

      return res.status(201).json({
        success: true,
        message: 'Projeto criado com sucesso',
        project: newProject
      });

    } catch (error) {
      console.error('Erro ao criar projeto:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Professores podem acessar projetos
export default requireRole(['professor', 'servidor', 'admin'])(withAuditLog('projects')(handler));
