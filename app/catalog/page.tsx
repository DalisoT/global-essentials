import { getCatalogProducts } from '@/lib/actions/catalog';
import { getCategories } from '@/lib/actions/categories';
import { CatalogClient } from './CatalogClient';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const [{ data: products }, { data: categories }] = await Promise.all([
    getCatalogProducts(),
    getCategories(),
  ]);

  return <CatalogClient products={products || []} categories={categories || []} />;
}