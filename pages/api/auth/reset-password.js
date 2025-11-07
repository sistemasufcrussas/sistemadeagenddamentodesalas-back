import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';
import { hashPassword } from '../../../lib/auth.js';
import { withAuditLog, logUpdate } from '../../../lib/auditLog.js';
import { setCorsHeaders } from '../../../lib/cors.js';

async function handler(req, res) {
  // Configurar CORS
  const isPreflight = setCorsHeaders(req, res);
  if (isPreflight) {
    return; // Preflight já foi respondido
  }

  if (req.method === 'POST') {
    try {
      const { current_password, new_password, confirm_password } = req.body;

      // Validar dados obrigatórios
      if (!current_password || !new_password || !confirm_password) {
        return res.status(400).json({ 
          error: 'Todos os campos são obrigatórios' 
        });
      }

      // Verificar se as senhas coincidem
      if (new_password !== confirm_password) {
        return res.status(400).json({ 
          error: 'A nova senha e confirmação não coincidem' 
        });
      }

      // Validar tamanho da senha
      if (new_password.length < 6) {
        return res.status(400).json({ 
          error: 'A nova senha deve ter pelo menos 6 caracteres' 
        });
      }

      // Buscar dados do usuário
      const userResult = await query(
        'SELECT id, name, email, password_hash, first_login FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const user = userResult.rows[0];

      // Verificar senha atual
      const bcrypt = await import('bcryptjs');
      const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);

      if (!isCurrentPasswordValid) {
        return res.status(400).json({ 
          error: 'Senha atual incorreta' 
        });
      }

      // Hash da nova senha
      const hashedNewPassword = await hashPassword(new_password);

      // Preparar dados para atualização
      const updateFields = ['password_hash = $1', 'updated_at = CURRENT_TIMESTAMP'];
      const updateValues = [hashedNewPassword];
      let paramCount = 1;

      // Se for primeiro login, marcar como não primeiro login
      const oldValues = {
        first_login: user.first_login,
        password_updated: false,
        updated_at: user.updated_at
      };

      if (user.first_login) {
        paramCount++;
        updateFields.push(`first_login = $${paramCount}`);
        updateValues.push(false);
        oldValues.first_login = true;
      }

      paramCount++;
      updateValues.push(req.user.id);

      // Atualizar senha (e first_login se necessário)
      await query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
        updateValues
      );

      // Registrar log de auditoria
      const newValues = {
        first_login: user.first_login ? false : user.first_login,
        password_updated: true,
        updated_at: new Date().toISOString()
      };

      await logUpdate(req, 'users', req.user.id, oldValues, newValues);

      return res.status(200).json({
        success: true,
        message: user.first_login 
          ? 'Senha redefinida com sucesso! Agora você pode usar sua nova senha para fazer login.'
          : 'Senha alterada com sucesso!'
      });

    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Qualquer usuário autenticado pode redefinir sua própria senha
export default authMiddleware(handler);
