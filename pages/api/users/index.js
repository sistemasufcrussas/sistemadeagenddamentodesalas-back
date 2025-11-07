import { authMiddleware, requireRole, hashPassword } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';
import { withAuditLog, logCreate } from '../../../lib/auditLog.js';

async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      // Buscar todos os usuários (sem senhas)
      // Professores veem apenas informações básicas
      const result = await query(
        'SELECT id, name, email, siape, role, created_at, updated_at FROM users ORDER BY name'
      );

      return res.status(200).json({
        success: true,
        users: result.rows
      });

    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else if (req.method === 'POST') {
    // Apenas admins podem criar usuários
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem criar usuários' });
    }
    
    // Criar novo usuário
    try {
      const { name, email, siape, password, role } = req.body;

      // Validar dados obrigatórios
      if (!name || !email || !siape || !password || !role) {
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

      // Inserir novo usuário
      const result = await query(
        `INSERT INTO users (name, email, siape, password_hash, role) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, name, email, siape, role, created_at`,
        [name, email.toLowerCase(), siape, hashedPassword, role]
      );

      const newUser = result.rows[0];

      // Registrar log de auditoria
      await logCreate(req, 'users', newUser.id, {
        name: newUser.name,
        email: newUser.email,
        siape: newUser.siape,
        role: newUser.role,
        created_at: newUser.created_at
      });

      return res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        user: newUser
      });

    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Admins, coordenadores, professores e alunos podem acessar usuários (alunos, professores e coordenadores só podem ver)
export default requireRole(['admin', 'coordenador', 'professor', 'servidor', 'aluno'])(withAuditLog('users')(handler));
