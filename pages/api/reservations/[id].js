import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';
import { withAuditLog, logUpdate, logDelete } from '../../../lib/auditLog.js';

async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    // Buscar reserva específica
    try {
      const result = await query(`
        SELECT 
          r.*,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role,
          rm.name as room_name,
          rm.location as room_location,
          rm.capacity as room_capacity,
          approver.name as approved_by_name
        FROM reservations r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN rooms rm ON r.room_id = rm.id
        LEFT JOIN users approver ON r.approved_by = approver.id
        WHERE r.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }

      return res.status(200).json({
        success: true,
        reservation: result.rows[0]
      });

    } catch (error) {
      console.error('Erro ao buscar reserva:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else if (req.method === 'PUT') {
    // Atualizar reserva (aprovar, rejeitar, editar)
    try {
      const { 
        status,
        rejection_reason,
        title,
        description,
        start_time,
        end_time,
        room_id,
        is_active
      } = req.body;

      const user_id = req.user.id;
      const user_role = req.user.role;

      // Buscar dados atuais da reserva
      const currentReservation = await query(
        'SELECT * FROM reservations WHERE id = $1',
        [id]
      );

      if (currentReservation.rows.length === 0) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }

      const reservation = currentReservation.rows[0];
      const oldValues = reservation;

      // Verificar permissões
      const canApprove = user_role === 'admin';
      const canEdit = user_role === 'admin' || reservation.user_id === user_id;
      const canDeactivate = reservation.user_id === user_id; // Alunos podem desativar suas próprias reservas

      // Se está tentando atualizar apenas is_active (desativar/ativar), permitir se for o dono
      const onlyUpdatingIsActive = is_active !== undefined && 
                                    !status && 
                                    !rejection_reason && 
                                    !title && 
                                    description === undefined && 
                                    !start_time && 
                                    !end_time && 
                                    !room_id;

      if (onlyUpdatingIsActive) {
        // Permitir que alunos desativem suas próprias reservas
        if (!canDeactivate) {
          return res.status(403).json({ 
            error: 'Você não tem permissão para cancelar esta reserva' 
          });
        }
        // Se passou na verificação acima, continuar com a atualização
      } else {
        // Se está tentando atualizar status, precisa ser admin
      if (status && !canApprove) {
        return res.status(403).json({ 
          error: 'Apenas administradores podem aprovar/rejeitar reservas' 
        });
        }

        // Se está tentando atualizar is_active junto com outros campos, verificar permissões
        if (is_active !== undefined && !canDeactivate && !canEdit) {
          return res.status(403).json({ 
            error: 'Você não tem permissão para desativar esta reserva' 
          });
        }
      }

      if ((title || description || start_time || end_time || room_id) && !canEdit) {
        return res.status(403).json({ 
          error: 'Você não tem permissão para editar esta reserva' 
        });
      }

      let updateFields = [];
      let updateValues = [];
      let paramCount = 0;

      // Atualização de status (aprovação/rejeição)
      if (status) {
        paramCount++;
        updateFields.push(`status = $${paramCount}`);
        updateValues.push(status);

        if (status === 'approved') {
          paramCount++;
          updateFields.push(`approved_by = $${paramCount}`);
          updateValues.push(user_id);

          paramCount++;
          updateFields.push(`approved_at = $${paramCount}`);
          updateValues.push(new Date().toISOString());

          // Limpar motivo de rejeição se aprovando
          paramCount++;
          updateFields.push(`rejection_reason = $${paramCount}`);
          updateValues.push(null);
        }

        if (status === 'rejected' && rejection_reason) {
          paramCount++;
          updateFields.push(`rejection_reason = $${paramCount}`);
          updateValues.push(rejection_reason);
        }
      }

      // Atualização de dados da reserva
      if (title) {
        paramCount++;
        updateFields.push(`title = $${paramCount}`);
        updateValues.push(title);
      }

      if (description !== undefined) {
        paramCount++;
        updateFields.push(`description = $${paramCount}`);
        updateValues.push(description);
      }

      if (start_time) {
        paramCount++;
        updateFields.push(`start_time = $${paramCount}`);
        updateValues.push(start_time);
      }

      if (end_time) {
        paramCount++;
        updateFields.push(`end_time = $${paramCount}`);
        updateValues.push(end_time);
      }

      // Atualização de is_active (desativar/ativar reserva)
      if (is_active !== undefined) {
        paramCount++;
        updateFields.push(`is_active = $${paramCount}`);
        updateValues.push(is_active);
      }

      if (room_id) {
        // Verificar se a sala existe e está ativa
        const roomCheck = await query(
          'SELECT id, name, is_active FROM rooms WHERE id = $1',
          [room_id]
        );

        if (roomCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Sala não encontrada' });
        }

        if (!roomCheck.rows[0].is_active) {
          return res.status(400).json({ error: 'Sala não está ativa' });
        }

        paramCount++;
        updateFields.push(`room_id = $${paramCount}`);
        updateValues.push(room_id);
      }

      // Verificar conflitos de horário se alterando horário ou sala
      if (start_time || end_time || room_id) {
        const checkStartTime = start_time || reservation.start_time;
        const checkEndTime = end_time || reservation.end_time;
        const checkRoomId = room_id || reservation.room_id;

        const conflictCheck = await query(`
          SELECT id, title 
          FROM reservations 
          WHERE room_id = $1 
          AND status IN ('approved', 'pending')
          AND (is_active IS NULL OR is_active = true)
          AND id != $2
          AND (
            (start_time <= $3 AND end_time > $3) OR
            (start_time < $4 AND end_time >= $4) OR
            (start_time >= $3 AND end_time <= $4)
          )
        `, [checkRoomId, id, checkStartTime, checkEndTime]);

        if (conflictCheck.rows.length > 0) {
          return res.status(409).json({ 
            error: 'Já existe uma reserva para este horário',
            conflict: conflictCheck.rows[0]
          });
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      // Adicionar updated_at
      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      updateValues.push(new Date().toISOString());

      // Executar atualização
      paramCount++;
      updateValues.push(id);

      const result = await query(`
        UPDATE reservations 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, updateValues);

      const updatedReservation = result.rows[0];

      // Registrar log de auditoria
      await logUpdate(req, 'reservations', parseInt(id), oldValues, updatedReservation);

      // Buscar dados completos da reserva atualizada
      const fullReservation = await query(`
        SELECT 
          r.*,
          u.name as user_name,
          u.email as user_email,
          rm.name as room_name,
          rm.location as room_location,
          approver.name as approved_by_name
        FROM reservations r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN rooms rm ON r.room_id = rm.id
        LEFT JOIN users approver ON r.approved_by = approver.id
        WHERE r.id = $1
      `, [id]);

      return res.status(200).json({
        success: true,
        message: 'Reserva atualizada com sucesso',
        reservation: fullReservation.rows[0]
      });

    } catch (error) {
      console.error('Erro ao atualizar reserva:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else if (req.method === 'DELETE') {
    // Deletar reserva
    try {
      const user_id = req.user.id;
      const user_role = req.user.role;

      // Buscar dados da reserva antes de deletar
      const reservationToDelete = await query(
        'SELECT * FROM reservations WHERE id = $1',
        [id]
      );

      if (reservationToDelete.rows.length === 0) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }

      const reservation = reservationToDelete.rows[0];

      // Verificar permissões
      const canDelete = user_role === 'admin' || reservation.user_id === user_id;

      if (!canDelete) {
        return res.status(403).json({ 
          error: 'Você não tem permissão para deletar esta reserva' 
        });
      }

      // Não permitir deletar se foi aprovada ou rejeitada pelo admin ou professor
      if (reservation.status === 'approved' || reservation.status === 'rejected' || reservation.status === 'professor_approved') {
        return res.status(400).json({ 
          error: 'Não é possível deletar reservas que foram aprovadas ou rejeitadas pelo administrador ou professor' 
        });
      }

      // Verificar se é reserva recorrente
      if (reservation.is_recurring || reservation.recurrence_type) {
        // Para reservas recorrentes, verificar se ainda tem datas futuras
        if (reservation.recurrence_end_date) {
          const recurrenceEndDate = new Date(reservation.recurrence_end_date);
          const now = new Date();
          // Se a data final de recorrência ainda não passou, não pode deletar
          if (recurrenceEndDate >= now) {
            return res.status(400).json({ 
              error: 'Não é possível deletar reservas recorrentes que ainda têm datas futuras' 
            });
          }
        }
      } else {
        // Para reservas únicas, verificar se a reserva já começou
        if (reservation.start_time) {
          const startTime = new Date(reservation.start_time);
          const now = new Date();
          if (startTime <= now) {
            return res.status(400).json({ 
              error: 'Não é possível deletar reservas que já iniciaram' 
        });
          }
        }
      }

      // Deletar reserva
      await query('DELETE FROM reservations WHERE id = $1', [id]);

      // Registrar log de auditoria
      await logDelete(req, 'reservations', parseInt(id), reservation);

      return res.status(200).json({
        success: true,
        message: 'Reserva deletada com sucesso'
      });

    } catch (error) {
      console.error('Erro ao deletar reserva:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

export default authMiddleware(withAuditLog('reservations')(handler));
