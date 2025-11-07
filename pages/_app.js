import React from 'react';

// Arquivo necessário para evitar erros de build do Next.js
// Este projeto usa apenas API routes, não páginas React
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

