import type { Product, Client, Sale, Installment, Expense } from './supabase-types';

export type {
  Product,
  Client,
  Sale,
  Installment,
  Expense,
};

export interface DashboardStats {
  groundTruth: number;
  inPipeline: number;
  lowStockProducts: Product[];
  recentSales: (Sale & { product?: Product; client?: Client })[];
  upcomingInstallments: (Installment & { sale?: Sale & { client?: Client } })[];
}

export interface CatalogProduct {
  id: string;
  name: string;
  selling_price: number;
  image_url: string | null;
  image_urls?: string[] | null;
}