'use client';

import React from 'react';
import Link from 'next/link';

export default function NotFound() {
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
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="login-title" style={{ fontSize: '32px', marginBottom: '8px' }}>404 - Not Found</h1>
          <p className="login-subtitle" style={{ fontSize: '0.95rem', marginBottom: '24px', maxWidth: '320px', lineHeight: '1.5' }}>
            The page you are looking for doesn't exist or you don't have permission to access it.
          </p>
          <Link 
            href="/dashboard" 
            className="btn-primary"
            style={{ 
              width: '100%', 
              display: 'block', 
              textAlign: 'center', 
              textDecoration: 'none', 
              padding: '12px', 
              borderRadius: '8px', 
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
