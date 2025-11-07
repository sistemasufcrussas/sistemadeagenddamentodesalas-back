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
      // Buscar reservas pendentes (pending e professor_approved)
      const result = await query(`
        SELECT 
          r.*,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role,
          u.matricula_sigaa as user_matricula,
          rm.name as room_name,
          rm.location as room_location,
          rm.capacity as room_capacity,
          rm.has_projector,
          rm.has_internet,
          rm.has_air_conditioning,
          rm.description as room_description,
          p.name as project_name,
          p.type as project_type,
          p.description as project_description,
          up.name as project_professor_name,
          up.email as project_professor_email,
          prof.name as professor_name,
          prof.email as professor_email,
          approver.name as approved_by_name,
          approver.email as approved_by_email
        FROM reservations r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN rooms rm ON r.room_id = rm.id
        LEFT JOIN projects p ON r.project_id = p.id
        LEFT JOIN users up ON p.professor_id = up.id
        LEFT JOIN users prof ON r.professor_approved_by = prof.id
        LEFT JOIN users approver ON r.approved_by = approver.id
        WHERE r.status IN ('pending', 'professor_approved')
          AND (r.is_active IS NULL OR r.is_active = true)
        ORDER BY 
          CASE 
            WHEN r.status = 'professor_approved' THEN 1
            WHEN r.status = 'pending' THEN 2
          END,
          r.created_at ASC
      `);

      return res.status(200).json({
        success: true,
        pending_reservations: result.rows
      });

    } catch (error) {
      console.error('Erro ao buscar reservas pendentes:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Professores podem ver reservas pendentes (para visualização)
export default requireRole(['admin', 'professor', 'servidor'])(handler);
