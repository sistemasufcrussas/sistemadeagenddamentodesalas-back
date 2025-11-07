const { query } = require('../lib/database-commonjs.js');

const addStudentFields = async () => {
  try {
    console.log('🔄 Adicionando campos para alunos na tabela users...');
    
    // Verificar se a coluna first_login já existe
    const checkFirstLogin = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'first_login'
    `);

    if (checkFirstLogin.rows.length === 0) {
      // Adicionar a coluna first_login
      await query(`
        ALTER TABLE users 
        ADD COLUMN first_login BOOLEAN DEFAULT true
      `);
      console.log('✅ Coluna first_login adicionada!');
    } else {
      console.log('ℹ️ Coluna first_login já existe');
    }

    // Verificar se a coluna matricula_sigaa já existe
    const checkMatricula = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'matricula_sigaa'
    `);

    if (checkMatricula.rows.length === 0) {
      // Adicionar a coluna matricula_sigaa
      await query(`
        ALTER TABLE users 
        ADD COLUMN matricula_sigaa VARCHAR(20) UNIQUE
      `);
      console.log('✅ Coluna matricula_sigaa adicionada!');
    } else {
      console.log('ℹ️ Coluna matricula_sigaa já existe');
    }

    // Tornar siape opcional (remover NOT NULL se existir)
    try {
      await query(`
        ALTER TABLE users 
        ALTER COLUMN siape DROP NOT NULL
      `);
      console.log('✅ Coluna siape agora é opcional!');
    } catch (error) {
      console.log('ℹ️ Coluna siape já é opcional ou não existe');
    }

    // Atualizar usuários existentes para first_login = false (já fizeram login)
    await query(`
      UPDATE users 
      SET first_login = false 
      WHERE first_login IS NULL OR first_login = true
    `);
    
    console.log('✅ Usuários existentes atualizados para first_login = false');
    
  } catch (error) {
    console.error('❌ Erro ao adicionar campos:', error);
    throw error;
  }
};

// Executar se chamado diretamente
if (require.main === module) {
  addStudentFields()
    .then(() => {
      console.log('🎉 Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro na execução:', error);
      process.exit(1);
    });
}

module.exports = { addStudentFields };
