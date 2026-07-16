import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getPreOrder } from '@/lib/actions/pre-orders';
import { getPreOrderDetailProducts } from './helpers';
import { PreOrderDetail } from '@/components/pre-orders/PreOrderDetail';

/**
 * Pre-order detail (Phase 11 / 11.5).
 *
 * Server component. Fetches the pre-order + its product
 * (for the image / size info) and hands it to the client
 * detail component which handles the action buttons.
 */
export default async function PreOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const res = await getPreOrder(params.id);
  if (res.error || !res.data) {
    return notFound();
  }
  const order = res.data;

  const { product, variant } = await getPreOrderDetailProducts(
    order.product_id,
    order.variant_id
  );

  return (
    <div className="space-y-4">
      <Link
        href="/pre-orders"
        className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white"
      >
        <ChevronLeft className="w-3 h-3" />
        All pre-orders
      </Link>
      <PreOrderDetail
        order={order}
        events={order.events}
        product={product}
        variant={variant}
      />
    </div>
  );
}
