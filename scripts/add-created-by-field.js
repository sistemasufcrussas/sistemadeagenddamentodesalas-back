const { query } = require('../lib/database-commonjs.js');

const addCreatedByField = async () => {
  try {
    console.log('🔄 Adicionando campo created_by na tabela users...');
    
    // Verificar se a coluna created_by já existe
    const checkCreatedBy = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'created_by'
    `);

    if (checkCreatedBy.rows.length === 0) {
      // Adicionar a coluna created_by
      await query(`
        ALTER TABLE users 
        ADD COLUMN created_by INTEGER REFERENCES users(id)
      `);
      console.log('✅ Coluna created_by adicionada!');
    } else {
      console.log('ℹ️ Coluna created_by já existe');
    }

    // Adicionar índice para melhor performance
    try {
      await query(`
        CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by)
      `);
      console.log('✅ Índice para created_by criado!');
    } catch (error) {
      console.log('ℹ️ Índice para created_by já existe ou erro:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro ao adicionar campo created_by:', error);
    throw error;
  }
};

// Executar se chamado diretamente
if (require.main === module) {
  addCreatedByField()
    .then(() => {
      console.log('🎉 Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro na execução:', error);
      process.exit(1);
    });
}

module.exports = { addCreatedByField };
