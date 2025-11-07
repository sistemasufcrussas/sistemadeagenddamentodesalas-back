import { query } from '../../../lib/database.js';
import { hashPassword, generateToken } from '../../../lib/auth.js';
import { setCorsHeaders } from '../../../lib/cors.js';

export default async function handler(req, res) {
  // Configurar CORS
  const isPreflight = setCorsHeaders(req, res);
  if (isPreflight) {
    return; // Preflight já foi respondido
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { name, email, siape, password, role } = req.body;

    // Validar dados de entrada
    if (!name || !email || !siape || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    // Verificar se email já existe
    const emailExists = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (emailExists.rows.length > 0) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    // Verificar se SIAPE já existe
    const siapeExists = await query(
      'SELECT id FROM users WHERE siape = $1',
      [siape]
    );

    if (siapeExists.rows.length > 0) {
      return res.status(409).json({ error: 'SIAPE já cadastrado' });
    }

    // Hash da senha
    const hashedPassword = await hashPassword(password);

    // Inserir novo usuário com status pending
    const result = await query(
      `INSERT INTO users (name, email, siape, password_hash, role, status) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING id, name, email, siape, role, status`,
      [name, email.toLowerCase(), siape, hashedPassword, role || 'professor', 'pending']
    );

    const newUser = result.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso! Aguarde a aprovação de um administrador para fazer login.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        siape: newUser.siape,
        role: newUser.role,
        status: newUser.status
      }
    });

  } catch (error) {
    console.error('Erro no cadastro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
