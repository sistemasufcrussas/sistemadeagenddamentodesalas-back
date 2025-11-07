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
      const userRole = req.user.role;
      let result;

      if (userRole === 'admin') {
        // Admin recebe: reservas aprovadas pelo professor OU pendentes de projetos sem professor responsável
        result = await query(`
          SELECT 
            r.id,
            r.title,
            r.description,
            r.start_time,
            r.end_time,
            r.status,
            r.created_at,
            r.room_id,
            r.project_id,
            r.people_count,
            u.name as student_name,
            u.email as student_email,
            u.matricula_sigaa as student_matricula,
            rm.name as room_name,
            rm.location as room_location,
            rm.capacity as room_capacity,
            p.name as project_name,
            p.type as project_type
          FROM reservations r
          JOIN users u ON r.user_id = u.id
          JOIN rooms rm ON r.room_id = rm.id
          LEFT JOIN projects p ON r.project_id = p.id
          LEFT JOIN users up ON p.professor_id = up.id
          WHERE (r.status = 'professor_approved'
             OR (
               r.status = 'pending' AND (
                 p.professor_id IS NULL OR (up.role = 'admin')
               )
             ))
             AND (r.is_active IS NULL OR r.is_active = true)
          ORDER BY r.created_at DESC
        `);
      } else {
        // Professor recebe reservas pendentes dos projetos que coordena
        result = await query(`
          SELECT 
            r.id,
            r.title,
            r.description,
            r.start_time,
            r.end_time,
            r.status,
            r.created_at,
            r.room_id,
            r.project_id,
            r.people_count,
            u.name as student_name,
            u.email as student_email,
            u.matricula_sigaa as student_matricula,
            rm.name as room_name,
            rm.location as room_location,
            rm.capacity as room_capacity,
            p.name as project_name,
            p.type as project_type
          FROM reservations r
          JOIN users u ON r.user_id = u.id
          JOIN rooms rm ON r.room_id = rm.id
          LEFT JOIN projects p ON r.project_id = p.id
          WHERE r.status = 'pending' 
            AND r.project_id IN (
              SELECT id FROM projects WHERE professor_id = $1
            )
            AND (r.is_active IS NULL OR r.is_active = true)
          ORDER BY r.created_at DESC
        `, [req.user.id]);
      }

      return res.status(200).json({
        success: true,
        reservations: result.rows,
        count: result.rows.length
      });

    } catch (error) {
      console.error('Erro ao buscar notificações de reservas:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Apenas admins podem acessar
export default requireRole(['admin', 'professor', 'servidor'])(authMiddleware(handler));
