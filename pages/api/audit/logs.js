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
      const { 
        page = 1, 
        limit = 50, 
        table_name, 
        action, 
        user_id, 
        start_date, 
        end_date 
      } = req.query;

      const offset = (page - 1) * limit;
      
      // Construir query com filtros
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      if (table_name) {
        whereConditions.push(`table_name = $${paramIndex}`);
        params.push(table_name);
        paramIndex++;
      }

      if (action) {
        whereConditions.push(`action = $${paramIndex}`);
        params.push(action);
        paramIndex++;
      }

      if (user_id) {
        whereConditions.push(`user_id = $${paramIndex}`);
        params.push(parseInt(user_id));
        paramIndex++;
      }

      if (start_date) {
        whereConditions.push(`timestamp >= $${paramIndex}`);
        params.push(start_date);
        paramIndex++;
      }

      if (end_date) {
        whereConditions.push(`timestamp <= $${paramIndex}`);
        params.push(end_date);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Query para buscar logs
      const logsQuery = `
        SELECT 
          id,
          table_name,
          record_id,
          action,
          old_values,
          new_values,
          user_id,
          user_email,
          user_name,
          user_role,
          ip_address,
          user_agent,
          timestamp
        FROM audit_logs 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(parseInt(limit), offset);

      // Query para contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM audit_logs 
        ${whereClause}
      `;

      const countParams = params.slice(0, -2); // Remove limit e offset

      const [logsResult, countResult] = await Promise.all([
        query(logsQuery, params),
        query(countQuery, countParams)
      ]);

      const logs = logsResult.rows;
      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      return res.status(200).json({
        success: true,
        data: {
          logs,
          pagination: {
            current_page: parseInt(page),
            total_pages: totalPages,
            total_records: total,
            limit: parseInt(limit),
            has_next: page < totalPages,
            has_prev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Erro ao buscar logs de auditoria:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Apenas admins podem acessar logs
export default requireRole(['admin'])(handler);
