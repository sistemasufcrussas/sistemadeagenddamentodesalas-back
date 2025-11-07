const { query } = require('../lib/database-commonjs.js');

const testProjectStudents = async () => {
  try {
    console.log('🧪 Testando endpoint de alunos do projeto...');
    
    // Simular um project_id
    const projectId = 1;
    
    console.log('\n📋 Executando query de alunos do projeto...');
    const result = await query(`
      SELECT 
        ps.*,
        u.name as student_name,
        u.email as student_email,
        u.siape as student_siape,
        u.matricula_sigaa as student_matricula
      FROM project_students ps
      LEFT JOIN users u ON ps.student_id = u.id
      WHERE ps.project_id = $1
      ORDER BY u.name
    `, [projectId]);
    
    console.log('✅ Query executada com sucesso!');
    console.log('📊 Alunos encontrados:', result.rows.length);
    
    if (result.rows.length > 0) {
      console.log('\n📋 Alunos no projeto:');
      result.rows.forEach((student, index) => {
        console.log(`${index + 1}. ${student.student_name} (${student.student_email})`);
        if (student.student_matricula) {
          console.log(`   Matrícula: ${student.student_matricula}`);
        }
      });
    } else {
      console.log('❌ Nenhum aluno encontrado no projeto');
    }
    
    console.log('\n🎉 Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.error('Stack:', error.stack);
  }
};

testProjectStudents();
