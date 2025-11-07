import { query } from '../../../lib/database.js';
import { emailTemplates, sendEmail } from '../../../lib/emailService.js';
import { setCorsHeaders } from '../../../lib/cors.js';

export default async function handler(req, res) {
  // Configurar CORS
  const isPreflight = setCorsHeaders(req, res);
  if (isPreflight) {
    return; // Preflight já foi respondido
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email é obrigatório' });

    const userResult = await query('SELECT id, name, email, status FROM users WHERE email = $1 LIMIT 1', [email.toLowerCase()]);

    // Não revelar se o usuário existe ou não
    if (userResult.rows.length === 0 || userResult.rows[0].status !== 'approved') {
      return res.status(200).json({ success: true, message: 'Se o email existir, enviaremos um código válido por 5 minutos.' });
    }

    const user = userResult.rows[0];

    // Garantir tabela
    await query(`
      CREATE TABLE IF NOT EXISTS password_reset_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Invalidar códigos não usados anteriores
    await query('UPDATE password_reset_codes SET used = TRUE WHERE user_id = $1 AND used = FALSE', [user.id]);

    // Gerar e salvar novo código (6 dígitos), expira em 5 minutos
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await query('INSERT INTO password_reset_codes (user_id, code, expires_at) VALUES ($1, $2, $3)', [user.id, code, expiresAt]);

    // Enviar email
    const template = emailTemplates.passwordResetCode({ name: user.name, code });
    await sendEmail({ to: user.email, ...template });

    return res.status(200).json({ success: true, message: 'Código enviado para o email, válido por 5 minutos.' });
  } catch (error) {
    console.error('Erro no esqueci a senha:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}


