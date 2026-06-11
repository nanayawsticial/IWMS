'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#090d16]">
      <div className="flex flex-col items-center gap-4">
        <span className="spinner" />
        <p className="text-slate-400 text-sm">Initializing IWMS Platform...</p>
      </div>
    </div>
  );
}
