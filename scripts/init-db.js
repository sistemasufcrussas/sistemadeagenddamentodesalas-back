// Script para inicializar o banco de dados
const { testConnection, initializeDatabase } = require('../lib/database.js');
const { seedDatabase } = require('../lib/seedDatabase.js');

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
    console.log('🏗️ Criando tabelas...');
    await initializeDatabase();

    // Popular com dados iniciais
    console.log('🌱 Populando banco com dados iniciais...');
    await seedDatabase();

    console.log('✅ Banco de dados inicializado com sucesso!');
    console.log('');
    console.log('👥 Usuários criados:');
    console.log('   • Admin: admin@siru.com / admin123');
    console.log('   • Professor: joao.silva@universidade.edu / professor123');
    console.log('   • Coordenador: maria.santos@universidade.edu / coordenador123');
    console.log('   • Aluno: pedro.costa@aluno.universidade.edu / aluno123');
    console.log('   • Portaria: ana.oliveira@universidade.edu / portaria123');
    console.log('');
    console.log('🎉 Pronto para uso!');

  } catch (error) {
    console.error('❌ Erro na inicialização:', error.message);
    console.error('🔧 Detalhes:', error);
    process.exit(1);
  }
};

// Executar inicialização
initDB();
