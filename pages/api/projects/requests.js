import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';
import { withAuditLog } from '../../../lib/auditLog.js';
import { sendNewProjectRequestNotification, sendProjectRequestStatusUpdate } from '../../../lib/emailService.js';

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
      const { professor_id, student_id, status } = req.query;
      
      let whereConditions = [];
      let queryParams = [];
      let paramCount = 0;

      // Construir filtros dinamicamente
      if (professor_id) {
        paramCount++;
        whereConditions.push(`pr.professor_id = $${paramCount}`);
        queryParams.push(professor_id);
      }

      if (student_id) {
        paramCount++;
        // Se student_id for 'me', usar o ID do usuário logado
        const actualStudentId = student_id === 'me' ? req.user.id : student_id;
        whereConditions.push(`pr.student_id = $${paramCount}`);
        queryParams.push(actualStudentId);
      }

      if (status) {
        paramCount++;
        whereConditions.push(`pr.status = $${paramCount}`);
        queryParams.push(status);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Buscar solicitações com informações do projeto, aluno e professor
      const result = await query(`
        SELECT 
          pr.id,
          pr.project_id,
          pr.student_id,
          pr.professor_id,
          pr.status,
          pr.message,
          pr.created_at,
          pr.updated_at,
          p.name as project_name,
          p.type as project_type,
          p.description as project_description,
          s.name as student_name,
          s.email as student_email,
          s.matricula_sigaa as student_matricula,
          prof.name as professor_name,
          prof.email as professor_email
        FROM project_requests pr
        JOIN projects p ON pr.project_id = p.id
        JOIN users s ON pr.student_id = s.id
        JOIN users prof ON pr.professor_id = prof.id
        ${whereClause}
        ORDER BY pr.created_at DESC
      `, queryParams);

      return res.status(200).json({
        success: true,
        requests: result.rows
      });

    } catch (error) {
      console.error('Erro ao buscar solicitações de projeto:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else if (req.method === 'POST') {
    try {
      const { project_id, message } = req.body;
      const student_id = req.user.id;

      // Validar dados
      if (!project_id) {
        return res.status(400).json({ error: 'ID do projeto é obrigatório' });
      }

      // Verificar se o projeto existe e buscar o professor responsável
      const projectResult = await query(
        'SELECT id, professor_id FROM projects WHERE id = $1',
        [project_id]
      );

      if (projectResult.rows.length === 0) {
        return res.status(404).json({ error: 'Projeto não encontrado' });
      }

      const project = projectResult.rows[0];

      // Verificar se o aluno já está no projeto
      const existingStudentResult = await query(
        'SELECT id FROM project_students WHERE project_id = $1 AND student_id = $2',
        [project_id, student_id]
      );

      if (existingStudentResult.rows.length > 0) {
        return res.status(400).json({ error: 'Você já está neste projeto' });
      }

      // Verificar se já existe uma solicitação pendente
      const existingRequestResult = await query(
        'SELECT id FROM project_requests WHERE project_id = $1 AND student_id = $2 AND status = $3',
        [project_id, student_id, 'pending']
      );

      if (existingRequestResult.rows.length > 0) {
        return res.status(400).json({ error: 'Você já tem uma solicitação pendente para este projeto' });
      }

      // Criar solicitação
      const result = await query(
        `INSERT INTO project_requests (project_id, student_id, professor_id, message)
         VALUES ($1, $2, $3, $4)
         RETURNING id, project_id, student_id, professor_id, status, message, created_at`,
        [project_id, student_id, project.professor_id, message || null]
      );

      const newRequest = result.rows[0];

      // Buscar dados completos para notificação
      const fullRequestData = await query(`
        SELECT 
          pr.*,
          p.name as project_name,
          p.type as project_type,
          s.name as student_name,
          s.email as student_email,
          s.matricula_sigaa as student_matricula,
          prof.name as professor_name,
          prof.email as professor_email
        FROM project_requests pr
        JOIN projects p ON pr.project_id = p.id
        JOIN users s ON pr.student_id = s.id
        JOIN users prof ON pr.professor_id = prof.id
        WHERE pr.id = $1
      `, [newRequest.id]);

      const requestData = fullRequestData.rows[0];

      // Enviar notificação por email para o professor
      try {
        await sendNewProjectRequestNotification({
          project_name: requestData.project_name,
          project_type: requestData.project_type,
          student_name: requestData.student_name,
          student_email: requestData.student_email,
          student_matricula: requestData.student_matricula,
          message: requestData.message,
          professor_name: requestData.professor_name
        }, requestData.professor_email);
      } catch (emailError) {
        console.error('Erro ao enviar email de notificação:', emailError);
        // Não falhar a criação da solicitação por erro de email
      }

      return res.status(201).json({
        success: true,
        message: 'Solicitação enviada com sucesso!',
        request: newRequest
      });

    } catch (error) {
      console.error('Erro ao criar solicitação de projeto:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else if (req.method === 'PUT') {
    try {
      const { request_id, action } = req.body;
      const professor_id = req.user.id;

      // Validar dados
      if (!request_id || !action) {
        return res.status(400).json({ error: 'ID da solicitação e ação são obrigatórios' });
      }

      if (!['approved', 'rejected'].includes(action)) {
        return res.status(400).json({ error: 'Ação inválida. Use "approved" ou "rejected"' });
      }

      // Verificar se a solicitação existe e se o professor tem permissão
      const requestResult = await query(
        'SELECT * FROM project_requests WHERE id = $1 AND professor_id = $2',
        [request_id, professor_id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({ error: 'Solicitação não encontrada ou sem permissão' });
      }

      const request = requestResult.rows[0];

      // Verificar se a solicitação ainda está pendente
      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'Esta solicitação já foi processada' });
      }

      // Atualizar status da solicitação
      await query(
        'UPDATE project_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [action, request_id]
      );

      // Se aprovada, adicionar aluno ao projeto
      if (action === 'approved') {
        await query(
          'INSERT INTO project_students (project_id, student_id) VALUES ($1, $2)',
          [request.project_id, request.student_id]
        );
      }

      // Buscar dados completos para notificação
      const fullRequestData = await query(`
        SELECT 
          pr.*,
          p.name as project_name,
          p.type as project_type,
          s.name as student_name,
          s.email as student_email,
          prof.name as professor_name
        FROM project_requests pr
        JOIN projects p ON pr.project_id = p.id
        JOIN users s ON pr.student_id = s.id
        JOIN users prof ON pr.professor_id = prof.id
        WHERE pr.id = $1
      `, [request_id]);

      const requestData = fullRequestData.rows[0];

      // Enviar notificação por email para o aluno
      try {
        await sendProjectRequestStatusUpdate({
          project_name: requestData.project_name,
          project_type: requestData.project_type,
          student_name: requestData.student_name,
          professor_name: requestData.professor_name,
          status: action
        }, requestData.student_email);
      } catch (emailError) {
        console.error('Erro ao enviar email de notificação:', emailError);
        // Não falhar o processamento por erro de email
      }

      return res.status(200).json({
        success: true,
        message: action === 'approved' ? 'Solicitação aprovada e aluno adicionado ao projeto!' : 'Solicitação rejeitada!'
      });

    } catch (error) {
      console.error('Erro ao processar solicitação de projeto:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Temporariamente removendo withAuditLog para testar
export default authMiddleware(handler);
