const { query } = require('../lib/database-commonjs.js');

const addProjectRequestsTable = async () => {
  try {
    console.log('🔄 Criando tabela project_requests...');

    // Verificar se a tabela já existe
    const tableExists = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'project_requests'
    `);

    if (tableExists.rows.length === 0) {
      // Criar tabela project_requests
      await query(`
        CREATE TABLE project_requests (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          professor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
          message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id, student_id)
        )
      `);
      console.log('✅ Tabela project_requests criada!');
    } else {
      console.log('Tabela project_requests já existe.');
    }

    // Criar índices para melhor performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_project_requests_project_id ON project_requests(project_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_project_requests_student_id ON project_requests(student_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_project_requests_professor_id ON project_requests(professor_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_project_requests_status ON project_requests(status)
    `);
    console.log('✅ Índices criados!');

    console.log('🎉 Script executado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao criar tabela project_requests:', error);
  }
};

addProjectRequestsTable();
