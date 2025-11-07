const { query } = require('../lib/database-commonjs.js');

const testProject4 = async () => {
  try {
    console.log('🧪 Testando projeto 4...');
    
    const result = await query(`
      SELECT 
        ps.*,
        u.name as student_name,
        u.email as student_email,
        u.matricula_sigaa as student_matricula
      FROM project_students ps
      LEFT JOIN users u ON ps.student_id = u.id
      WHERE ps.project_id = 4
      ORDER BY u.name
    `);
    
    console.log('✅ Query executada com sucesso!');
    console.log('📊 Alunos no projeto 4:', result.rows.length);
    
    if (result.rows.length > 0) {
      result.rows.forEach((student, index) => {
        console.log(`${index + 1}. ${student.student_name} (${student.student_email})`);
        if (student.student_matricula) {
          console.log(`   Matrícula: ${student.student_matricula}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
};

testProject4();
