import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }> | React.ReactNode;
  iconBg?: string; // CSS color value or tailwind class
  iconColor?: string; // CSS color value or tailwind class
  trend?: {
    value: string | number;
    isPositive: boolean;
    label?: string;
  };
  link?: {
    href: string;
    label: string;
  };
  className?: string;
}

export default function KpiCard({
  title,
  value,
  icon: Icon,
  iconBg = 'var(--accent-soft)',
  iconColor = 'var(--accent)',
  trend,
  link,
  className = ''
}: KpiCardProps) {
  // Check if iconBg/iconColor should be applied via styles or classes
  const isStyleBg = iconBg.startsWith('var(') || iconBg.startsWith('#') || iconBg.startsWith('rgba') || iconBg.startsWith('hsla');
  const isStyleColor = iconColor.startsWith('var(') || iconColor.startsWith('#') || iconColor.startsWith('rgb');

  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) {
      return Icon;
    }
    const Component = Icon as React.ComponentType<{ size?: number; className?: string }>;
    return <Component size={20} />;
  };

  return (
    <div className={`card flex flex-col justify-between transition-transform hover:-translate-y-0.5 duration-200 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="label block text-[var(--text-3)] text-xs font-medium tracking-wide uppercase">
            {title}
          </span>
          <span className="value block text-2xl font-bold text-[var(--text-1)]">
            {value}
          </span>
        </div>
        <div
          className={`kpi-icon ${!isStyleBg ? iconBg : ''} ${!isStyleColor ? iconColor : ''}`}
          style={{
            backgroundColor: isStyleBg ? iconBg : undefined,
            color: isStyleColor ? iconColor : undefined
          }}
        >
          {renderIcon()}
        </div>
      </div>

      {(trend || link) && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]">
          {trend ? (
            <div className="flex items-center gap-1.5">
              <span
                className={`badge ${
                  trend.isPositive ? 'badge-green' : 'badge-red'
                }`}
              >
                {trend.isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {trend.value}
              </span>
              {trend.label && (
                <span className="text-[var(--text-3)] text-xs font-normal">
                  {trend.label}
                </span>
              )}
            </div>
          ) : (
            <div />
          )}

          {link && (
            <Link
              href={link.href}
              className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors inline-flex items-center gap-0.5"
            >
              {link.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
