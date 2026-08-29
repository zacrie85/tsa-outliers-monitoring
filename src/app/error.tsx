'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0d1117',
      fontFamily: 'monospace',
    }}>
      <div style={{
        maxWidth: 600,
        padding: 24,
        borderRadius: 12,
        background: '#161b22',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h2 style={{ color: '#ef5350', marginBottom: 16 }}>Error</h2>
        <p style={{ color: '#e0e0e0', fontSize: 14, marginBottom: 8 }}>{error.message}</p>
        <pre style={{
          color: '#78909c',
          fontSize: 11,
          background: '#0d1117',
          padding: 12,
          borderRadius: 8,
          overflow: 'auto',
          maxHeight: 200,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>{error.stack}</pre>
        <button
          onClick={reset}
          style={{
            marginTop: 16,
            padding: '8px 20px',
            borderRadius: 8,
            background: '#64b5f6',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
