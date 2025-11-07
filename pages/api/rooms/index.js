import { authMiddleware, requireRole } from '../../../lib/auth.js';
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
      // Buscar salas - professores veem apenas ativas, admins veem todas
      let queryText;
      if (req.user.role === 'admin') {
        queryText = `SELECT id, name, capacity, location, has_projector, has_internet, 
                            has_air_conditioning, is_fixed_reservation, description, is_active, 
                            created_at, updated_at 
                     FROM rooms 
                     ORDER BY name`;
      } else {
        queryText = `SELECT id, name, capacity, location, has_projector, has_internet, 
                            has_air_conditioning, is_fixed_reservation, description, is_active, 
                            created_at, updated_at 
                     FROM rooms 
                     WHERE is_active = true
                     ORDER BY name`;
      }

      const result = await query(queryText);

      res.status(200).json({
        success: true,
        rooms: result.rows
      });
      return;

    } catch (error) {
      console.error('Erro ao buscar salas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
      return;
    }

  } else if (req.method === 'POST') {
    // Apenas admins podem criar salas
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem criar salas' });
    }
    
    // Criar nova sala
    try {
      const { 
        name, 
        capacity, 
        location, 
        has_projector = false, 
        has_internet = false, 
        has_air_conditioning = false, 
        is_fixed_reservation = false, 
        description = '' 
      } = req.body;

      // Validar dados obrigatórios
      if (!name || !capacity || !location) {
        return res.status(400).json({ error: 'Nome, capacidade e localização são obrigatórios' });
      }

      if (capacity < 1) {
        return res.status(400).json({ error: 'Capacidade deve ser maior que zero' });
      }

      // Verificar se nome já existe
      const nameExists = await query(
        'SELECT id FROM rooms WHERE name = $1',
        [name]
      );

      if (nameExists.rows.length > 0) {
        return res.status(409).json({ error: 'Já existe uma sala com este nome' });
      }

      // Inserir nova sala
      const result = await query(
        `INSERT INTO rooms (name, capacity, location, has_projector, has_internet, 
                           has_air_conditioning, is_fixed_reservation, description) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id, name, capacity, location, has_projector, has_internet, 
                   has_air_conditioning, is_fixed_reservation, description, 
                   is_active, created_at`,
        [name, capacity, location, has_projector, has_internet, 
         has_air_conditioning, is_fixed_reservation, description]
      );

      const newRoom = result.rows[0];

      // Registrar log de auditoria
      await logCreate(req, 'rooms', newRoom.id, {
        name: newRoom.name,
        capacity: newRoom.capacity,
        location: newRoom.location,
        has_projector: newRoom.has_projector,
        has_internet: newRoom.has_internet,
        has_air_conditioning: newRoom.has_air_conditioning,
        is_fixed_reservation: newRoom.is_fixed_reservation,
        description: newRoom.description,
        is_active: newRoom.is_active,
        created_at: newRoom.created_at
      });

      return res.status(201).json({
        success: true,
        message: 'Sala criada com sucesso',
        room: newRoom
      });

    } catch (error) {
      console.error('Erro ao criar sala:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Admins, coordenadores, portaria, professores e alunos podem acessar salas (alunos, professores e portaria só podem ver)
export default requireRole(['admin', 'coordenador', 'portaria', 'professor', 'servidor', 'aluno'])(withAuditLog('rooms')(handler));
