/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Desabilitar geração de páginas estáticas (apenas API routes)
  // Isso evita erros ao tentar gerar páginas 404/500
  generateBuildId: async () => {
    return 'build-' + Date.now().toString();
  },
  
  // Desabilitar exportação estática - apenas serverless functions
  output: 'standalone',
  // Configurações para API - Headers CORS
  // Aceita múltiplas origens (Vercel e Render)
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { 
            key: 'Access-Control-Allow-Origin', 
            value: process.env.ALLOWED_ORIGIN || 'https://siruufc.vercel.app' 
          },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ];
  },

  // Rewrites para garantir que as rotas da API funcionem
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },

  // Configurações experimentais para ESM
  experimental: {
    esmExternals: true,
  },

  // Configuração para Webpack (se necessário)
  webpack: (config) => {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    return config;
  },
};

module.exports = nextConfig;
