import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';

async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const { project_id, search } = req.query;
      
      let whereClause = "WHERE u.role = 'aluno'";
      let queryParams = [];
      let paramCount = 0;

      // Se project_id for fornecido, excluir alunos que já estão no projeto
      if (project_id) {
        paramCount++;
        whereClause += ` AND u.id NOT IN (
          SELECT student_id FROM project_students WHERE project_id = $${paramCount}
        )`;
        queryParams.push(project_id);
      }

      // Se search for fornecido, filtrar por nome ou email
      if (search) {
        paramCount++;
        whereClause += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
        queryParams.push(`%${search}%`);
      }

      // Buscar alunos disponíveis
      const result = await query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.siape,
          u.created_at
        FROM users u
        ${whereClause}
        ORDER BY u.name
        LIMIT 5
      `, queryParams);

      return res.status(200).json({
        success: true,
        students: result.rows
      });

    } catch (error) {
      console.error('Erro ao buscar alunos disponíveis:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Professores podem acessar alunos disponíveis
export default requireRole(['professor', 'servidor', 'admin'])(handler);
