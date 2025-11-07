const { Pool } = require('pg');

// Carregar variáveis de ambiente
require('dotenv').config({ path: './config.env' });

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false,
});

// Função para executar queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query executada', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Erro na query:', error);
    throw error;
  }
};

// Função para obter um cliente do pool
const getClient = async () => {
  return await pool.connect();
};

// Função para fechar o pool
const closePool = async () => {
  await pool.end();
};

module.exports = {
  query,
  getClient,
  closePool,
  pool
};
