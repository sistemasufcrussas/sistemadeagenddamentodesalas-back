import { authMiddleware, requireRole } from '../../../lib/auth.js';
import { query } from '../../../lib/database.js';
import { withAuditLog, logCreate } from '../../../lib/auditLog.js';
import { sendNewReservationNotification, sendNewReservationForAdminNotification } from '../../../lib/emailService.js';

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
      const { status, user_id, room_id, project_id, start_date, end_date } = req.query;
      
      let whereConditions = [];
      let queryParams = [];
      let paramCount = 0;

      // Construir filtros dinamicamente
      if (status) {
        paramCount++;
        whereConditions.push(`r.status = $${paramCount}`);
        queryParams.push(status);
      }

      if (user_id) {
        // Professores só podem ver suas próprias reservas
        if (req.user.role === 'professor' && parseInt(user_id) !== req.user.id) {
          return res.status(403).json({ error: 'Você só pode visualizar suas próprias reservas' });
        }
        paramCount++;
        whereConditions.push(`r.user_id = $${paramCount}`);
        queryParams.push(user_id);
      }

      if (room_id) {
        paramCount++;
        whereConditions.push(`r.room_id = $${paramCount}`);
        queryParams.push(room_id);
      }

      if (project_id) {
        paramCount++;
        whereConditions.push(`r.project_id = $${paramCount}`);
        queryParams.push(project_id);
      }

      if (start_date) {
        paramCount++;
        whereConditions.push(`r.start_time >= $${paramCount}`);
        queryParams.push(start_date);
      }

      if (end_date) {
        paramCount++;
        whereConditions.push(`r.end_time <= $${paramCount}`);
        queryParams.push(end_date);
      }

      // Professores veem apenas reservas aprovadas por padrão, exceto suas próprias
      if (req.user.role === 'professor' && !status && !user_id) {
        paramCount++;
        whereConditions.push(`r.status = $${paramCount}`);
        queryParams.push('approved');
      }

      // Buscar reservas com informações de usuário, sala, projeto e aprovador
      // Por padrão, filtrar apenas reservas ativas (is_active = true ou NULL)
      // A menos que seja especificado explicitamente no filtro
      if (!req.query.include_inactive) {
        whereConditions.push(`(r.is_active IS NULL OR r.is_active = true)`);
      }

      const finalWhereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      const result = await query(`
        SELECT 
          r.*,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role,
          rm.name as room_name,
          rm.location as room_location,
          rm.capacity as room_capacity,
          p.name as project_name,
          p.type as project_type,
          approver.name as approved_by_name
        FROM reservations r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN rooms rm ON r.room_id = rm.id
        LEFT JOIN projects p ON r.project_id = p.id
        LEFT JOIN users approver ON r.approved_by = approver.id
        ${finalWhereClause}
        ORDER BY r.start_time DESC
      `, queryParams);

      res.status(200).json({
        success: true,
        reservations: result.rows
      });
      return;

    } catch (error) {
      console.error('Erro ao buscar reservas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
      return;
    }

  } else if (req.method === 'POST') {
    // Criar nova reserva
    try {
      const { 
        user_id: requested_user_id,
        room_id,
        project_id,
        title,
        description = '',
        start_time,
        end_time,
        people_count = 1,
        is_recurring = false,
        recurrence_type = null,
        recurrence_end_date = null,
        recurrence_interval = null,
        priority = 1
      } = req.body;

      // Usar o user_id fornecido no corpo da requisição, ou o ID do usuário autenticado como fallback
      const user_id = requested_user_id || req.user.id;
      const user_role = req.user.role;

      // Normalizar e validar IDs numéricos
      const roomId = parseInt(room_id);
      const projectId = (project_id === 0 || project_id) ? parseInt(project_id) : null;
      const peopleCount = parseInt(people_count);

      // Validar dados obrigatórios
      if (!user_id || !roomId || !title || !start_time || !end_time) {
        return res.status(400).json({ 
          error: 'Usuário, sala, título, data/hora de início e fim são obrigatórios' 
        });
      }

      // Validar quantidade de pessoas
      if (!peopleCount || peopleCount < 1) {
        return res.status(400).json({ 
          error: 'Quantidade de pessoas deve ser pelo menos 1' 
        });
      }

      // Para alunos, projeto é obrigatório
      if (user_role === 'aluno' && !projectId) {
        return res.status(400).json({ 
          error: 'Projeto é obrigatório para alunos' 
        });
      }

      // Se um user_id específico foi fornecido, verificar se o usuário existe
      if (requested_user_id) {
        const userCheck = await query(
          'SELECT id, name FROM users WHERE id = $1',
          [requested_user_id]
        );

        if (userCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Usuário não encontrado' });
        }
      }

      // Validar se a data de fim é posterior à data de início
      if (new Date(end_time) <= new Date(start_time)) {
        return res.status(400).json({ 
          error: 'Data/hora de fim deve ser posterior à data/hora de início' 
        });
      }

      // Função para extrair dados de recorrência da descrição
      const extractRecurrenceData = (description) => {
        try {
          const daysMatch = description?.match(/• Dias da semana: \[([^\]]+)\]/);
          const schedulesMatch = description?.match(/• Horários: ({.*})/);
          
          const recurrenceDays = daysMatch ? daysMatch[1].split(', ').map(d => d.trim()) : [];
          const weeklySchedules = schedulesMatch ? JSON.parse(schedulesMatch[1]) : {};
          
          return { recurrenceDays, weeklySchedules };
        } catch (e) {
          return { recurrenceDays: [], weeklySchedules: {} };
        }
      };

      // Função para gerar todas as ocorrências de uma reserva recorrente
      const generateRecurrenceOccurrences = (reservation) => {
        if (!reservation.is_recurring) {
          return [{
            start: new Date(reservation.start_time),
            end: new Date(reservation.end_time)
          }];
        }

        const occurrences = [];
        const startDate = new Date(reservation.start_time);
        const endDate = new Date(reservation.recurrence_end_date);
        const { recurrenceDays, weeklySchedules } = extractRecurrenceData(reservation.description);

        if (recurrenceDays.length === 0) {
          // Fallback: usar dados da reserva original
          return [{
            start: new Date(reservation.start_time),
            end: new Date(reservation.end_time)
          }];
        }

        const currentDate = new Date(startDate);
        let weekCount = 0;

        while (currentDate <= endDate && weekCount < 200) {
          for (const dayOfWeek of recurrenceDays) {
            const daySchedule = weeklySchedules[dayOfWeek];
            if (!daySchedule) continue;

            const targetDate = new Date(currentDate);
            const currentDayOfWeek = targetDate.getDay();
            const targetDayOfWeek = parseInt(dayOfWeek);
            const daysToAdd = (targetDayOfWeek - currentDayOfWeek + 7) % 7;
            targetDate.setDate(targetDate.getDate() + daysToAdd);

            if (targetDate >= startDate && targetDate <= endDate) {
              const occurrenceStart = new Date(targetDate);
              const occurrenceEnd = new Date(targetDate);

              const [startHour, startMin] = daySchedule.start_time.split(':');
              const [endHour, endMin] = daySchedule.end_time.split(':');

              occurrenceStart.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
              occurrenceEnd.setHours(parseInt(endHour), parseInt(endMin), 0, 0);

              occurrences.push({
                start: occurrenceStart,
                end: occurrenceEnd
              });
            }
          }
          currentDate.setDate(currentDate.getDate() + 7);
          weekCount++;
        }

        return occurrences;
      };

      // Função para verificar se dois períodos se sobrepõem
      const timesOverlap = (start1, end1, start2, end2) => {
        return start1 < end2 && start2 < end1;
      };

      // Verificar se a sala existe e está ativa
      const roomCheck = await query(
        'SELECT id, name, is_active, capacity FROM rooms WHERE id = $1',
        [roomId]
      );

      if (roomCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Sala não encontrada' });
      }

      if (!roomCheck.rows[0].is_active) {
        return res.status(400).json({ error: 'Sala não está ativa' });
      }

      // Verificar se a quantidade de pessoas não excede a capacidade da sala
      const roomCapacity = roomCheck.rows[0].capacity;
      if (peopleCount > roomCapacity) {
        return res.status(400).json({ 
          error: `A quantidade de pessoas (${peopleCount}) excede a capacidade da sala (${roomCapacity} pessoas)` 
        });
      }

      // Verificar se o usuário é aluno e tem projeto associado
      if (user_role === 'aluno') {
        const projectCheck = await query(`
          SELECT ps.id, p.name as project_name, p.type as project_type
          FROM project_students ps
          LEFT JOIN projects p ON ps.project_id = p.id
          WHERE ps.student_id = $1 AND ps.project_id = $2
        `, [user_id, projectId]);

        if (projectCheck.rows.length === 0) {
          return res.status(400).json({ 
            error: 'Aluno não está associado ao projeto selecionado' 
          });
        }
      }

      // Verificar conflitos com outras reservas aprovadas na mesma sala (excluindo desativadas)
      const existingReservations = await query(`
        SELECT id, title, start_time, end_time, is_recurring, recurrence_end_date, description
        FROM reservations 
        WHERE room_id = $1 
        AND status IN ('approved', 'pending')
        AND (is_active IS NULL OR is_active = true)
        AND (
          (is_recurring = false AND start_time < $3 AND end_time > $2) OR
          (is_recurring = true AND recurrence_end_date >= $2 AND start_time <= $3)
        )
      `, [roomId, start_time, end_time]);

      // Preparar dados da nova reserva para verificação de conflitos
      const newReservationData = {
        start_time,
        end_time,
        is_recurring,
        recurrence_end_date,
        description: is_recurring ? 
          `${description}\n\n📊 Dados técnicos:\n• Dias da semana: [${req.body.recurrence_days?.join(', ') || ''}]\n• Horários: ${JSON.stringify(req.body.weekly_schedules || {})}` :
          description
      };

      // Gerar ocorrências da nova reserva
      const newOccurrences = generateRecurrenceOccurrences(newReservationData);

      // Verificar conflitos com reservas existentes
      for (const existingReservation of existingReservations.rows) {
        const existingOccurrences = generateRecurrenceOccurrences(existingReservation);
        
        for (const newOcc of newOccurrences) {
          for (const existingOcc of existingOccurrences) {
            if (timesOverlap(newOcc.start, newOcc.end, existingOcc.start, existingOcc.end)) {
              const conflictDate = newOcc.start.toLocaleDateString('pt-BR');
              const conflictTimeNew = `${newOcc.start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} - ${newOcc.end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`;
              const conflictTimeExisting = `${existingOcc.start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} - ${existingOcc.end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`;
              
              return res.status(409).json({ 
                error: `Conflito de horário detectado!\n\nData: ${conflictDate}\nSua reserva: ${conflictTimeNew}\nReserva existente: "${existingReservation.title}" (${conflictTimeExisting})\n\nEscolha outro horário ou sala.`
              });
            }
          }
        }
      }


      // Determinar status inicial baseado no papel do usuário
      let initialStatus = 'pending';
      let approved_by = null;
      let approved_at = null;

      // Administradores e coordenadores podem aprovar automaticamente
      if (user_role === 'admin') {
        initialStatus = 'approved';
        approved_by = user_id;
        approved_at = new Date().toISOString();
      } else if (user_role === 'coordenador') {
        // Coordenadores podem aprovar automaticamente (lógica especial)
        initialStatus = 'approved';
        approved_by = user_id;
        approved_at = new Date().toISOString();
      } else if (user_role === 'aluno') {
        // Para alunos: se o projeto tem professor responsável, vai para o professor; se não, vai direto para admin
        if (projectId) {
          const proj = await query('SELECT professor_id FROM projects WHERE id = $1', [projectId]);
          const hasProfessor = proj.rows.length > 0 && proj.rows[0].professor_id;
          if (hasProfessor) {
            // Fica pendente para aprovação do professor
            initialStatus = 'pending';
          } else {
            // Sem professor responsável → admin trata diretamente após notificação
            initialStatus = 'pending';
          }
        } else {
          initialStatus = 'pending';
        }
        approved_by = null;
        approved_at = null;
      }

      // Inserir nova reserva
      const result = await query(`
        INSERT INTO reservations (
          user_id, room_id, project_id, title, description, start_time, end_time,
          people_count, status, is_recurring, recurrence_type, recurrence_end_date, recurrence_interval,
          approved_by, approved_at, priority
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [
        user_id, roomId, projectId, title, description, start_time, end_time,
        peopleCount, initialStatus, is_recurring, recurrence_type, recurrence_end_date, recurrence_interval,
        approved_by, approved_at, priority
      ]);

      const newReservation = result.rows[0];

      // Registrar log de auditoria
      await logCreate(req, 'reservations', newReservation.id, {
        user_id: newReservation.user_id,
        room_id: newReservation.room_id,
        title: newReservation.title,
        start_time: newReservation.start_time,
        end_time: newReservation.end_time,
        status: newReservation.status,
        is_recurring: newReservation.is_recurring,
        created_at: newReservation.created_at
      });

      // Buscar dados completos da reserva criada
      const fullReservation = await query(`
        SELECT 
          r.*,
          u.name as user_name,
          u.email as user_email,
          rm.name as room_name,
          rm.location as room_location,
          p.name as project_name,
          p.type as project_type,
          prof.name as professor_name,
          prof.email as professor_email
        FROM reservations r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN rooms rm ON r.room_id = rm.id
        LEFT JOIN projects p ON r.project_id = p.id
        LEFT JOIN users prof ON p.professor_id = prof.id
        WHERE r.id = $1
      `, [newReservation.id]);

      const reservationData = fullReservation.rows[0];

      // Enviar notificações por email
      try {
        if (initialStatus === 'pending' && reservationData.professor_email) {
          // Notificar professor se a reserva precisa de aprovação
          await sendNewReservationNotification({
            title: reservationData.title,
            student_name: reservationData.user_name,
            room_name: reservationData.room_name,
            start_time: reservationData.start_time,
            end_time: reservationData.end_time,
            project_name: reservationData.project_name,
            description: reservationData.description,
            professor_name: reservationData.professor_name
          }, reservationData.professor_email);
        } else if (initialStatus === 'pending' && !reservationData.professor_email) {
          // Notificar admin se não há professor responsável
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
              professor_name: 'Sistema'
            }, adminResult.rows[0].email);
          }
        }
      } catch (emailError) {
        console.error('Erro ao enviar email de notificação:', emailError);
        // Não falhar a criação da reserva por erro de email
      }

      res.status(201).json({
        success: true,
        message: initialStatus === 'approved' 
          ? 'Reserva criada e aprovada automaticamente'
          : 'Reserva criada e enviada para aprovação',
        reservation: reservationData
      });
      return;

    } catch (error) {
      console.error('Erro ao criar reserva:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
      return;
    }

  } else {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }
}

// Usuários autenticados podem ver e criar reservas
export default authMiddleware(withAuditLog('reservations')(handler));
