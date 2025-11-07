import React from 'react';

// Página 500 customizada
// Páginas de erro não podem usar getServerSideProps ou getInitialProps
export default function Custom500() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>500 - Server Error</h1>
      <p>An error occurred on the server.</p>
    </div>
  );
}

