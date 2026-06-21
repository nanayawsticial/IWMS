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
    <div className="new-auth-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* Brand logo at top */}
      <div className="new-auth-brand-logo" style={{ marginBottom: '32px' }}>
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#bd6b39" />
          <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>IWMS</span>
      </div>

      {/* Error Card */}
      <div className="error-page-card">
        <img 
          src="/error_500.png" 
          alt="500 Error - Server Error" 
          className="error-page-illustration"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        
        <h1 className="error-page-title">Oops, something went wrong</h1>
        
        <p className="error-page-subtitle">
          Server Error 500. We apologise and are fixing the problem. Please try again at a later stage.
        </p>

        {error?.message && (
          <div className="new-auth-error" style={{ wordBreak: 'break-word', textAlign: 'left', marginBottom: '24px' }}>
            <span><strong>Details:</strong> {error.message}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button
            onClick={() => reset()}
            className="btn-terracotta"
            style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--color-terracotta)', color: 'var(--color-terracotta)' }}
          >
            Try Again
          </button>
          <a 
            href="/dashboard" 
            className="btn-terracotta"
            style={{ textDecoration: 'none', flex: 1 }}
          >
            Back to Dashboard
          </a>
        </div>
      </div>

      {/* Bottom links and copyright */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--color-slate-muted)', marginTop: '40px', justifyContent: 'center' }}>
        <a href="#" className="new-auth-link" onClick={(e) => e.preventDefault()} style={{ color: 'inherit' }}>Terms & Condition</a>
        <span>&middot;</span>
        <a href="#" className="new-auth-link" onClick={(e) => e.preventDefault()} style={{ color: 'inherit' }}>Privacy</a>
        <span>&middot;</span>
        <a href="#" className="new-auth-link" onClick={(e) => e.preventDefault()} style={{ color: 'inherit' }}>Help</a>
      </div>
      <div className="new-auth-footer" style={{ marginTop: '12px' }}>
        <p>Copyright &copy; {new Date().getFullYear()} - SmartHR</p>
      </div>
    </div>
  );
}
