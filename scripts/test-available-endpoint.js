const { query } = require('../lib/database-commonjs.js');

const testAvailableEndpoint = async () => {
  try {
    console.log('🧪 Testando endpoint de projetos disponíveis...');
    
    // Simular um student_id
    const student_id = 1;
    
    console.log('\n📋 Executando query principal...');
    const result = await query(`
      SELECT 
        p.id,
        p.name,
        p.type,
        p.description,
        p.created_at,
        prof.name as professor_name,
        prof.email as professor_email,
        COUNT(ps.student_id) as current_students,
        pr.status as request_status,
        pr.created_at as request_created_at,
        pr.message as request_message
      FROM projects p
      JOIN users prof ON p.professor_id = prof.id
      LEFT JOIN project_students ps ON p.id = ps.project_id
      LEFT JOIN project_requests pr ON p.id = pr.project_id AND pr.student_id = $1
      GROUP BY p.id, p.name, p.type, p.description, p.created_at, prof.name, prof.email, pr.status, pr.created_at, pr.message
      ORDER BY p.created_at DESC
    `, [student_id]);
    
    console.log('✅ Query executada com sucesso!');
    console.log('📊 Projetos encontrados:', result.rows.length);
    
    if (result.rows.length > 0) {
      console.log('\n📋 Primeiro projeto:');
      console.log('- Nome:', result.rows[0].name);
      console.log('- Tipo:', result.rows[0].type);
      console.log('- Professor:', result.rows[0].professor_name);
      console.log('- Alunos:', result.rows[0].current_students);
      console.log('- Status da solicitação:', result.rows[0].request_status);
    }
    
    console.log('\n🎉 Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.error('Stack:', error.stack);
  }
};

testAvailableEndpoint();
