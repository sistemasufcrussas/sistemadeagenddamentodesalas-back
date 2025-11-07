const { query } = require('../lib/database-commonjs.js');

const checkTables = async () => {
  try {
    console.log('🔍 Verificando tabelas...');
    
    // Verificar se as tabelas existem
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('projects', 'project_students', 'project_requests')
    `);
    
    console.log('📋 Tabelas encontradas:', tables.rows.map(r => r.table_name));
    
    // Verificar projetos
    if (tables.rows.some(r => r.table_name === 'projects')) {
      const projects = await query('SELECT COUNT(*) as count FROM projects');
      console.log('📊 Projetos na tabela:', projects.rows[0].count);
    }
    
    // Verificar project_students
    if (tables.rows.some(r => r.table_name === 'project_students')) {
      const students = await query('SELECT COUNT(*) as count FROM project_students');
      console.log('👥 Alunos em projetos:', students.rows[0].count);
    }
    
    // Verificar project_requests
    if (tables.rows.some(r => r.table_name === 'project_requests')) {
      const requests = await query('SELECT COUNT(*) as count FROM project_requests');
      console.log('📝 Solicitações de projeto:', requests.rows[0].count);
    }
    
    console.log('✅ Verificação concluída!');
  } catch (error) {
    console.error('❌ Erro ao verificar tabelas:', error);
  }
};

checkTables();
