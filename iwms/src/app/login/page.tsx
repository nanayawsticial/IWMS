'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { clearTokens } from '@/lib/api';

export default function LoginPage() {
  const { login, loginMfa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [view, setView] = useState<'welcome' | 'login'>('welcome');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    clearTokens();
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      window.location.href = '/dashboard';
    } else if (result.mfaRequired && result.tempToken) {
      setMfaRequired(true);
      setTempToken(result.tempToken);
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await loginMfa(tempToken, mfaCode);
    setLoading(false);
    if (result.success) {
      window.location.href = '/dashboard';
    } else {
      setError(result.error || 'Verification failed');
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb orb-1" />
        <div className="login-orb orb-2" />
        <div className="login-orb orb-3" />
        <div className="grid-overlay" />
      </div>

      <div className="login-container">
        <div className="login-card">
          {view === 'login' && !mfaRequired && (
            <button
              type="button"
              onClick={() => { setView('welcome'); setError(''); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginBottom: '15px',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                e.currentTarget.style.background = 'none';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back
            </button>
          )}

          <div className="login-header">
            <div className="logo-mark">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="url(#logoGrad)" />
                <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32">
                    <stop stopColor="#6366f1"/>
                    <stop offset="1" stopColor="#8b5cf6"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="login-title">
              {mfaRequired ? 'Security Verification' : view === 'login' ? 'Sign In' : 'Welcome to IWMS'}
            </h1>
            <p className="login-subtitle">
              {mfaRequired ? 'Enter your MFA verification code' : view === 'login' ? 'Enter credentials to access your workspace' : 'Integrated Workforce Management'}
            </p>
          </div>

          {view === 'welcome' && !mfaRequired && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setView('login')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  padding: '20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 20px -10px rgba(99, 102, 241, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>
                    Sign In to Workspace
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', lineHeight: '1.4', margin: 0 }}>
                  Access your company's existing dashboard, manage personnel, and track devices.
                </p>
              </button>

              <a
                href="/register"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  padding: '20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  textDecoration: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 20px -10px rgba(139, 92, 246, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#a78bfa',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm10 1h-6m3-3v6"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>
                    Create / Join Organization
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', lineHeight: '1.4', margin: 0 }}>
                  Set up a new organization for your workforce, or join one with an invitation code.
                </p>
              </a>
            </div>
          )}

          {mfaRequired && (
            <form onSubmit={handleMfaSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="mfaCode" className="form-label">Security Verification Code</label>
                <input
                  id="mfaCode"
                  type="text"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value)}
                  className="form-input"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="form-error">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 110-2 1 1 0 010 2z"/>
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <span className="btn-loading">
                    <span className="spinner" />
                    Verifying...
                  </span>
                ) : 'Verify & Sign In'}
              </button>

              <button
                type="button"
                className="demo-btn"
                style={{ width: '100%', marginTop: '10px', display: 'block', textAlign: 'center', '--demo-color': 'rgba(255,255,255,0.2)' } as React.CSSProperties}
                onClick={() => setMfaRequired(false)}
              >
                Back to Login
              </button>
            </form>
          )}

          {view === 'login' && !mfaRequired && (
            <>
              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label htmlFor="email" className="form-label">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="form-input"
                    placeholder="you@company.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="form-input"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error && (
                  <div className="form-error">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 110-2 1 1 0 010 2z"/>
                    </svg>
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
                    <span className="btn-loading">
                      <span className="spinner" />
                      Signing in...
                    </span>
                  ) : 'Sign In'}
                </button>
              </form>

              <div className="demo-section">
                <p className="demo-label" style={{ marginBottom: '10px' }}>Use the administrator account created during setup.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
