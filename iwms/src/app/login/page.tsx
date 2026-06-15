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
            <h1 className="login-title">IWMS</h1>
            <p className="login-subtitle">Integrated Workforce Management</p>
          </div>

          {mfaRequired ? (
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
          ) : (
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
          )}

          <div className="demo-section">
            <p className="demo-label" style={{ marginBottom: '10px' }}>Use the administrator account created during setup.</p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '12px', paddingTop: '12px' }}>
              <p className="demo-label" style={{ marginBottom: '8px', fontSize: '0.8rem', opacity: 0.7 }}>Want to use IWMS for your company?</p>
              <a href="/register" className="demo-btn" style={{ width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none', color: '#fff', fontSize: '0.85rem', padding: '8px', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', transition: 'all 0.2s' }}>
                Register a New Organization
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
