/**
 * Helper para configurar CORS em todas as rotas de API
 * Deve ser chamado ANTES de qualquer processamento
 */
export function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  // Lista de origens permitidas
  const allowedOrigins = [
    'https://siruufc.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ];

  // Verificar se a origem está na lista ou é um domínio vercel.app
  const isAllowedOrigin = origin && (
    allowedOrigins.includes(origin) ||
    origin.includes('vercel.app') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  );

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // Fallback para * se não houver origem ou não for permitida
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight por 24 horas
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

  // Responder a preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // Indica que foi um preflight e já foi respondido
  }

  return false; // Não foi preflight, continuar processamento
}

