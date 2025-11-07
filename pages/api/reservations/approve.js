import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';
import { sendReservationStatusUpdate, sendNewReservationForAdminNotification } from '../../../lib/emailService.js';
import { withAuditLog, logUpdate } from '../../../lib/auditLog.js';

async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // Apenas admins, professores e servidores podem aprovar/rejeitar reservas
    const userRole = req.user.role?.toLowerCase()?.trim();
    if (!['admin', 'professor', 'servidor'].includes(userRole)) {
      return res.status(403).json({ error: 'Apenas administradores, professores e servidores podem aprovar ou rejeitar reservas' });
    }

    try {
      const { reservation_id, action, rejection_reason } = req.body;
      const user_id = req.user.id;

      // Validar dados
      if (!reservation_id || !action) {
        return res.status(400).json({ 
          error: 'ID da reserva e ação são obrigatórios' 
        });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ 
          error: 'Ação deve ser "approve" ou "reject"' 
        });
      }

      if (action === 'reject' && !rejection_reason) {
        return res.status(400).json({ 
          error: 'Motivo da rejeição é obrigatório' 
        });
      }

      // Buscar reserva com informações do projeto
      const reservationResult = await query(`
        SELECT r.*, p.professor_id as project_professor_id
        FROM reservations r
        LEFT JOIN projects p ON r.project_id = p.id
        WHERE r.id = $1
      `, [reservation_id]);

      if (reservationResult.rows.length === 0) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }

      const reservation = reservationResult.rows[0];
      const oldValues = reservation;

      // Fluxo de aprovação por papel
      const userRole = req.user.role?.toLowerCase()?.trim();
      const isAdmin = userRole === 'admin';
      const isProfessor = userRole === 'professor' || userRole === 'servidor';

      // Professor: pode aprovar/rejeitar reservas PENDENTES ou reprovar reservas PROFESSOR_APPROVED
      if (isProfessor) {
        // Precisa ter projeto associado
        if (!reservation.project_professor_id) {
          return res.status(400).json({ error: 'Reserva não está associada a um projeto' });
        }
        // Verificar se é o professor responsável
        if (reservation.project_professor_id !== req.user.id) {
          return res.status(403).json({ error: 'Você não é responsável por este projeto' });
        }
        // Professor pode aprovar apenas reservas pendentes
        // Professor pode rejeitar reservas pendentes ou reprovar reservas professor_approved
        if (action === 'approve' && reservation.status !== 'pending') {
          return res.status(400).json({ error: 'Somente reservas pendentes podem ser aprovadas pelo professor' });
        }
        if (action === 'reject' && !['pending', 'professor_approved'].includes(reservation.status)) {
          return res.status(400).json({ error: 'Somente reservas pendentes ou aprovadas por você podem ser rejeitadas' });
        }
      }

      // Admin: pode aprovar final reservas professor_approved (ou reprocessar approved/rejected conforme regras abaixo)
      if (isAdmin) {
        if (!['pending', 'professor_approved', 'approved', 'rejected'].includes(reservation.status)) {
          return res.status(400).json({ error: 'Status de reserva inválido para processamento' });
        }
      }

      // Verificar se a reserva pode ser processada (regras específicas por papel)
      if (isAdmin) {
        if (reservation.status !== 'pending' && reservation.status !== 'professor_approved') {
          // Admin pode revogar approved ou reaprovar rejected
          if (action === 'reject' && reservation.status === 'approved') {
            // ok revogar
          } else if (action === 'approve' && reservation.status === 'rejected') {
            // ok aprovar novamente
          } else {
            return res.status(400).json({ 
              error: `Reserva já foi ${reservation.status === 'approved' ? 'aprovada' : 'rejeitada'}` 
            });
          }
        }
      }

      // Verificar conflitos de horário se aprovando
      if (action === 'approve') {
        const conflictCheck = await query(`
          SELECT id, title, start_time, end_time 
          FROM reservations 
          WHERE room_id = $1 
          AND status = 'approved'
          AND (is_active IS NULL OR is_active = true)
          AND id != $2
          AND (
            (start_time <= $3 AND end_time > $3) OR
            (start_time < $4 AND end_time >= $4) OR
            (start_time >= $3 AND end_time <= $4)
          )
        `, [reservation.room_id, reservation_id, reservation.start_time, reservation.end_time]);

        if (conflictCheck.rows.length > 0) {
          return res.status(409).json({ 
            error: 'Não é possível aprovar: já existe uma reserva aprovada para este horário',
            conflict: conflictCheck.rows[0]
          });
        }
      }

      // Atualizar status da reserva
      let updateQuery;
      let updateParams;

      if (action === 'approve') {
        if (isProfessor) {
          // Aprovação do professor: marca como professor_approved
          updateQuery = `
            UPDATE reservations 
            SET status = 'professor_approved', 
                professor_approved_by = $1, 
                professor_approved_at = CURRENT_TIMESTAMP,
                rejection_reason = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 
            RETURNING *
          `;
          updateParams = [user_id, reservation_id];
        } else {
          // Aprovação final do admin
          updateQuery = `
            UPDATE reservations 
            SET status = 'approved', 
                approved_by = $1, 
                approved_at = CURRENT_TIMESTAMP,
                rejection_reason = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 
            RETURNING *
          `;
          updateParams = [user_id, reservation_id];
        }
      } else {
        // Rejeição (professor ou admin)
        updateQuery = `
          UPDATE reservations 
          SET status = 'rejected', 
              rejection_reason = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 
          RETURNING *
        `;
        updateParams = [rejection_reason, reservation_id];
      }

      const result = await query(updateQuery, updateParams);
      const updatedReservation = result.rows[0];

      // Registrar log de auditoria
      await logUpdate(req, 'reservations', parseInt(reservation_id), oldValues, {
        ...updatedReservation,
        action_performed: action,
        rejection_reason: action === 'reject' ? rejection_reason : null
      });

      // Buscar dados completos da reserva
      const fullReservation = await query(`
        SELECT 
          r.*,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role,
          rm.name as room_name,
          rm.location as room_location,
          p.name as project_name,
          p.type as project_type,
          prof.name as professor_name,
          prof.email as professor_email,
          approver.name as approved_by_name
        FROM reservations r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN rooms rm ON r.room_id = rm.id
        LEFT JOIN projects p ON r.project_id = p.id
        LEFT JOIN users prof ON p.professor_id = prof.id
        LEFT JOIN users approver ON r.approved_by = approver.id
        WHERE r.id = $1
      `, [reservation_id]);

      const reservationData = fullReservation.rows[0];

      // Enviar notificações por email
      try {
        if (action === 'approve') {
          if (isProfessor) {
            // Professor aprovou - notificar aluno e admin
            await sendReservationStatusUpdate({
              title: reservationData.title,
              student_name: reservationData.user_name,
              room_name: reservationData.room_name,
              start_time: reservationData.start_time,
              end_time: reservationData.end_time,
              status: 'professor_approved'
            }, reservationData.user_email);

            // Notificar admin
            const adminResult = await query('SELECT email FROM users WHERE role = $1 LIMIT 1', ['admin']);
            if (adminResult.rows.length > 0) {
              await sendNewReservationForAdminNotification({
                title: reservationData.title,
                student_name: reservationData.user_name,
                room_name: reservationData.room_name,
                start_time: reservationData.start_time,
                end_time: reservationData.end_time,
                project_name: reservationData.project_name,
                description: reservationData.description,
                professor_name: reservationData.professor_name
              }, adminResult.rows[0].email);
            }
          } else {
            // Admin aprovou - notificar aluno
            await sendReservationStatusUpdate({
              title: reservationData.title,
              student_name: reservationData.user_name,
              room_name: reservationData.room_name,
              start_time: reservationData.start_time,
              end_time: reservationData.end_time,
              status: 'approved'
            }, reservationData.user_email);
          }
        } else if (action === 'reject') {
          // Rejeição - notificar aluno
          await sendReservationStatusUpdate({
            title: reservationData.title,
            student_name: reservationData.user_name,
            room_name: reservationData.room_name,
            start_time: reservationData.start_time,
            end_time: reservationData.end_time,
            status: 'rejected',
            rejection_reason: rejection_reason
          }, reservationData.user_email);
        }
      } catch (emailError) {
        console.error('Erro ao enviar email de notificação:', emailError);
        // Não falhar a aprovação por erro de email
      }

      // Determinar mensagem baseada na ação e status anterior
      let message;
      if (action === 'approve') {
        if (isProfessor) {
          message = 'Reserva aprovada pelo professor e enviada ao admin';
        } else {
          message = reservation.status === 'rejected' ? 'Reserva rejeitada foi aprovada com sucesso' : 'Reserva aprovada com sucesso';
        }
      } else if (action === 'reject') {
        message = reservation.status === 'approved' ? 'Aprovação revogada com sucesso' : 'Reserva rejeitada';
      }

      return res.status(200).json({
        success: true,
        message: message,
        reservation: reservationData
      });

    } catch (error) {
      console.error('Erro ao processar aprovação:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else if (req.method === 'GET') {
    // Listar reservas pendentes para aprovação
    try {
      const result = await query(`
        SELECT 
          r.*,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role,
          rm.name as room_name,
          rm.location as room_location,
          rm.capacity as room_capacity
        FROM reservations r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN rooms rm ON r.room_id = rm.id
        WHERE r.status = 'pending'
          AND (r.is_active IS NULL OR r.is_active = true)
        ORDER BY r.created_at ASC
      `);

      return res.status(200).json({
        success: true,
        pending_reservations: result.rows
      });

    } catch (error) {
      console.error('Erro ao buscar reservas pendentes:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Apenas administradores podem aprovar reservas, mas professores podem ver pendentes
export default requireRole(['admin', 'professor', 'servidor'])(withAuditLog('reservations')(handler));
