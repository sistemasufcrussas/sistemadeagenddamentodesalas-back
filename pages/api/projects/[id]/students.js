import { authMiddleware, requireRole } from '../../../../lib/auth.js';
import { query } from '../../../../lib/database.js';
import { withAuditLog, logCreate, logDelete } from '../../../../lib/auditLog.js';

async function handler(req, res) {
  // Configurar CORS ANTES de qualquer verificação
  const origin = req.headers.origin;
  if (origin && (origin.includes('vercel.app') || origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight por 24 horas

  // Responder a preflight requests ANTES de qualquer processamento
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const projectId = req.query.id;

  // Parse body if it's a string (for DELETE requests)
  if ((req.method === 'POST' || req.method === 'DELETE') && typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      return res.status(400).json({ error: 'Corpo da requisição inválido' });
      return;
    }
  }

  if (req.method === 'GET') {
    try {
      // Buscar alunos do projeto
      const result = await query(`
        SELECT 
          ps.*,
          u.name as student_name,
          u.email as student_email,
          u.siape as student_siape,
          u.matricula_sigaa,
          u.created_by,
          u.created_at,
          u.first_login,
          creator.name as created_by_name
        FROM project_students ps
        LEFT JOIN users u ON ps.student_id = u.id
        LEFT JOIN users creator ON u.created_by = creator.id
        WHERE ps.project_id = $1
        ORDER BY u.name
      `, [projectId]);

      return res.status(200).json({
        success: true,
        students: result.rows
      });
      return;

    } catch (error) {
      console.error('Erro ao buscar alunos do projeto:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
      return;
    }

  } else if (req.method === 'POST') {
    // Professores, servidores e admins podem adicionar alunos
    const userRole = req.user.role?.toLowerCase()?.trim();
    if (!['professor', 'admin', 'servidor'].includes(userRole)) {
      return res.status(403).json({ error: 'Apenas professores, servidores e administradores podem adicionar alunos' });
      return;
    }

    try {
      const { student_id } = req.body;

      if (!student_id) {
        return res.status(400).json({ error: 'ID do aluno é obrigatório' });
        return;
      }

      // Verificar se o projeto pertence ao professor/servidor (somente quando o usuário é professor ou servidor)
      const userRole = req.user.role?.toLowerCase()?.trim();
      if (userRole === 'professor' || userRole === 'servidor') {
        const projectCheck = await query(
          'SELECT id FROM projects WHERE id = $1 AND professor_id = $2',
          [projectId, req.user.id]
        );

        if (projectCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Você não tem permissão para modificar este projeto' });
          return;
        }
      }

      // Verificar se o aluno existe e é realmente um aluno
      const studentCheck = await query(
        'SELECT id, name, role FROM users WHERE id = $1 AND role = $2',
        [student_id, 'aluno']
      );

      if (studentCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Aluno não encontrado' });
        return;
      }

      // Verificar se o aluno já está no projeto
      const existingCheck = await query(
        'SELECT id FROM project_students WHERE project_id = $1 AND student_id = $2',
        [projectId, student_id]
      );

      if (existingCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Aluno já está neste projeto' });
        return;
      }

      // Adicionar aluno ao projeto
      const result = await query(`
        INSERT INTO project_students (project_id, student_id) 
        VALUES ($1, $2) 
        RETURNING *
      `, [projectId, student_id]);

      const newProjectStudent = result.rows[0];

      // Registrar log de auditoria
      await logCreate(req, 'project_students', newProjectStudent.id, {
        project_id: projectId,
        student_id: student_id,
        student_name: studentCheck.rows[0].name,
        created_at: newProjectStudent.created_at
      });

      return res.status(201).json({
        success: true,
        message: 'Aluno adicionado ao projeto com sucesso',
        project_student: newProjectStudent
      });
      return;

    } catch (error) {
      console.error('Erro ao adicionar aluno ao projeto:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
      return;
    }

  } else if (req.method === 'DELETE') {
    // Professores, servidores e admins podem remover alunos
    const userRole = req.user.role?.toLowerCase()?.trim();
    if (!['professor', 'admin', 'servidor'].includes(userRole)) {
      return res.status(403).json({ error: 'Apenas professores, servidores e administradores podem remover alunos' });
      return;
    }

    try {
      const { student_id } = req.body;

      if (!student_id) {
        return res.status(400).json({ error: 'ID do aluno é obrigatório' });
        return;
      }

      // Verificar se o projeto pertence ao professor/servidor (somente quando o usuário é professor ou servidor)
      const userRole = req.user.role?.toLowerCase()?.trim();
      if (userRole === 'professor' || userRole === 'servidor') {
        const projectCheck = await query(
          'SELECT id FROM projects WHERE id = $1 AND professor_id = $2',
          [projectId, req.user.id]
        );

        if (projectCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Você não tem permissão para modificar este projeto' });
          return;
        }
      }

      // Buscar dados do aluno antes de remover
      const studentCheck = await query(`
        SELECT ps.*, u.name as student_name
        FROM project_students ps
        LEFT JOIN users u ON ps.student_id = u.id
        WHERE ps.project_id = $1 AND ps.student_id = $2
      `, [projectId, student_id]);

      if (studentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Aluno não encontrado neste projeto' });
        return;
      }

      // Remover aluno do projeto
      await query(
        'DELETE FROM project_students WHERE project_id = $1 AND student_id = $2',
        [projectId, student_id]
      );

      // Registrar log de auditoria
      await logDelete(req, 'project_students', studentCheck.rows[0].id, {
        project_id: projectId,
        student_id: student_id,
        student_name: studentCheck.rows[0].student_name
      });

      return res.status(200).json({
        success: true,
        message: 'Aluno removido do projeto com sucesso'
      });
      return;

    } catch (error) {
      console.error('Erro ao remover aluno do projeto:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
      return;
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
    return;
  }
}

// Professores, admins e alunos podem acessar alunos dos projetos (alunos só podem ver)
export default requireRole(['professor', 'servidor', 'admin', 'aluno'])(withAuditLog('project_students')(handler));
