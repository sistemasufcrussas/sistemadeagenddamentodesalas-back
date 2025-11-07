import { testConnection, initializeDatabase } from '../../lib/database.js';
import { seedDatabase } from '../../lib/seedDatabase.js';
import { setCorsHeaders } from '../../lib/cors.js';

export default async function handler(req, res) {
  // Configurar CORS
  const isPreflight = setCorsHeaders(req, res);
  if (isPreflight) {
    return; // Preflight já foi respondido
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log('🚀 Inicializando banco de dados...');

    // Testar conexão
    const connectionOk = await testConnection();
    if (!connectionOk) {
      throw new Error('Falha na conexão com o banco de dados');
    }

    // Inicializar estrutura do banco
    await initializeDatabase();

    // Popular com dados iniciais
    await seedDatabase();

    res.status(200).json({
      success: true,
      message: 'Banco de dados inicializado com sucesso!'
    });

  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
    res.status(500).json({ 
      error: 'Erro ao inicializar banco de dados',
      details: error.message 
    });
  }
}
