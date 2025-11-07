import { query } from '../../../lib/database.js';
import { verifyPassword, generateToken } from '../../../lib/auth.js';
import { logLogin } from '../../../lib/auditLog.js';
import { setCorsHeaders } from '../../../lib/cors.js';

export default async function handler(req, res) {
  // Configurar CORS ANTES de qualquer coisa
  const isPreflight = setCorsHeaders(req, res);
  if (isPreflight) {
    return; // Preflight já foi respondido
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email, password } = req.body;

    // Validar dados de entrada
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário no banco
    const result = await query(
      'SELECT id, name, email, siape, matricula_sigaa, password_hash, role, first_login, status, created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];

    // Verificar se a conta está aprovada
    if (user.status !== 'approved') {
      if (user.status === 'pending') {
        return res.status(403).json({ 
          error: 'Sua conta ainda está aguardando aprovação de um administrador. Tente novamente mais tarde.' 
        });
      } else if (user.status === 'rejected') {
        return res.status(403).json({ 
          error: 'Sua conta foi rejeitada. Entre em contato com o administrador.' 
        });
      }
    }

    // Verificar senha
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar token JWT
    const token = generateToken(user.id, user.email, user.role);

    // Retornar dados do usuário (sem senha) e token
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      siape: user.siape,
      matricula_sigaa: user.matricula_sigaa,
      role: user.role,
      first_login: user.first_login,
      created_at: user.created_at
    };

    // Registrar log de login bem-sucedido
    const ipAddress = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress ||
                     (req.connection.socket ? req.connection.socket.remoteAddress : null);
    const userAgent = req.headers['user-agent'] || null;

    await logLogin(userData, ipAddress, userAgent, true);

    return res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso',
      user: userData,
      token
    });

  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
