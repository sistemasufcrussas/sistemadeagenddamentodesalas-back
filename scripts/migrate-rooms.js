// Script para migrar a estrutura da tabela rooms
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

const migrateRooms = async () => {
  try {
    console.log('🔄 Iniciando migração da tabela rooms...');

    // Verificar se as novas colunas já existem
    const columnsCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'rooms' AND column_name IN ('has_projector', 'has_internet', 'has_air_conditioning', 'is_fixed_reservation', 'description', 'updated_at')
    `);

    const existingNewColumns = columnsCheck.rows.map(row => row.column_name);
    console.log('Colunas novas existentes:', existingNewColumns);

    // Adicionar novas colunas se não existirem
    const newColumns = [
      { name: 'has_projector', type: 'BOOLEAN DEFAULT false' },
      { name: 'has_internet', type: 'BOOLEAN DEFAULT false' },
      { name: 'has_air_conditioning', type: 'BOOLEAN DEFAULT false' },
      { name: 'is_fixed_reservation', type: 'BOOLEAN DEFAULT false' },
      { name: 'description', type: 'TEXT' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
    ];

    for (const column of newColumns) {
      if (!existingNewColumns.includes(column.name)) {
        console.log(`➕ Adicionando coluna: ${column.name}`);
        await query(`ALTER TABLE rooms ADD COLUMN ${column.name} ${column.type}`);
      } else {
        console.log(`✅ Coluna ${column.name} já existe`);
      }
    }

    // Migrar dados da coluna equipment (se existir) para as novas colunas
    const equipmentCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'rooms' AND column_name = 'equipment'
    `);

    if (equipmentCheck.rows.length > 0) {
      console.log('🔄 Migrando dados da coluna equipment...');
      
      // Buscar salas com equipment
      const roomsWithEquipment = await query('SELECT id, name, equipment FROM rooms WHERE equipment IS NOT NULL');
      
      for (const room of roomsWithEquipment.rows) {
        const equipment = room.equipment || [];
        const updates = {
          has_projector: equipment.includes('projetor') || equipment.includes('projector'),
          has_internet: equipment.includes('internet') || equipment.includes('wifi'),
          has_air_conditioning: equipment.includes('ar-condicionado') || equipment.includes('ac'),
          is_fixed_reservation: false // Definir manualmente se necessário
        };

        await query(`
          UPDATE rooms 
          SET has_projector = $1, has_internet = $2, has_air_conditioning = $3, is_fixed_reservation = $4, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `, [updates.has_projector, updates.has_internet, updates.has_air_conditioning, updates.is_fixed_reservation, room.id]);

        console.log(`   ✓ Migrado: ${room.name}`);
      }

      // Remover a coluna equipment antiga
      console.log('🗑️ Removendo coluna equipment antiga...');
      await query('ALTER TABLE rooms DROP COLUMN equipment');
    }

    console.log('✅ Migração da tabela rooms concluída!');

    // Verificar estrutura final
    const finalColumns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'rooms' 
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Estrutura final da tabela rooms:');
    finalColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    process.exit(0);

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
};

migrateRooms();
