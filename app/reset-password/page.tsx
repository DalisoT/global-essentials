'use client';

import { Suspense } from 'react';
import { ResetPasswordForm } from './ResetPasswordForm';
import { Loader2 } from 'lucide-react';

function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-tactical-blue mx-auto" />
        <p className="text-white/60">Loading...</p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ResetPasswordForm />
    </Suspense>
  );
}