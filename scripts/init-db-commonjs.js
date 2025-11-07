// Script para inicializar o banco de dados usando CommonJS
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Configuração da conexão
const databaseUrl = process.env.DATABASE_URL?.replace(/&?channel_binding=require/, '') || 
  "postgresql://neondb_owner:npg_wI4NJHKXF2lZ@ep-dark-bird-ad71s1dg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

// Função para executar queries
const query = async (text, params) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('Erro na query do banco:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Função para testar a conexão
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Conexão com banco estabelecida:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão com banco:', error.message);
    return false;
  }
};

// Função para inicializar o banco de dados
const initializeDatabase = async () => {
  try {
    // Criar tabela de usuários se não existir
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        siape VARCHAR(20) UNIQUE,
        matricula_sigaa VARCHAR(20) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'professor',
        first_login BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela de salas se não existir
    await query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        capacity INTEGER NOT NULL,
        location VARCHAR(255),
        has_projector BOOLEAN DEFAULT false,
        has_internet BOOLEAN DEFAULT false,
        has_air_conditioning BOOLEAN DEFAULT false,
        is_fixed_reservation BOOLEAN DEFAULT false,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela de reservas se não existir
    await query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        room_id INTEGER REFERENCES rooms(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela de projetos
    await query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        professor_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela de relacionamento projeto-aluno
    await query(`
      CREATE TABLE IF NOT EXISTS project_students (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, student_id)
      )
    `);

    // Criar tabela de logs de auditoria
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(100) NOT NULL,
        record_id INTEGER NOT NULL,
        action VARCHAR(20) NOT NULL,
        old_values JSONB,
        new_values JSONB,
        user_id INTEGER REFERENCES users(id),
        user_email VARCHAR(255),
        user_name VARCHAR(255),
        user_role VARCHAR(50),
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar índices para melhor performance nos logs
    await query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    `);

    // Criar índices para projetos
    await query(`
      CREATE INDEX IF NOT EXISTS idx_projects_professor_id ON projects(professor_id);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_project_students_project_id ON project_students(project_id);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_project_students_student_id ON project_students(student_id);
    `);

    console.log('✅ Tabelas do banco de dados criadas/verificadas com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
};

// Dados dos usuários padrão
const defaultUsers = [
  {
    name: 'Administrador do Sistema',
    email: 'admin@siru.com',
    siape: '000000',
    password: 'admin123',
    role: 'admin'
  },
  {
    name: 'João Silva',
    email: 'joao.silva@universidade.edu',
    siape: '111111',
    password: 'professor123',
    role: 'professor'
  },
  {
    name: 'Maria Santos',
    email: 'maria.santos@universidade.edu',
    siape: '222222',
    password: 'coordenador123',
    role: 'coordenador'
  },
  {
    name: 'Pedro Costa',
    email: 'pedro.costa@aluno.universidade.edu',
    siape: '333333',
    password: 'aluno123',
    role: 'aluno'
  },
  {
    name: 'Ana Oliveira',
    email: 'ana.oliveira@universidade.edu',
    siape: '555555',
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
const seedDatabase = async () => {
  try {
    console.log('🌱 Iniciando seed do banco de dados...');

    // Verificar se já existem usuários
    const existingUsers = await query('SELECT COUNT(*) as count FROM users');
    if (parseInt(existingUsers.rows[0].count) > 0) {
      console.log('⚠️ Usuários já existem, pulando criação de usuários padrão...');
    } else {
      // Inserir usuários padrão
      console.log('👥 Criando usuários padrão...');
      for (const user of defaultUsers) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await query(
          `INSERT INTO users (name, email, siape, password_hash, role) 
           VALUES ($1, $2, $3, $4, $5)`,
          [user.name, user.email, user.siape, hashedPassword, user.role]
        );
        console.log(`   ✓ Usuário criado: ${user.name} (${user.role})`);
      }
    }

    // Verificar se já existem salas
    const existingRooms = await query('SELECT COUNT(*) as count FROM rooms');
    if (parseInt(existingRooms.rows[0].count) > 0) {
      console.log('⚠️ Salas já existem, pulando criação de salas padrão...');
    } else {
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
    }

    console.log('🎉 Seed do banco de dados concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante o seed do banco:', error);
    throw error;
  }
};

const initDB = async () => {
  try {
    console.log('🚀 Inicializando banco de dados...');

    // Testar conexão
    console.log('📡 Testando conexão...');
    const connectionOk = await testConnection();
    if (!connectionOk) {
      throw new Error('Falha na conexão com o banco de dados');
    }

    // Inicializar estrutura do banco
    console.log('🏗️ Criando/atualizando tabelas...');
    await initializeDatabase();

    // Popular com dados iniciais
    console.log('🌱 Populando banco com dados iniciais...');
    await seedDatabase();

    console.log('✅ Banco de dados inicializado com sucesso!');
    console.log('');
    console.log('👥 Usuários disponíveis:');
    console.log('   • Admin: admin@siru.com / admin123');
    console.log('   • Professor: joao.silva@universidade.edu / professor123');
    console.log('   • Servidor: lucia.mendes@universidade.edu / servidor123');
    console.log('   • Coordenador: maria.santos@universidade.edu / coordenador123');
    console.log('   • Aluno: pedro.costa@aluno.universidade.edu / aluno123');
    console.log('   • Portaria: ana.oliveira@universidade.edu / portaria123');
    console.log('');
    console.log('🏢 Salas criadas: 6 salas com diferentes recursos');
    console.log('');
    console.log('🎉 Pronto para uso!');

    process.exit(0);

  } catch (error) {
    console.error('❌ Erro na inicialização:', error.message);
    console.error('🔧 Detalhes:', error);
    process.exit(1);
  }
};

// Executar inicialização
initDB();
