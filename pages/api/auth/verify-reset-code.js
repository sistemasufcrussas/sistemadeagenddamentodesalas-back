import { query } from '../../../lib/database.js';
import { setCorsHeaders } from '../../../lib/cors.js';

export default async function handler(req, res) {
  // Configurar CORS
  const isPreflight = setCorsHeaders(req, res);
  if (isPreflight) {
    return; // Preflight já foi respondido
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email e código são obrigatórios' });

    const userResult = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email.toLowerCase()]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: 'Código inválido' });
    const userId = userResult.rows[0].id;

    const codeResult = await query(
      `SELECT id, expires_at, used FROM password_reset_codes 
       WHERE user_id = $1 AND code = $2 ORDER BY created_at DESC LIMIT 1`,
      [userId, code]
    );

    if (codeResult.rows.length === 0) return res.status(400).json({ error: 'Código inválido' });
    const record = codeResult.rows[0];
    if (record.used) return res.status(400).json({ error: 'Código já utilizado' });
    if (new Date(record.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Código expirado' });

    return res.status(200).json({ success: true, message: 'Código válido' });
  } catch (error) {
    console.error('Erro ao verificar código:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}


