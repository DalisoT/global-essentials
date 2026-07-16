import { listPreOrderableProducts } from '@/lib/actions/pre-orders';
import { PreOrderForm } from './PreOrderForm';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

/**
 * New Pre-order (Phase 11 / 11.4).
 *
 * Server component. Loads the list of products that are
 * open for pre-ordering and passes it to the client form.
 * If there are no pre-orderable products yet, the page
 * shows a small explainer instead of a broken form.
 */
export default async function NewPreOrderPage() {
  const res = await listPreOrderableProducts();
  const products = res.data ?? [];

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white"
      >
        <ChevronLeft className="w-3 h-3" />
        Dashboard
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl text-tactical text-tactical">New Pre-order</h1>
        <p className="text-white/60 text-sm uppercase tracking-wider">
          Register a customer for a future import
        </p>
      </div>

      {products.length === 0 ? (
        <EmptyState
          error={res.error}
          hasAnyProduct={res.error ? false : products.length === 0}
        />
      ) : (
        <PreOrderForm products={products} />
      )}
    </div>
  );
}

function EmptyState({
  error,
  hasAnyProduct,
}: {
  error?: string;
  hasAnyProduct: boolean;
}) {
  return (
    <div className="card-tactical border-tactical-orange/30 bg-tactical-orange/5 p-4 space-y-2">
      <p className="text-sm font-bold text-tactical-orange">
        No pre-orderable products yet
      </p>
      {error ? (
        <p className="text-xs text-white/60">Error: {error}</p>
      ) : (
        <p className="text-xs text-white/60">
          {hasAnyProduct
            ? 'You have products in the catalogue, but none of them are marked as available for pre-order yet. Open a product and toggle "Pre-order enabled" in its settings, then come back here.'
            : 'Add a product to your inventory first, then come back here to register a pre-order.'}
        </p>
      )}
      <Link
        href="/inventory"
        className="inline-block text-xs font-bold uppercase tracking-widest text-tactical-blue hover:text-tactical-neon"
      >
        Go to inventory →
      </Link>
    </div>
  );
}
