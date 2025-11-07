import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';
import { withAuditLog } from '../../../lib/auditLog.js';

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
      // Buscar usuários pendentes de aprovação
      const result = await query(`
        SELECT 
          id, 
          name, 
          email, 
          siape, 
          matricula_sigaa,
          role, 
          status, 
          created_at
        FROM users 
        WHERE status = 'pending'
        ORDER BY created_at ASC
      `);

      return res.status(200).json({
        success: true,
        users: result.rows
      });

    } catch (error) {
      console.error('Erro ao buscar usuários pendentes:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Apenas administradores podem acessar
export default requireRole(['admin'])(withAuditLog('users')(handler));
