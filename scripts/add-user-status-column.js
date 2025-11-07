const { query } = require('../lib/database-commonjs.js');

const addUserStatusColumn = async () => {
  try {
    console.log('🔄 Adicionando coluna status na tabela users...');
    
    // Verificar se a coluna já existe
    const checkColumn = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'status'
    `);

    if (checkColumn.rows.length === 0) {
      // Adicionar a coluna status
      await query(`
        ALTER TABLE users 
        ADD COLUMN status VARCHAR(20) DEFAULT 'approved'
      `);
      
      console.log('✅ Coluna status adicionada com sucesso!');
    } else {
      console.log('ℹ️ Coluna status já existe na tabela users');
    }

    // Atualizar usuários existentes para status = 'approved'
    await query(`
      UPDATE users 
      SET status = 'approved' 
      WHERE status IS NULL
    `);
    
    console.log('✅ Usuários existentes atualizados para status = approved');
    
  } catch (error) {
    console.error('❌ Erro ao adicionar coluna status:', error);
    throw error;
  }
};

// Executar se chamado diretamente
if (require.main === module) {
  addUserStatusColumn()
    .then(() => {
      console.log('🎉 Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro na execução:', error);
      process.exit(1);
    });
}

module.exports = { addUserStatusColumn };
