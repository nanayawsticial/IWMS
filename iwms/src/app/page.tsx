'use client';

import React from 'react';
import Link from 'next/link';

export default function WelcomePage() {
  return (
    <div className="landing-page">
      <style dangerouslySetInnerHTML={{ __html: `
        .landing-page {
          background-color: #060814;
          color: #f8fafc;
          font-family: var(--font-geist-sans), system-ui, -apple-system, sans-serif;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        .landing-nav {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          z-index: 10;
          background: transparent;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }

        @media (max-width: 768px) {
          .landing-nav {
            padding: 0 20px;
          }
        }

        .logo-link {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .logo-text {
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .nav-login {
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          font-weight: 500;
          font-size: 0.95rem;
          transition: color 0.2s;
        }

        .nav-login:hover {
          color: #fff;
        }

        .hero-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 120px 20px 80px 20px;
          min-height: calc(100vh - 120px);
          position: relative;
          max-width: 800px;
          margin: 0 auto;
          z-index: 2;
          box-sizing: border-box;
        }

        .badge-pill {
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.25);
          color: #a5b4fc;
          padding: 6px 16px;
          border-radius: 9999px;
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 24px;
        }

        .hero-headline {
          font-size: 3.5rem;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin-bottom: 20px;
          background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 50%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        @media (max-width: 768px) {
          .hero-headline {
            font-size: 2.25rem;
          }
        }

        .hero-subheadline {
          font-size: 1.15rem;
          color: #94a3b8;
          line-height: 1.6;
          max-width: 600px;
          margin: 0 auto 40px auto;
        }

        .cta-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .primary-cta {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: #fff;
          font-size: 1.05rem;
          font-weight: 600;
          padding: 14px 32px;
          border-radius: 10px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
          border: none;
          cursor: pointer;
        }

        .primary-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(99, 102, 241, 0.5);
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        }

        .ghost-cta {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.9rem;
          font-weight: 500;
          text-decoration: none;
          transition: color 0.2s;
        }

        .ghost-cta:hover {
          color: #fff;
        }

        .features-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 60px 40px 100px 40px;
          width: 100%;
          box-sizing: border-box;
          z-index: 2;
        }

        @media (max-width: 768px) {
          .features-section {
            padding: 40px 20px 60px 20px;
          }
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 30px;
        }

        @media (max-width: 768px) {
          .features-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(16px);
          border-radius: 16px;
          padding: 32px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .feature-card:hover {
          transform: translateY(-4px);
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(99, 102, 241, 0.3);
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.05);
        }

        .feature-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 10px;
          margin-bottom: 20px;
          background: rgba(99, 102, 241, 0.1);
          color: #818cf8;
        }

        .feature-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin-bottom: 12px;
          color: #fff;
        }

        .feature-desc {
          font-size: 0.9rem;
          color: #94a3b8;
          line-height: 1.5;
        }

        .landing-footer {
          text-align: center;
          padding: 40px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          color: #64748b;
          font-size: 0.85rem;
          margin-top: auto;
          z-index: 2;
        }

        /* Background elements */
        .bg-glow-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          z-index: 1;
          pointer-events: none;
        }

        .bg-glow-1 {
          position: absolute;
          top: 25%;
          left: 50%;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%);
          transform: translate(-50%, -50%);
          animation: pulseGlow 12s infinite ease-in-out;
        }

        .bg-glow-2 {
          position: absolute;
          top: 60%;
          left: 30%;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%);
          animation: floatOrb1 16s infinite ease-in-out;
        }

        .bg-glow-3 {
          position: absolute;
          top: 40%;
          left: 70%;
          width: 450px;
          height: 450px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.06) 0%, transparent 70%);
          animation: floatOrb2 20s infinite ease-in-out;
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse at center, black, transparent 80%);
        }

        @keyframes pulseGlow {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.4;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.6;
          }
        }

        @keyframes floatOrb1 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(20px, -30px) scale(1.05);
          }
        }

        @keyframes floatOrb2 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-25px, 20px) scale(0.95);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .bg-glow-1, .bg-glow-2, .bg-glow-3, .primary-cta, .feature-card {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }
      ` }} />

      {/* Decorative Background Glowing Elements */}
      <div className="bg-glow-container">
        <div className="bg-glow-1" />
        <div className="bg-glow-2" />
        <div className="bg-glow-3" />
        <div className="grid-overlay" />
      </div>

      {/* Navigation Bar */}
      <nav className="landing-nav">
        <Link href="/" className="logo-link">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#logoGrad)" />
            <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <span className="logo-text">IWMS</span>
        </Link>
        <Link href="/login" className="nav-login">
          Login
        </Link>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="badge-pill">Workforce Management</div>
        <h1 className="hero-headline">The smarter way to manage your workforce</h1>
        <p className="hero-subheadline">
          Real-time attendance tracking, biometric hardware sync, and multi-tenant team management — all in one platform.
        </p>
        <div className="cta-group">
          <Link href="/get-started" className="primary-cta">
            Get Started
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <Link href="/login" className="ghost-cta">
            Already have an account? Login
          </Link>
        </div>
      </header>

      {/* Feature Highlights Section */}
      <section className="features-section">
        <div className="features-grid">
          {/* Card 1 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </div>
            <h3 className="feature-title">Biometric Clock-In</h3>
            <p className="feature-desc">
              Hardware RFID terminals sync attendance in real-time across your entire organization.
            </p>
          </div>

          {/* Card 2 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="9" y1="22" x2="9" y2="16" />
                <line x1="15" y1="22" x2="15" y2="16" />
                <line x1="9" y1="16" x2="15" y2="16" />
                <path d="M8 6h8" />
                <path d="M8 10h8" />
              </svg>
            </div>
            <h3 className="feature-title">Multi-Tenant Orgs</h3>
            <p className="feature-desc">
              Create your organization, invite your team, and manage everyone from a single dashboard.
            </p>
          </div>

          {/* Card 3 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <h3 className="feature-title">Live Dashboard</h3>
            <p className="feature-desc">
              See who's clocked in, late arrivals, and attendance stats — updated instantly as events happen.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} IWMS. All rights reserved. Powered by IWMS.</p>
      </footer>
    </div>
  );
}
