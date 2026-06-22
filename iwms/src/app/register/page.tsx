'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { authApi, setTokens, clearTokens } from '@/lib/api';
import { User, Mail, Lock, Eye, EyeOff, Building, Hash, ShieldAlert, ArrowRight } from 'lucide-react';
import Link from 'next/link';

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
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="new-auth-page">
      <div className="new-auth-grid">
        {/* Left Split Panel */}
        <div className="new-auth-side register-side">
          <div className="new-auth-glass">
            <h2>Empowering people through seamless HR management.</h2>
            <div className="new-auth-image-container" style={{ boxShadow: 'none' }}>
              <img 
                src="/register_illustration.png" 
                alt="Registration illustration" 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <p>Efficiently manage your workforce, streamline operations effortlessly.</p>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="new-auth-form-panel">
          <div className="new-auth-form-container">
            {/* Header logo */}
            <div className="new-auth-brand-logo">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="var(--color-terracotta)" />
                <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>IWMS</span>
            </div>

            <h1 className="new-auth-title">Sign Up</h1>
            <p className="new-auth-subtitle">Please enter your details to sign up</p>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-page)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: mode === 'signup' ? 'var(--bg-surface)' : 'transparent',
                  color: mode === 'signup' ? 'var(--color-navy-text)' : 'var(--color-slate-muted)',
                  boxShadow: mode === 'signup' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
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
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: mode === 'join' ? 'var(--bg-surface)' : 'transparent',
                  color: mode === 'join' ? 'var(--color-navy-text)' : 'var(--color-slate-muted)',
                  boxShadow: mode === 'join' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                Join Organization
              </button>
            </div>

            {success ? (
              <div className="new-auth-success">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {mode === 'signup'
                    ? 'Organization registered! Redirecting to dashboard...'
                    : 'Successfully joined organization! Redirecting...'}
                </span>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="new-auth-error">
                    <ShieldAlert size={16} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Org input */}
                {mode === 'signup' ? (
                  <div className="new-auth-form-group">
                    <label htmlFor="orgName" className="new-auth-label">Organization Name</label>
                    <div className="new-auth-input-wrapper">
                      <input
                        id="orgName"
                        type="text"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        className="new-auth-input"
                        placeholder="e.g. Acme Corporation"
                        required
                        autoFocus
                      />
                      <Building size={16} className="new-auth-input-icon" />
                    </div>
                  </div>
                ) : (
                  <div className="new-auth-form-group">
                    <label htmlFor="joinCode" className="new-auth-label">Organization Join Code</label>
                    <div className="new-auth-input-wrapper">
                      <input
                        id="joinCode"
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        className="new-auth-input"
                        placeholder="e.g. ORG-A4B7D2"
                        required
                        autoFocus
                      />
                      <Hash size={16} className="new-auth-input-icon" />
                    </div>
                  </div>
                )}

                {/* Name input */}
                <div className="new-auth-form-group">
                  <label htmlFor="userName" className="new-auth-label">
                    {mode === 'signup' ? 'Administrator Full Name' : 'Full Name'}
                  </label>
                  <div className="new-auth-input-wrapper">
                    <input
                      id="userName"
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="new-auth-input"
                      placeholder="e.g. John Doe"
                      required
                    />
                    <User size={16} className="new-auth-input-icon" />
                  </div>
                </div>

                {/* Email input */}
                <div className="new-auth-form-group">
                  <label htmlFor="email" className="new-auth-label">
                    {mode === 'signup' ? 'Admin Email Address' : 'Email Address'}
                  </label>
                  <div className="new-auth-input-wrapper">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="new-auth-input"
                      placeholder="john@stemaide.com"
                      required
                    />
                    <Mail size={16} className="new-auth-input-icon" />
                  </div>
                </div>

                {/* Password input */}
                <div className="new-auth-form-group">
                  <label htmlFor="password" className="new-auth-label">Password</label>
                  <div className="new-auth-input-wrapper">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="new-auth-input"
                      placeholder="Enter Password"
                      required
                    />
                    <Lock size={16} className="new-auth-input-icon" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="new-auth-input-password-toggle"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="new-auth-actions-row">
                  <label className="new-auth-checkbox-label">
                    <input type="checkbox" className="new-auth-checkbox" required />
                    <span>Agree to Terms & Privacy</span>
                  </label>
                </div>

                <button type="submit" className="btn-terracotta" disabled={loading}>
                  {loading ? 'Creating...' : mode === 'signup' ? 'Create Organization' : 'Join Organization'}
                </button>

                <p className="new-auth-switch-text">
                  Already have an account?{' '}
                  <Link href="/login" className="new-auth-link">
                    Sign In
                  </Link>
                </p>
              </form>
            )}

            {/* Social logins */}
            <div className="new-auth-divider">Or</div>
            <div className="new-auth-social-row">
              <button className="btn-social-outline facebook" onClick={() => alert('Social sign-up is a visual placeholder. Please sign up using the form above.')}>
                <svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
                </svg>
              </button>
              <button className="btn-social-outline" onClick={() => alert('Social sign-up is a visual placeholder. Please sign up using the form above.')}>
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
              </button>
              <button className="btn-social-outline apple" onClick={() => alert('Social sign-up is a visual placeholder. Please sign up using the form above.')}>
                <svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.24.67-2.96 1.49-.62.71-1.16 1.85-1.01 2.96 1.12.09 2.27-.58 2.98-1.39z"/>
                </svg>
              </button>
            </div>

            {/* Footer copyright */}
            <div className="new-auth-footer">
              <p>Copyright &copy; {new Date().getFullYear()} - IWMS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#faf8f6', color: '#64748b' }}>
        <span className="spinner" style={{ marginRight: '8px' }} /> Loading...
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}
