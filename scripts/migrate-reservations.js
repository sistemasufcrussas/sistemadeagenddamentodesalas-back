// Script para migrar a estrutura da tabela reservations e adicionar dados de exemplo
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL?.replace(/&?channel_binding=require/, '') || 
  "postgresql://neondb_owner:npg_wI4NJHKXF2lZ@ep-dark-bird-ad71s1dg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

const query = async (text, params) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('Erro na query:', error);
    throw error;
  } finally {
    client.release();
  }
};

const migrateReservations = async () => {
  try {
    console.log('🔄 Iniciando migração da tabela reservations...');

    // Verificar se as novas colunas já existem
    const columnsCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'reservations' AND column_name IN (
        'is_recurring', 'recurrence_type', 'recurrence_end_date', 
        'approved_by', 'approved_at', 'rejection_reason', 'priority'
      )
    `);

    const existingNewColumns = columnsCheck.rows.map(row => row.column_name);
    console.log('Colunas novas existentes:', existingNewColumns);

    // Adicionar novas colunas se não existirem
    const newColumns = [
      { name: 'is_recurring', type: 'BOOLEAN DEFAULT false' },
      { name: 'recurrence_type', type: 'VARCHAR(20)' },
      { name: 'recurrence_end_date', type: 'TIMESTAMP' },
      { name: 'approved_by', type: 'INTEGER REFERENCES users(id)' },
      { name: 'approved_at', type: 'TIMESTAMP' },
      { name: 'rejection_reason', type: 'TEXT' },
      { name: 'priority', type: 'INTEGER DEFAULT 1' }
    ];

    for (const column of newColumns) {
      if (!existingNewColumns.includes(column.name)) {
        console.log(`➕ Adicionando coluna: ${column.name}`);
        await query(`ALTER TABLE reservations ADD COLUMN ${column.name} ${column.type}`);
      } else {
        console.log(`✅ Coluna ${column.name} já existe`);
      }
    }

    console.log('✅ Migração da tabela reservations concluída!');

    // Verificar estrutura final
    const finalColumns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'reservations' 
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Estrutura final da tabela reservations:');
    finalColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    // Adicionar reservas de exemplo
    console.log('\n🌱 Adicionando reservas de exemplo...');
    
    // Buscar IDs de usuários e salas
    const usersResult = await query('SELECT id, name, role FROM users ORDER BY id LIMIT 5');
    const roomsResult = await query('SELECT id, name FROM rooms WHERE is_active = true ORDER BY id LIMIT 3');
    
    if (usersResult.rows.length === 0 || roomsResult.rows.length === 0) {
      console.log('⚠️ Não há usuários ou salas suficientes para criar reservas de exemplo');
      return;
    }

    const users = usersResult.rows;
    const rooms = roomsResult.rows;

    // Verificar se já existem reservas
    const existingReservations = await query('SELECT COUNT(*) as count FROM reservations');
    if (parseInt(existingReservations.rows[0].count) > 0) {
      console.log('⚠️ Já existem reservas, pulando criação de exemplos...');
      return;
    }

    // Criar reservas de exemplo
    const sampleReservations = [
      {
        user_id: users.find(u => u.role === 'professor')?.id || users[1].id,
        room_id: rooms[0].id,
        title: 'Aula de Programação Avançada',
        description: 'Aula sobre estruturas de dados e algoritmos',
        start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Amanhã
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // +2h
        status: 'pending',
        priority: 1
      },
      {
        user_id: users.find(u => u.role === 'aluno')?.id || users[2].id,
        room_id: rooms[1].id,
        title: 'Reunião do Grupo de Estudos',
        description: 'Discussão sobre projeto final da disciplina',
        start_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Depois de amanhã
        end_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(), // +1.5h
        status: 'pending',
        priority: 1
      },
      {
        user_id: users.find(u => u.role === 'coordenador')?.id || users[0].id,
        room_id: rooms[2].id,
        title: 'Reunião de Coordenação Mensal',
        description: 'Reunião mensal para planejamento acadêmico',
        start_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // Em 3 dias
        end_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), // +3h
        status: 'approved', // Coordenador tem aprovação automática
        approved_by: users.find(u => u.role === 'coordenador')?.id || users[0].id,
        approved_at: new Date().toISOString(),
        priority: 2,
        is_recurring: true,
        recurrence_type: 'monthly',
        recurrence_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 ano
      },
      {
        user_id: users[1].id,
        room_id: rooms[0].id,
        title: 'Workshop de Tecnologia',
        description: 'Workshop sobre novas tecnologias em desenvolvimento',
        start_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Em 1 semana
        end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(), // +4h
        status: 'pending',
        priority: 2
      }
    ];

    for (const reservation of sampleReservations) {
      await query(`
        INSERT INTO reservations (
          user_id, room_id, title, description, start_time, end_time,
          status, approved_by, approved_at, priority, is_recurring,
          recurrence_type, recurrence_end_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        reservation.user_id,
        reservation.room_id,
        reservation.title,
        reservation.description,
        reservation.start_time,
        reservation.end_time,
        reservation.status,
        reservation.approved_by || null,
        reservation.approved_at || null,
        reservation.priority,
        reservation.is_recurring || false,
        reservation.recurrence_type || null,
        reservation.recurrence_end_date || null
      ]);

      console.log(`   ✓ Reserva criada: ${reservation.title}`);
    }

    console.log('\n🎉 Migração e seed de reservations concluído com sucesso!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
};

migrateReservations();
