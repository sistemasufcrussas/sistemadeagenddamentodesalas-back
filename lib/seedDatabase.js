import { query } from './database.js';
import { hashPassword } from './auth.js';

// Dados dos usuários padrão
const defaultUsers = [
  {
    name: 'Administrador',
    email: 'admin@siru.com',
    siape: '000000',
    password: 'admin123',
    role: 'admin'
  },
  {
    name: 'João Silva',
    email: 'joao.silva@universidade.edu',
    siape: '123456',
    password: 'professor123',
    role: 'professor'
  },
  {
    name: 'Maria Santos',
    email: 'maria.santos@universidade.edu',
    siape: '654321',
    password: 'coordenador123',
    role: 'coordenador'
  },
  {
    name: 'Pedro Costa',
    email: 'pedro.costa@aluno.universidade.edu',
    siape: '111111',
    password: 'aluno123',
    role: 'aluno'
  },
  {
    name: 'Ana Oliveira',
    email: 'ana.oliveira@universidade.edu',
    siape: '222222',
    password: 'portaria123',
    role: 'portaria'
  },
  {
    name: 'Lucia Mendes',
    email: 'lucia.mendes@universidade.edu',
    siape: '444444',
    password: 'servidor123',
    role: 'servidor'
  }
];

// Dados das salas padrão
const defaultRooms = [
  {
    name: 'Auditório Principal',
    capacity: 200,
    location: 'Bloco A - Térreo',
    has_projector: true,
    has_internet: true,
    has_air_conditioning: true,
    is_fixed_reservation: false,
    description: 'Auditório principal com sistema de som e videoconferência'
  },
  {
    name: 'Sala de Aula 101',
    capacity: 40,
    location: 'Bloco A - 1º Andar',
    has_projector: true,
    has_internet: true,
    has_air_conditioning: false,
    is_fixed_reservation: false,
    description: 'Sala de aula padrão com projetor'
  },
  {
    name: 'Laboratório de Informática 1',
    capacity: 30,
    location: 'Bloco B - 2º Andar',
    has_projector: true,
    has_internet: true,
    has_air_conditioning: true,
    is_fixed_reservation: false,
    description: 'Laboratório com 30 computadores'
  },
  {
    name: 'Sala de Reuniões Executiva',
    capacity: 12,
    location: 'Bloco A - 3º Andar',
    has_projector: false,
    has_internet: true,
    has_air_conditioning: true,
    is_fixed_reservation: true,
    description: 'Sala de reuniões para diretoria - reserva fixa'
  },
  {
    name: 'Sala de Videoconferência',
    capacity: 20,
    location: 'Bloco C - 1º Andar',
    has_projector: true,
    has_internet: true,
    has_air_conditioning: true,
    is_fixed_reservation: false,
    description: 'Sala equipada para videoconferências'
  },
  {
    name: 'Sala de Estudos 201',
    capacity: 8,
    location: 'Bloco B - 2º Andar',
    has_projector: false,
    has_internet: true,
    has_air_conditioning: false,
    is_fixed_reservation: false,
    description: 'Sala pequena para grupos de estudo'
  }
];

// Função para popular o banco com dados iniciais
export const seedDatabase = async () => {
  try {
    console.log('🌱 Iniciando seed do banco de dados...');

    // Verificar se já existem usuários
    const existingUsers = await query('SELECT COUNT(*) FROM users');
    if (existingUsers.rows[0].count > 0) {
      console.log('✅ Usuários já existem no banco. Seed não necessário.');
      return;
    }

    // Inserir usuários padrão
    console.log('👥 Criando usuários padrão...');
    for (const user of defaultUsers) {
      const hashedPassword = await hashPassword(user.password);
      await query(
        `INSERT INTO users (name, email, siape, password_hash, role) 
         VALUES ($1, $2, $3, $4, $5)`,
        [user.name, user.email, user.siape, hashedPassword, user.role]
      );
      console.log(`   ✓ Usuário criado: ${user.name} (${user.role})`);
    }

    // Inserir salas padrão
    console.log('🏢 Criando salas padrão...');
    for (const room of defaultRooms) {
      await query(
        `INSERT INTO rooms (name, capacity, location, has_projector, has_internet, has_air_conditioning, is_fixed_reservation, description) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [room.name, room.capacity, room.location, room.has_projector, room.has_internet, room.has_air_conditioning, room.is_fixed_reservation, room.description]
      );
      console.log(`   ✓ Sala criada: ${room.name}`);
    }

    console.log('🎉 Seed do banco de dados concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante o seed do banco:', error);
    throw error;
  }
};
