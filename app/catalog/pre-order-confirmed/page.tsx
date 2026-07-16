import { Suspense } from 'react';
import { ConfirmationContent } from './ConfirmationContent';

export const dynamic = 'force-dynamic';

/**
 * Public pre-order confirmation page (Phase 11 / 11.8).
 *
 * Reads the tracking code from the URL and shows the next
 * steps: pay the deposit via WhatsApp, or track progress
 * later. Body is wrapped in Suspense because `searchParams`
 * forces dynamic rendering under Next 14.
 */
export default function PreOrderConfirmedPage() {
  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="container mx-auto px-6 max-w-md py-10">
        <Suspense
          fallback={
            <div className="text-center text-white/40 text-sm">Loading…</div>
          }
        >
          <ConfirmationContent />
        </Suspense>
      </div>
    </div>
  );
}
