import { query } from '../../../lib/database.js';
import { hashPassword, generateToken } from '../../../lib/auth.js';
import { setCorsHeaders } from '../../../lib/cors.js';

export default async function handler(req, res) {
  // Configurar CORS
  const isPreflight = setCorsHeaders(req, res);
  if (isPreflight) {
    return; // Preflight já foi respondido
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const { email, code, new_password } = req.body;
    if (!email || !code || !new_password) return res.status(400).json({ error: 'Dados insuficientes' });
    if (new_password.length < 6) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });

    const userResult = await query('SELECT id, email, role, name FROM users WHERE email = $1 LIMIT 1', [email.toLowerCase()]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: 'Código inválido' });
    const user = userResult.rows[0];

    const codeResult = await query(
      `SELECT id, expires_at, used FROM password_reset_codes 
       WHERE user_id = $1 AND code = $2 ORDER BY created_at DESC LIMIT 1`,
      [user.id, code]
    );

    if (codeResult.rows.length === 0) return res.status(400).json({ error: 'Código inválido' });
    const record = codeResult.rows[0];
    if (record.used) return res.status(400).json({ error: 'Código já utilizado' });
    if (new Date(record.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Código expirado' });

    // Atualizar senha
    const newHash = await hashPassword(new_password);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, user.id]);

    // Marcar código como usado
    await query('UPDATE password_reset_codes SET used = TRUE WHERE id = $1', [record.id]);

    // Login automático
    const token = generateToken(user.id, user.email, user.role);
    const userData = { id: user.id, name: user.name, email: user.email, role: user.role };

    return res.status(200).json({ success: true, message: 'Senha alterada com sucesso', user: userData, token });
  } catch (error) {
    console.error('Erro ao confirmar redefinição:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}


