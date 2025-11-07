import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';
import { withAuditLog, logDelete } from '../../../lib/auditLog.js';

async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const projectId = req.query.id;

  if (req.method === 'GET') {
    try {
      // Buscar projeto específico
      const result = await query(`
        SELECT 
          p.*,
          u.name as professor_name,
          u.email as professor_email,
          COUNT(ps.student_id) as student_count
        FROM projects p
        LEFT JOIN users u ON p.professor_id = u.id
        LEFT JOIN project_students ps ON p.id = ps.project_id
        WHERE p.id = $1
        GROUP BY p.id, u.name, u.email
      `, [projectId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Projeto não encontrado' });
      }

      const project = result.rows[0];

      // Verificar se o professor/servidor tem permissão para ver este projeto
      const userRole = req.user.role?.toLowerCase()?.trim();
      if ((userRole === 'professor' || userRole === 'servidor') && project.professor_id !== req.user.id) {
        return res.status(403).json({ error: 'Você não tem permissão para ver este projeto' });
      }

      return res.status(200).json({
        success: true,
        project: project
      });

    } catch (error) {
      console.error('Erro ao buscar projeto:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else if (req.method === 'DELETE') {
    // Professores e servidores podem excluir projetos
    const userRole = req.user.role?.toLowerCase()?.trim();
    if (userRole !== 'professor' && userRole !== 'servidor') {
      return res.status(403).json({ error: 'Apenas professores e servidores podem excluir projetos' });
    }

    try {
      // Verificar se o projeto existe e pertence ao professor
      const projectCheck = await query(
        'SELECT id, name, professor_id FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Projeto não encontrado' });
      }

      const project = projectCheck.rows[0];

      if (project.professor_id !== req.user.id) {
        return res.status(403).json({ error: 'Você não tem permissão para excluir este projeto' });
      }

      // Excluir projeto (cascade irá excluir os relacionamentos com alunos)
      await query('DELETE FROM projects WHERE id = $1', [projectId]);

      // Registrar log de auditoria
      await logDelete(req, 'projects', projectId, {
        name: project.name,
        professor_id: project.professor_id
      });

      return res.status(200).json({
        success: true,
        message: 'Projeto excluído com sucesso'
      });

    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Professores podem acessar projetos
export default requireRole(['professor', 'servidor', 'admin'])(withAuditLog('projects')(handler));
