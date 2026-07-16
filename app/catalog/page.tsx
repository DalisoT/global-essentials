import { getCatalogProducts } from '@/lib/actions/catalog';
import { getCategories } from '@/lib/actions/categories';
import { getActivePreOrderCountsByProduct } from '@/lib/actions/pre-orders';
import { CatalogClient } from './CatalogClient';
import { CatalogChatWidget } from '@/components/catalog/CatalogChatWidget';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const [{ data: products }, { data: categories }, { data: preOrderCounts }] =
    await Promise.all([
      getCatalogProducts(),
      getCategories(),
      getActivePreOrderCountsByProduct(),
    ]);

  return (
    <>
      <CatalogClient
        products={products || []}
        categories={categories || []}
        preOrderCounts={preOrderCounts ?? {}}
      />
      <CatalogChatWidget />
    </>
  );
}