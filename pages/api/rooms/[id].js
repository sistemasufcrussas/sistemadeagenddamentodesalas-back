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
    // Buscar sala específica
    try {
      const result = await query(
        `SELECT id, name, capacity, location, has_projector, has_internet, 
                has_air_conditioning, is_fixed_reservation, description, is_active, 
                created_at, updated_at 
         FROM rooms WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Sala não encontrada' });
      }

      return res.status(200).json({
        success: true,
        room: result.rows[0]
      });

    } catch (error) {
      console.error('Erro ao buscar sala:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else if (req.method === 'PUT') {
    // Atualizar sala
    try {
      const { 
        name, 
        capacity, 
        location, 
        has_projector = false, 
        has_internet = false, 
        has_air_conditioning = false, 
        is_fixed_reservation = false, 
        description = '',
        is_active = true
      } = req.body;

      // Validar dados obrigatórios
      if (!name || !capacity || !location) {
        return res.status(400).json({ error: 'Nome, capacidade e localização são obrigatórios' });
      }

      if (capacity < 1) {
        return res.status(400).json({ error: 'Capacidade deve ser maior que zero' });
      }

      // Buscar dados atuais da sala para o log
      const currentRoomResult = await query(
        `SELECT id, name, capacity, location, has_projector, has_internet, 
                has_air_conditioning, is_fixed_reservation, description, is_active 
         FROM rooms WHERE id = $1`,
        [id]
      );

      if (currentRoomResult.rows.length === 0) {
        return res.status(404).json({ error: 'Sala não encontrada' });
      }

      const oldValues = currentRoomResult.rows[0];

      // Verificar se nome já existe (exceto a própria sala)
      const nameExists = await query(
        'SELECT id FROM rooms WHERE name = $1 AND id != $2',
        [name, id]
      );

      if (nameExists.rows.length > 0) {
        return res.status(409).json({ error: 'Já existe uma sala com este nome' });
      }

      // Atualizar sala
      const result = await query(
        `UPDATE rooms 
         SET name = $1, capacity = $2, location = $3, has_projector = $4, 
             has_internet = $5, has_air_conditioning = $6, is_fixed_reservation = $7, 
             description = $8, is_active = $9, updated_at = CURRENT_TIMESTAMP
         WHERE id = $10 
         RETURNING id, name, capacity, location, has_projector, has_internet, 
                   has_air_conditioning, is_fixed_reservation, description, 
                   is_active, created_at, updated_at`,
        [name, capacity, location, has_projector, has_internet, 
         has_air_conditioning, is_fixed_reservation, description, is_active, id]
      );

      const updatedRoom = result.rows[0];

      // Registrar log de auditoria
      await logUpdate(req, 'rooms', parseInt(id), oldValues, {
        name: updatedRoom.name,
        capacity: updatedRoom.capacity,
        location: updatedRoom.location,
        has_projector: updatedRoom.has_projector,
        has_internet: updatedRoom.has_internet,
        has_air_conditioning: updatedRoom.has_air_conditioning,
        is_fixed_reservation: updatedRoom.is_fixed_reservation,
        description: updatedRoom.description,
        is_active: updatedRoom.is_active,
        updated_at: updatedRoom.updated_at
      });

      return res.status(200).json({
        success: true,
        message: 'Sala atualizada com sucesso',
        room: updatedRoom
      });

    } catch (error) {
      console.error('Erro ao atualizar sala:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else if (req.method === 'DELETE') {
    // Deletar sala (soft delete)
    try {
      // Verificar se a sala tem reservas futuras
      const hasReservations = await query(
        `SELECT COUNT(*) as count 
         FROM reservations 
         WHERE room_id = $1 AND start_time > CURRENT_TIMESTAMP`,
        [id]
      );

      if (parseInt(hasReservations.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Não é possível deletar sala com reservas futuras. Desative a sala ao invés de deletá-la.' 
        });
      }

      // Buscar dados da sala antes de deletar para o log
      const roomToDelete = await query(
        `SELECT id, name, capacity, location, has_projector, has_internet, 
                has_air_conditioning, is_fixed_reservation, description, is_active 
         FROM rooms WHERE id = $1`,
        [id]
      );

      if (roomToDelete.rows.length === 0) {
        return res.status(404).json({ error: 'Sala não encontrada' });
      }

      const deletedRoomData = roomToDelete.rows[0];

      // Fazer soft delete (desativar ao invés de deletar)
      const result = await query(
        `UPDATE rooms 
         SET is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING id, name`,
        [id]
      );

      // Registrar log de auditoria
      await logUpdate(req, 'rooms', parseInt(id), deletedRoomData, {
        ...deletedRoomData,
        is_active: false,
        updated_at: new Date().toISOString()
      });

      return res.status(200).json({
        success: true,
        message: 'Sala desativada com sucesso',
        room: result.rows[0]
      });

    } catch (error) {
      console.error('Erro ao deletar sala:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Apenas admins podem gerenciar salas
export default requireRole(['admin'])(withAuditLog('rooms')(handler));
