'use client';

import React from 'react';
import Link from 'next/link';

export default function GetStartedPage() {
  return (
    <div className="choice-page">
      <style dangerouslySetInnerHTML={{ __html: `
        .choice-page {
          background-color: var(--bg-page);
          color: var(--text-1);
          font-family: var(--font-geist-sans), system-ui, -apple-system, sans-serif;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          padding: 40px 20px;
          box-sizing: border-box;
        }

        .bg-glow-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
          z-index: 1;
          pointer-events: none;
        }

        .bg-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 800px;
          height: 800px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%);
          transform: translate(-50%, -50%);
          animation: pulseGlow 10s infinite ease-in-out;
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse at center, black, transparent 80%);
        }

        .choice-container {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 800px;
          text-align: center;
        }

        .choice-header {
          margin-bottom: 40px;
        }

        .logo-link {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          margin-bottom: 20px;
        }

        .logo-text {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, var(--text-1) 0%, var(--text-2) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .choice-title {
          font-size: 2.25rem;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -0.01em;
          color: var(--text-1);
          margin-bottom: 12px;
        }

        .choice-subtitle {
          font-size: 1.05rem;
          color: var(--text-2);
          max-width: 500px;
          margin: 0 auto;
        }

        .choice-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 40px;
        }

        @media (max-width: 768px) {
          .choice-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }

        .choice-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 40px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          color: inherit;
        }

        .choice-card:hover {
          transform: translateY(-4px) scale(1.02);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 20px 40px -20px rgba(99, 102, 241, 0.2);
        }

        .choice-card-signin:hover {
          border-color: rgba(99, 102, 241, 0.3);
        }

        .choice-card-create:hover {
          border-color: rgba(139, 92, 246, 0.3);
        }

        .card-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 12px;
          margin-bottom: 24px;
          transition: all 0.3s;
        }

        .choice-card-signin .card-icon-wrapper {
          background: rgba(99, 102, 241, 0.1);
          color: var(--blue);
        }

        .choice-card-signin:hover .card-icon-wrapper {
          background: rgba(99, 102, 241, 0.2);
          transform: scale(1.1);
        }

        .choice-card-create .card-icon-wrapper {
          background: rgba(139, 92, 246, 0.1);
          color: var(--purple);
        }

        .choice-card-create:hover .card-icon-wrapper {
          background: rgba(139, 92, 246, 0.2);
          transform: scale(1.1);
        }

        .card-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--text-1);
          margin-bottom: 12px;
        }

        .card-desc {
          font-size: 0.95rem;
          color: var(--text-2);
          line-height: 1.5;
          margin-bottom: 32px;
          flex-grow: 1;
        }

        .card-button {
          width: 100%;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 600;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .choice-card-signin .card-button {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-1);
        }

        .choice-card-signin:hover .card-button {
          background: var(--blue);
          border-color: var(--blue);
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
        }

        .choice-card-create .card-button {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-1);
        }

        .choice-card-create:hover .card-button {
          background: var(--purple);
          border-color: var(--purple);
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
        }

        .choice-footer-text {
          font-size: 0.9rem;
          color: var(--text-3);
        }

        .invite-link {
          color: var(--blue);
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }

        .invite-link:hover {
          color: var(--accent);
          text-decoration: underline;
        }

        @keyframes pulseGlow {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.3;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.15);
            opacity: 0.5;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .bg-glow, .choice-card, .card-icon-wrapper, .card-button {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }
      ` }} />

      {/* Decorative Background */}
      <div className="bg-glow-container">
        <div className="bg-glow" />
        <div className="grid-overlay" />
      </div>

      <div className="choice-container">
        {/* Header */}
        <div className="choice-header">
          <Link href="/" className="logo-link">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
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
          <h1 className="choice-title">How would you like to start?</h1>
          <p className="choice-subtitle">
            Choose an option below to access your organization or set up a new workforce workspace.
          </p>
        </div>

        {/* Choice Grid */}
        <div className="choice-grid">
          {/* Card 1: Sign In */}
          <Link href="/login" className="choice-card choice-card-signin">
            <div className="card-icon-wrapper">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="card-title">Sign In</h2>
            <p className="card-desc">
              Already part of an organization? Log in to your account and get back to work.
            </p>
            <div className="card-button">
              Login
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </Link>

          {/* Card 2: Create Organization */}
          <Link href="/register" className="choice-card choice-card-create">
            <div className="card-icon-wrapper">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="9" y1="22" x2="9" y2="16" />
                <line x1="15" y1="22" x2="15" y2="16" />
                <line x1="9" y1="16" x2="15" y2="16" />
                <path d="M8 6h8" />
                <path d="M8 10h8" />
              </svg>
            </div>
            <h2 className="card-title">Create Organization</h2>
            <p className="card-desc">
              Setting up IWMS for your company? Register your organization and invite your team.
            </p>
            <div className="card-button">
              Get Started
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Footer Link */}
        <p className="choice-footer-text">
          Joining an existing organization?{' '}
          <Link href="/register?tab=join" className="invite-link">
            Use your invite link or enter an invite code
          </Link>
        </p>
      </div>
    </div>
  );
}
