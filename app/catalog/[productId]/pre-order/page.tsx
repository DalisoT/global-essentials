import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getProductById } from '@/lib/actions/catalog';
import { getProductVariantsForCatalog } from './helpers';
import { CatalogPreOrderForm } from './CatalogPreOrderForm';

/**
 * Public catalog pre-order form (Phase 11 / 11.7).
 *
 * Server component. Loads the product (and its variants) from
 * the catalog action (which is already public-safe) and hands
 * it to the client form. The form uses the service-role action
 * `createCatalogPreOrder` so the customer doesn't need an
 * account.
 *
 * Rate-limited: 5 submissions per IP per 10 minutes (in-process,
 * not durable across cold starts — fine for v1).
 */
export default async function CatalogPreOrderPage({
  params,
  searchParams,
}: {
  params: { productId: string };
  searchParams: { v?: string };
}) {
  const { data: product } = await getProductById(params.productId);
  if (!product) notFound();

  const typedProduct = product as unknown as {
    id: string;
    name: string;
    selling_price: number;
    pre_order_enabled: boolean;
    image_url: string | null;
    image_urls: string[] | null;
  };
  if (!typedProduct.pre_order_enabled) {
    return (
      <div className="min-h-screen bg-black text-white p-6 max-w-md mx-auto">
        <Link
          href={`/catalog/${params.productId}`}
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to product
        </Link>
        <h1 className="text-xl font-bold">Pre-orders not available</h1>
        <p className="text-sm text-white/60 mt-2">
          This product is not open for pre-ordering right now.
        </p>
      </div>
    );
  }

  const { variants } = await getProductVariantsForCatalog(params.productId);
  const preselectedVariantId = searchParams.v ?? '';

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <Link
            href={`/catalog/${params.productId}`}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold uppercase tracking-wide text-sm">Back to product</span>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-md">
        <div className="py-6 space-y-1">
          <h1 className="text-2xl font-black uppercase tracking-tight">Pre-order</h1>
          <p className="text-sm text-white/60">
            Reserve this item for the next shipment. Pay a deposit now, balance on delivery.
          </p>
        </div>

        <CatalogPreOrderForm
          product={typedProduct}
          variants={variants}
          preselectedVariantId={preselectedVariantId}
        />
      </div>
    </div>
  );
}
