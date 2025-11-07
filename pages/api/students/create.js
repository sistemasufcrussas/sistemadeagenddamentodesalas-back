import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';
import { hashPassword } from '../../../lib/auth.js';
import { withAuditLog, logCreate } from '../../../lib/auditLog.js';

async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // Professores e servidores podem cadastrar alunos
    const userRole = req.user.role?.toLowerCase()?.trim();
    if (!['professor', 'servidor'].includes(userRole)) {
      return res.status(403).json({ error: 'Apenas professores e servidores podem cadastrar alunos' });
      return;
    }

    try {
      const { name, email, matricula_sigaa, password } = req.body;

      // Validar dados obrigatórios
      if (!name || !email || !matricula_sigaa) {
        return res.status(400).json({ 
          error: 'Nome, email e matrícula do SIGAA são obrigatórios' 
        });
        return;
      }

      // Validar formato da matrícula (6 dígitos)
      if (!/^\d{6}$/.test(matricula_sigaa)) {
        return res.status(400).json({ 
          error: 'A matrícula do SIGAA deve conter exatamente 6 dígitos' 
        });
        return;
      }

      // Validar formato do email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          error: 'Formato de email inválido' 
        });
        return;
      }

      // Verificar se email já existe
      const existingEmail = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingEmail.rows.length > 0) {
        return res.status(409).json({ 
          error: 'Este email já está cadastrado no sistema' 
        });
        return;
      }

      // Verificar se matrícula já existe
      const existingMatricula = await query(
        'SELECT id FROM users WHERE matricula_sigaa = $1',
        [matricula_sigaa]
      );

      if (existingMatricula.rows.length > 0) {
        return res.status(409).json({ 
          error: 'Esta matrícula do SIGAA já está cadastrada no sistema' 
        });
        return;
      }

      // Definir senha (se não fornecida, usar a matrícula)
      const finalPassword = password || matricula_sigaa;
      const hashedPassword = await hashPassword(finalPassword);

      // Inserir novo aluno
      const result = await query(`
        INSERT INTO users (name, email, matricula_sigaa, password_hash, role, first_login, created_by) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id, name, email, matricula_sigaa, role, first_login, created_by, created_at
      `, [name, email, matricula_sigaa, hashedPassword, 'aluno', true, req.user.id]);

      const newStudent = result.rows[0];

      // Registrar log de auditoria
      await logCreate(req, 'users', newStudent.id, {
        name: newStudent.name,
        email: newStudent.email,
        matricula_sigaa: newStudent.matricula_sigaa,
        role: newStudent.role,
        first_login: newStudent.first_login,
        created_by: newStudent.created_by,
        created_at: newStudent.created_at
      });

      return res.status(201).json({
        success: true,
        message: 'Aluno cadastrado com sucesso',
        student: {
          id: newStudent.id,
          name: newStudent.name,
          email: newStudent.email,
          matricula_sigaa: newStudent.matricula_sigaa,
          role: newStudent.role,
          first_login: newStudent.first_login,
          created_by: newStudent.created_by
        },
        password_info: password ? 
          'Senha personalizada definida pelo professor/servidor' : 
          `Senha padrão: ${matricula_sigaa} (matrícula do SIGAA)`
      });
      return;

    } catch (error) {
      console.error('Erro ao cadastrar aluno:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
      return;
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
    return;
  }
}

// Apenas professores podem acessar
export default requireRole(['professor', 'servidor'])(withAuditLog('users')(handler));
