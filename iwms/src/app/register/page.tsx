'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { authApi, setTokens, clearTokens } from '@/lib/api';

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const tab = searchParams.get('tab');

  const [mode, setMode] = useState<'signup' | 'join'>('signup');
  const [organizationName, setOrganizationName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (code) {
      setMode('join');
      setJoinCode(code.trim().toUpperCase());
    } else if (tab === 'join') {
      setMode('join');
    }
  }, [code, tab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    clearTokens();
    try {
      let data;
      if (mode === 'signup') {
        data = await authApi.signup({
          organizationName,
          userName,
          email,
          password,
        });
      } else {
        data = await authApi.join({
          joinCode: joinCode.trim().toUpperCase(),
          userName,
          email,
          password,
        });
      }
      setTokens(data.accessToken, data.refreshToken);
      localStorage.setItem('iwms_user', JSON.stringify(data.user));
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
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
            <p className="login-subtitle">
              {mode === 'signup' ? 'Register a New Organization' : 'Join an Organization'}
            </p>
          </div>

          {/* Toggle */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); }}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '0.85rem',
                fontWeight: '500',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: mode === 'signup' ? 'rgba(99, 102, 241, 0.9)' : 'transparent',
                color: mode === 'signup' ? '#fff' : 'rgba(255, 255, 255, 0.6)'
              }}
            >
              Create Organization
            </button>
            <button
              type="button"
              onClick={() => { setMode('join'); setError(''); }}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '0.85rem',
                fontWeight: '500',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: mode === 'join' ? 'rgba(99, 102, 241, 0.9)' : 'transparent',
                color: mode === 'join' ? '#fff' : 'rgba(255, 255, 255, 0.6)'
              }}
            >
              Join Organization
            </button>
          </div>

          {success ? (
            <div className="form-success" style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              padding: '16px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              margin: '20px 0'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {mode === 'signup' 
                  ? 'Organization registered successfully! Redirecting to dashboard...' 
                  : 'Successfully joined organization! Redirecting to dashboard...'}
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              {mode === 'signup' ? (
                <div className="form-group">
                  <label htmlFor="orgName" className="form-label">Organization / Company Name</label>
                  <input
                    id="orgName"
                    type="text"
                    value={organizationName}
                    onChange={e => setOrganizationName(e.target.value)}
                    className="form-input"
                    placeholder="e.g. Acme Corporation"
                    required
                    autoFocus
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="joinCode" className="form-label">Organization Join Code</label>
                  <input
                    id="joinCode"
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    className="form-input"
                    placeholder="e.g. ORG-A4B7D2"
                    required
                    autoFocus
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="userName" className="form-label">
                  {mode === 'signup' ? 'Administrator Full Name' : 'Full Name'}
                </label>
                <input
                  id="userName"
                  type="text"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  className="form-input"
                  placeholder="e.g. John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  {mode === 'signup' ? 'Admin Email Address' : 'Email Address'}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="john@company.com"
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
                    {mode === 'signup' ? 'Creating organization...' : 'Joining organization...'}
                  </span>
                ) : (
                  mode === 'signup' ? 'Create Organization' : 'Join Organization'
                )}
              </button>
            </form>
          )}

          <div className="demo-section" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '12px', paddingTop: '12px' }}>
            <p className="demo-label" style={{ marginBottom: '8px' }}>Already have an organization?</p>
            <a href="/login" className="demo-btn" style={{ width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none', color: '#fff', fontSize: '0.85rem', padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', transition: 'all 0.2s' }}>
              Back to Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#090d16', color: '#64748b' }}>
        <span className="spinner" style={{ marginRight: '8px' }} /> Loading...
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}
