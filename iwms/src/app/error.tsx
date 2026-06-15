'use client';

import React, { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Application Error:', error);
  }, [error]);

  return (
    <div className="login-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="login-bg">
        <div className="login-orb orb-1" />
        <div className="login-orb orb-2" />
        <div className="login-orb orb-3" />
        <div className="grid-overlay" />
      </div>

      <div className="login-container">
        <div className="login-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div className="logo-mark">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1 className="login-title" style={{ fontSize: '24px', marginBottom: '8px' }}>Something went wrong!</h1>
          <p className="login-subtitle" style={{ fontSize: '0.9rem', marginBottom: '24px', maxWidth: '320px', lineHeight: '1.5', wordBreak: 'break-word' }}>
            {error?.message || 'An unexpected runtime error occurred while rendering this page.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <button
              onClick={() => reset()}
              className="btn-primary"
              style={{ 
                flex: 1, 
                padding: '12px', 
                borderRadius: '8px', 
                fontWeight: '600', 
                cursor: 'pointer',
                border: 'none',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
            >
              Try Again
            </button>
            <a
              href="/dashboard"
              className="demo-btn"
              style={{ 
                flex: 1, 
                padding: '12px', 
                borderRadius: '8px', 
                textAlign: 'center', 
                textDecoration: 'none', 
                color: '#fff', 
                background: 'rgba(255,255,255,0.08)', 
                border: '1px solid rgba(255,255,255,0.15)',
                fontWeight: '600',
                fontSize: '0.85rem'
              }}
            >
              Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
