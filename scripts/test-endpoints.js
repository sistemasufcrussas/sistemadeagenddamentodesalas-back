const { query } = require('../lib/database-commonjs.js');

const testEndpoints = async () => {
  try {
    console.log('🧪 Testando queries dos endpoints...');
    
    // Simular um student_id
    const student_id = 1; // Assumindo que existe um usuário com ID 1
    
    console.log('\n📋 Testando query de projetos disponíveis...');
    const projectsResult = await query(`
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
    
    console.log('✅ Query de projetos executada com sucesso!');
    console.log('📊 Projetos encontrados:', projectsResult.rows.length);
    
    // Testar query de project_students
    console.log('\n👥 Testando verificação de participação...');
    const participationResult = await query(
      'SELECT id FROM project_students WHERE project_id = $1 AND student_id = $2',
      [1, student_id] // Assumindo projeto ID 1
    );
    
    console.log('✅ Query de participação executada com sucesso!');
    console.log('📊 Participações encontradas:', participationResult.rows.length);
    
    console.log('\n📝 Testando query de solicitações...');
    const requestsResult = await query(`
      SELECT 
        pr.id,
        pr.project_id,
        pr.student_id,
        pr.professor_id,
        pr.status,
        pr.message,
        pr.created_at,
        pr.updated_at,
        p.name as project_name,
        p.type as project_type,
        p.description as project_description,
        s.name as student_name,
        s.email as student_email,
        s.matricula_sigaa as student_matricula,
        prof.name as professor_name,
        prof.email as professor_email
      FROM project_requests pr
      JOIN projects p ON pr.project_id = p.id
      JOIN users s ON pr.student_id = s.id
      JOIN users prof ON pr.professor_id = prof.id
      WHERE pr.student_id = $1
      ORDER BY pr.created_at DESC
    `, [student_id]);
    
    console.log('✅ Query de solicitações executada com sucesso!');
    console.log('📊 Solicitações encontradas:', requestsResult.rows.length);
    
    console.log('\n🎉 Todos os testes passaram!');
    
  } catch (error) {
    console.error('❌ Erro nos testes:', error);
    console.error('Stack:', error.stack);
  }
};

testEndpoints();
