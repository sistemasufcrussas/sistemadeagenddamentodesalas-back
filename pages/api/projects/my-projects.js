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
      const student_id = req.user.id;

      // Buscar projetos que o aluno está participando
      const result = await query(`
        SELECT 
          p.id,
          p.name,
          p.type,
          p.description,
          p.created_at,
          prof.name as professor_name,
          prof.email as professor_email,
          ps.joined_at
        FROM projects p
        JOIN project_students ps ON p.id = ps.project_id
        JOIN users prof ON p.professor_id = prof.id
        WHERE ps.student_id = $1
        ORDER BY ps.joined_at DESC
      `, [student_id]);

      return res.status(200).json({
        success: true,
        projects: result.rows
      });

    } catch (error) {
      console.error('Erro ao buscar projetos do aluno:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Apenas alunos podem acessar seus projetos
export default authMiddleware(requireRole(['aluno'])(handler));
