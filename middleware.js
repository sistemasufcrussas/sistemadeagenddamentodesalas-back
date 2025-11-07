import { NextResponse } from 'next/server';

/**
 * Middleware global do Next.js para configurar CORS em TODAS as rotas de API
 * Isso garante que CORS seja configurado mesmo se a rota não existir (404)
 */
export function middleware(request) {
  // Apenas processar rotas de API
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Criar resposta com headers CORS
  const origin = request.headers.get('origin');
  
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

  // Criar headers de resposta
  const response = NextResponse.next();
  
  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  } else {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
  response.headers.set('Access-Control-Max-Age', '86400');
  response.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

  // Responder a preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: response.headers,
    });
  }

  // Para requisições normais, retornar resposta com headers CORS
  return response;
}

// Configurar quais rotas o middleware deve processar
export const config = {
  matcher: '/api/:path*',
};

