import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';

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
      const student_id = req.user.id;

      // Buscar todos os projetos com informações do professor e status da solicitação do aluno
      const result = await query(`
        SELECT 
          p.id,
          p.name,
          p.type,
          p.description,
          p.created_at,
          prof.name as professor_name,
          prof.email as professor_email,
          COUNT(ps.student_id) as current_students,
          pr.status as request_status,
          pr.created_at as request_created_at,
          pr.message as request_message
        FROM projects p
        JOIN users prof ON p.professor_id = prof.id
        LEFT JOIN project_students ps ON p.id = ps.project_id
        LEFT JOIN project_requests pr ON p.id = pr.project_id AND pr.student_id = $1
        GROUP BY p.id, p.name, p.type, p.description, p.created_at, prof.name, prof.email, pr.status, pr.created_at, pr.message
        ORDER BY p.created_at DESC
      `, [student_id]);

      // Processar resultados para incluir informações sobre participação
      const projects = await Promise.all(result.rows.map(async (project) => {
        const isParticipant = await isStudentInProject(project.id, student_id);
        return {
          ...project,
          is_participant: isParticipant,
          can_request: !project.request_status || project.request_status === 'rejected'
        };
      }));

      return res.status(200).json({
        success: true,
        projects: projects
      });

    } catch (error) {
      console.error('Erro ao buscar projetos disponíveis:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Função auxiliar para verificar se o aluno está no projeto
async function isStudentInProject(projectId, studentId) {
  try {
    const result = await query(
      'SELECT id FROM project_students WHERE project_id = $1 AND student_id = $2',
      [projectId, studentId]
    );
    return result.rows.length > 0;
  } catch (error) {
    return false;
  }
}

// Temporariamente removendo requireRole para testar
export default authMiddleware(handler);
