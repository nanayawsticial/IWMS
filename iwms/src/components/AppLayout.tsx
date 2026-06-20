'use client';

import React, { useEffect } from 'react';
import { useAuth, getPostLoginRoute } from '@/lib/auth-context';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { usePathname, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/components/Toast';
import { disconnectSocket } from '@/lib/socket';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const publicPaths = ['/login', '/register', '/get-started', '/'];
  const isPublicPage = publicPaths.includes(pathname);

  // Lifecycle socket connection is initiated in hooks, let's handle cleanup on logout
  useEffect(() => {
    if (!user) {
      disconnectSocket();
    }
  }, [user]);

  // Toast listener hook for socket events
  const { on } = useSocket();
  const { addToast } = useToast();

  useEffect(() => {
    if (!user) return;

    const offClockIn = on('attendance:clockIn', (data: any) => {
      if (data.userId === user.id) {
        addToast(
          'Clock-in Successful',
          `You clocked in at ${data.clockIn} (${data.status === 'late' ? 'Late' : 'On Time'})`,
          data.status === 'late' ? 'warning' : 'success'
        );
      } else {
        addToast(
          'Teammate Present',
          `${data.userName} clocked in from ${data.userDepartment || 'Web'} at ${data.clockIn}`,
          data.status === 'late' ? 'warning' : 'info'
        );
      }
    });

    const offClockOut = on('attendance:clockOut', (data: any) => {
      if (data.userId === user.id) {
        addToast(
          'Clock-out Successful',
          `You clocked out at ${data.clockOut}. Work duration: ${data.hoursWorked} hrs.`,
          'success'
        );
      } else {
        addToast(
          'Teammate Checked Out',
          `${data.userName} checked out after working ${data.hoursWorked || 0} hrs.`,
          'info'
        );
      }
      if (data.isOvertime) {
        addToast(
          '🔴 Overtime Alert',
          `${data.userName || 'Employee'} clocked out after ${data.hoursWorked} hours (Overtime).`,
          'error'
        );
      }
    });

    const offLateAlert = on('attendance:lateAlert', (data: any) => {
      addToast(
        '⚠️ Shift Late Warning',
        `${data.count} employees have not clocked in by the 10:00 AM daily check.`,
        'warning',
        7000
      );
    });

    const offTaskUpdated = on('task:updated', (data: any) => {
      if (data.updatedBy !== user.email) {
        const displayEmail = data.updatedBy.split('@')[0];
        addToast(
          '📋 Task Progress Update',
          `"${data.title}" was moved to ${data.status.replace('_', ' ').toUpperCase()} by ${displayEmail}`,
          'task'
        );
      }
    });

    return () => {
      offClockIn();
      offClockOut();
      offLateAlert();
      offTaskUpdated();
    };
  }, [user, on, addToast]);

  useEffect(() => {
    if (!isLoading) {
      if (!user && !isPublicPage) {
        router.replace('/login');
      } else if (user && (pathname === '/' || pathname === '/get-started' || pathname === '/login' || pathname === '/register')) {
        router.replace(getPostLoginRoute(user));
      }
    }
  }, [user, isLoading, isPublicPage, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#090d16]">
        <div className="flex flex-col items-center gap-4">
          <span className="spinner" />
          <p className="text-slate-400 text-sm">Verifying Session...</p>
        </div>
      </div>
    );
  }

  if (isPublicPage) {
    if (user) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[#090d16]">
          <span className="spinner" />
        </div>
      );
    }
    return <>{children}</>;
  }

  if (!user) {
    return null; // Redirecting
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="sidebar-mobile-overlay" onClick={() => document.body.classList.remove('mobile-sidebar-open')} />
      <div className="app-container">
        <TopBar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
