import { authMiddleware } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Buscar dados atualizados do usuário no banco
    const result = await query(
      'SELECT id, name, email, siape, matricula_sigaa, role, first_login, status, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    res.status(200).json({
      success: true,
      user: user,
      token: req.headers.authorization?.replace('Bearer ', '')
    });
    return;

  } catch (error) {
    console.error('Erro na verificação do token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
    return;
  }
}

export default authMiddleware(handler);
