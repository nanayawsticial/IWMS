'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, getPostLoginRoute } from '@/lib/auth-context';
import { clearTokens } from '@/lib/api';
import { Mail, Lock, Eye, EyeOff, ShieldAlert, ArrowRight, UserCheck } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const { login, loginMfa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  // Lockscreen / Quick Login state for returning users
  const [savedUser, setSavedUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('iwms_user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        if (parsed && parsed.email) {
          setSavedUser(parsed);
          setEmail(parsed.email);
        }
      } catch (e) {
        // ignore parsing error
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    clearTokens();

    const result = await login(email, password);
    setLoading(false);
    
    if (result.success) {
      const savedUser = localStorage.getItem('iwms_user');
      const userObj = savedUser ? JSON.parse(savedUser) : null;
      window.location.href = getPostLoginRoute(userObj);
    } else if (result.mfaRequired && result.tempToken) {
      setMfaRequired(true);
      setTempToken(result.tempToken);
    } else {
      setError(result.error || 'Login failed. Please check your credentials.');
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await loginMfa(tempToken, mfaCode);
    setLoading(false);
    
    if (result.success) {
      const savedUser = localStorage.getItem('iwms_user');
      const userObj = savedUser ? JSON.parse(savedUser) : null;
      window.location.href = getPostLoginRoute(userObj);
    } else {
      setError(result.error || 'Verification failed. Please check the code.');
    }
  };

  const handleSwitchAccount = () => {
    setSavedUser(null);
    setEmail('');
    setPassword('');
    setError('');
  };

  // Helper for generating initials avatar
  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="new-auth-page">
      <div className="new-auth-grid">
        {/* Left Split Panel */}
        <div className="new-auth-side">
          <div className="new-auth-glass">
            <h2>Empowering people through seamless HR management.</h2>
            <div className="new-auth-image-container">
              <img 
                src="/login_hero.png" 
                alt="Colleagues collaborating" 
                onError={(e) => {
                  // Fallback if image fails to load
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

            {/* Display appropriate form based on states */}
            {mfaRequired ? (
              // MFA Form
              <>
                <h1 className="new-auth-title">Security Verification</h1>
                <p className="new-auth-subtitle">Enter your 6-digit MFA verification code</p>

                <form onSubmit={handleMfaSubmit}>
                  {error && (
                    <div className="new-auth-error">
                      <ShieldAlert size={16} />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="new-auth-form-group">
                    <label htmlFor="mfaCode" className="new-auth-label">Verification Code</label>
                    <div className="new-auth-input-wrapper">
                      <input
                        id="mfaCode"
                        type="text"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        className="new-auth-input"
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        required
                        autoFocus
                        style={{ paddingLeft: '14px' }}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-terracotta" disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>

                  <button
                    type="button"
                    className="new-auth-switch-text new-auth-link"
                    style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', display: 'block' }}
                    onClick={() => setMfaRequired(false)}
                  >
                    Back to Login
                  </button>
                </form>
              </>
            ) : savedUser ? (
              // Welcome Back Card (Quick Login)
              <div className="welcome-back-card">
                <h1 className="new-auth-title">Welcome back!</h1>
                <p className="new-auth-subtitle">Please enter your password to sign in</p>

                <div className="welcome-back-avatar-container">
                  {savedUser.avatar && savedUser.avatar.startsWith('http') ? (
                    <img src={savedUser.avatar} alt={savedUser.name} />
                  ) : (
                    <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-terracotta)' }}>
                      {getInitials(savedUser.name || savedUser.email)}
                    </span>
                  )}
                </div>

                <div className="welcome-back-name">{savedUser.name || savedUser.email}</div>

                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                  {error && (
                    <div className="new-auth-error">
                      <ShieldAlert size={16} />
                      <span>{error}</span>
                    </div>
                  )}

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
                        autoFocus
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
                      <input type="checkbox" className="new-auth-checkbox" defaultChecked />
                      <span>Remember Me</span>
                    </label>
                    <a href="#" className="new-auth-link" onClick={(e) => e.preventDefault()}>Forgot Password?</a>
                  </div>

                  <button type="submit" className="btn-terracotta" disabled={loading}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </button>

                  <p className="new-auth-switch-text">
                    Not you?{' '}
                    <button 
                      type="button" 
                      onClick={handleSwitchAccount} 
                      className="new-auth-link"
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
                    >
                      Sign in with another account
                    </button>
                  </p>
                </form>
              </div>
            ) : (
              // Standard Sign In Form
              <>
                <h1 className="new-auth-title">Sign In</h1>
                <p className="new-auth-subtitle">Please enter your details to sign in</p>

                <form onSubmit={handleSubmit}>
                  {error && (
                    <div className="new-auth-error">
                      <ShieldAlert size={16} />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="new-auth-form-group">
                    <label htmlFor="email" className="new-auth-label">Email Address</label>
                    <div className="new-auth-input-wrapper">
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="new-auth-input"
                        placeholder="you@stemaide.com"
                        required
                      />
                      <Mail size={16} className="new-auth-input-icon" />
                    </div>
                  </div>

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
                      <input type="checkbox" className="new-auth-checkbox" />
                      <span>Remember Me</span>
                    </label>
                    <a href="#" className="new-auth-link" onClick={(e) => e.preventDefault()}>Forgot Password?</a>
                  </div>

                  <button type="submit" className="btn-terracotta" disabled={loading}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </button>

                  <p className="new-auth-switch-text">
                    Don't have an account?{' '}
                    <Link href="/register" className="new-auth-link">
                      Create Account
                    </Link>
                  </p>
                </form>

                {/* Social logins */}
                <div className="new-auth-divider">Or</div>
                <div className="new-auth-social-row">
                  <button className="btn-social-outline facebook" onClick={() => alert('Social sign-in is a visual placeholder. Please log in using your email & password.')}>
                    <svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
                      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
                    </svg>
                  </button>
                  <button className="btn-social-outline" onClick={() => alert('Social sign-in is a visual placeholder. Please log in using your email & password.')}>
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                  </button>
                  <button className="btn-social-outline apple" onClick={() => alert('Social sign-in is a visual placeholder. Please log in using your email & password.')}>
                    <svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.24.67-2.96 1.49-.62.71-1.16 1.85-1.01 2.96 1.12.09 2.27-.58 2.98-1.39z"/>
                    </svg>
                  </button>
                </div>
              </>
            )}

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
