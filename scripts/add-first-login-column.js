const { query } = require('../lib/database-commonjs.js');

const addFirstLoginColumn = async () => {
  try {
    console.log('🔄 Adicionando coluna first_login na tabela users...');
    
    // Verificar se a coluna já existe
    const checkColumn = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'first_login'
    `);

    if (checkColumn.rows.length === 0) {
      // Adicionar a coluna first_login
      await query(`
        ALTER TABLE users 
        ADD COLUMN first_login BOOLEAN DEFAULT true
      `);
      
      console.log('✅ Coluna first_login adicionada com sucesso!');
    } else {
      console.log('ℹ️ Coluna first_login já existe na tabela users');
    }

    // Atualizar usuários existentes para first_login = false (já fizeram login)
    await query(`
      UPDATE users 
      SET first_login = false 
      WHERE first_login IS NULL OR first_login = true
    `);
    
    console.log('✅ Usuários existentes atualizados para first_login = false');
    
  } catch (error) {
    console.error('❌ Erro ao adicionar coluna first_login:', error);
    throw error;
  }
};

// Executar se chamado diretamente
if (require.main === module) {
  addFirstLoginColumn()
    .then(() => {
      console.log('🎉 Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro na execução:', error);
      process.exit(1);
    });
}

module.exports = { addFirstLoginColumn };
