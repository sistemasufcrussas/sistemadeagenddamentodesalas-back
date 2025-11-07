import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';
import { withAuditLog, logUpdate } from '../../../lib/auditLog.js';

async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { user_id, action } = req.body; // action: 'approve' ou 'reject'

      if (!user_id || !action) {
        return res.status(400).json({ 
          error: 'ID do usuário e ação são obrigatórios' 
        });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ 
          error: 'Ação deve ser "approve" ou "reject"' 
        });
      }

      // Verificar se o usuário existe e está pendente
      const userResult = await query(
        'SELECT id, name, email, status FROM users WHERE id = $1 AND status = $2',
        [user_id, 'pending']
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Usuário não encontrado ou já foi processado' 
        });
      }

      const user = userResult.rows[0];
      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      // Atualizar status do usuário
      await query(
        'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newStatus, user_id]
      );

      // Registrar log de auditoria
      await logUpdate(req, 'users', user_id, {
        status: newStatus,
        updated_at: new Date().toISOString()
      }, {
        status: 'pending'
      });

      const actionText = action === 'approve' ? 'aprovado' : 'rejeitado';

      return res.status(200).json({
        success: true,
        message: `Usuário ${actionText} com sucesso`,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: newStatus
        }
      });

    } catch (error) {
      console.error('Erro ao processar aprovação:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Apenas administradores podem acessar
export default requireRole(['admin'])(withAuditLog('users')(handler));
