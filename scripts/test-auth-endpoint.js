const { generateToken } = require('../lib/auth.js');

const testAuthEndpoint = async () => {
  try {
    console.log('🧪 Testando autenticação...');
    
    // Gerar um token de teste para um aluno
    const token = generateToken(1, 'aluno@test.com', 'aluno');
    console.log('✅ Token gerado:', token.substring(0, 50) + '...');
    
    // Simular uma requisição
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    console.log('📋 Headers simulados:', headers);
    console.log('🎉 Teste de autenticação concluído!');
    
  } catch (error) {
    console.error('❌ Erro no teste de autenticação:', error);
  }
};

testAuthEndpoint();
