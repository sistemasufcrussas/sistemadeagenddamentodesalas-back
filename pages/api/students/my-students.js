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
      const { search, unassigned_only } = req.query;
      
      let whereClause = "WHERE u.role = 'aluno' AND u.created_by = $1";
      let queryParams = [req.user.id];
      let paramCount = 1;

      // Se unassigned_only for true, filtrar apenas alunos sem projeto
      if (unassigned_only === 'true') {
        paramCount++;
        whereClause += ` AND u.id NOT IN (
          SELECT student_id FROM project_students
        )`;
      }

      // Se search for fornecido, filtrar por nome ou email
      if (search) {
        paramCount++;
        whereClause += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
        queryParams.push(`%${search}%`);
      }

      // Buscar alunos do professor
      const result = await query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.matricula_sigaa,
          u.created_at,
          u.created_by,
          creator.name as created_by_name
        FROM users u
        LEFT JOIN users creator ON u.created_by = creator.id
        ${whereClause}
        ORDER BY u.name
        LIMIT 100
      `, queryParams);

      return res.status(200).json({
        success: true,
        students: result.rows
      });

    } catch (error) {
      console.error('Erro ao buscar alunos do professor:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Apenas professores podem acessar
export default requireRole(['professor', 'servidor', 'admin'])(handler);
