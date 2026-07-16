import { Suspense } from 'react';
import { TrackForm } from './TrackForm';
import Link from 'next/link';
import { Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Public pre-order tracker (Phase 11 / 11.8).
 *
 * Anyone with a tracking code can punch it in and see the
 * current status + customer-relevant event timeline. No
 * account required. Rate-limited on the server (10 lookups
 * per IP per hour).
 */
export default function TrackPage() {
  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="container mx-auto px-6 max-w-md py-10">
        <div className="space-y-1 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-tactical-blue/20 mb-2">
            <Search className="w-6 h-6 text-tactical-blue" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">
            Track your pre-order
          </h1>
          <p className="text-sm text-white/60">
            Enter the code we sent you on WhatsApp.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="text-center text-white/40 text-sm">Loading…</div>
          }
        >
          <TrackForm />
        </Suspense>

        <p className="text-center pt-8">
          <Link
            href="/catalog"
            className="text-xs text-white/40 hover:text-white/70 uppercase tracking-widest"
          >
            ← Browse the catalog
          </Link>
        </p>
      </div>
    </div>
  );
}
