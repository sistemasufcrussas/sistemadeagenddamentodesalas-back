import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';
import { hashPassword } from '../../../lib/auth.js';
import { withAuditLog, logUpdate, logDelete } from '../../../lib/auditLog.js';

async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    // Buscar usuário específico
    try {
      const result = await query(
        'SELECT id, name, email, siape, role, created_at FROM users WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      return res.status(200).json({
        success: true,
        user: result.rows[0]
      });

    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else if (req.method === 'PUT') {
    // Atualizar usuário
    try {
      const { name, email, siape, role, password } = req.body;

      // Validar dados obrigatórios
      if (!name || !email || !siape || !role) {
        return res.status(400).json({ error: 'Nome, email, SIAPE e role são obrigatórios' });
      }

      // Buscar dados atuais do usuário para o log
      const currentUserResult = await query(
        'SELECT id, name, email, siape, role FROM users WHERE id = $1',
        [id]
      );

      if (currentUserResult.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const oldValues = currentUserResult.rows[0];

      // Verificar se email já existe (exceto o próprio usuário)
      const emailExists = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase(), id]
      );

      if (emailExists.rows.length > 0) {
        return res.status(409).json({ error: 'Email já está em uso por outro usuário' });
      }

      // Verificar se SIAPE já existe (exceto o próprio usuário)
      const siapeExists = await query(
        'SELECT id FROM users WHERE siape = $1 AND id != $2',
        [siape, id]
      );

      if (siapeExists.rows.length > 0) {
        return res.status(409).json({ error: 'SIAPE já está em uso por outro usuário' });
      }

      // Preparar query de atualização
      let updateQuery = `
        UPDATE users 
        SET name = $1, email = $2, siape = $3, role = $4, updated_at = CURRENT_TIMESTAMP
      `;
      let params = [name, email.toLowerCase(), siape, role];

      // Se senha foi fornecida, incluir na atualização
      if (password && password.trim() !== '') {
        if (password.length < 6) {
          return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
        }
        const hashedPassword = await hashPassword(password);
        updateQuery += ', password_hash = $5';
        params.push(hashedPassword);
      }

      updateQuery += ' WHERE id = $' + (params.length + 1) + ' RETURNING id, name, email, siape, role, created_at, updated_at';
      params.push(id);

      const result = await query(updateQuery, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const updatedUser = result.rows[0];

      // Registrar log de auditoria
      await logUpdate(req, 'users', parseInt(id), oldValues, {
        name: updatedUser.name,
        email: updatedUser.email,
        siape: updatedUser.siape,
        role: updatedUser.role,
        updated_at: updatedUser.updated_at,
        password_changed: password && password.trim() !== ''
      });

      return res.status(200).json({
        success: true,
        message: 'Usuário atualizado com sucesso',
        user: updatedUser
      });

    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else if (req.method === 'DELETE') {
    // Deletar usuário
    try {
      // Verificar se não está tentando deletar o próprio usuário
      if (parseInt(id) === req.user.userId) {
        return res.status(400).json({ error: 'Não é possível deletar seu próprio usuário' });
      }

      // Buscar dados do usuário antes de deletar para o log
      const userToDelete = await query(
        'SELECT id, name, email, siape, role FROM users WHERE id = $1',
        [id]
      );

      if (userToDelete.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const deletedUserData = userToDelete.rows[0];

      const result = await query(
        'DELETE FROM users WHERE id = $1 RETURNING id, name, email',
        [id]
      );

      // Registrar log de auditoria
      await logDelete(req, 'users', parseInt(id), deletedUserData);

      return res.status(200).json({
        success: true,
        message: 'Usuário deletado com sucesso',
        deletedUser: result.rows[0]
      });

    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Apenas admins podem gerenciar usuários
export default requireRole(['admin'])(withAuditLog('users')(handler));
