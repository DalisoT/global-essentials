export interface Product {
  id: string;
  name: string;
  cost_price: number;
  selling_price: number;
  stock_level: number;
  image_url: string | null;
  image_urls: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  full_name: string;
  phone_number: string;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  product_id: string;
  client_id: string;
  total_amount: number;
  payment_status: 'paid' | 'pending';
  payment_method: 'cash' | 'pay-slow';
  created_at: string;
  updated_at: string;
}

export interface Installment {
  id: string;
  sale_id: string;
  amount_due: number;
  due_date: string;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  created_at: string;
  updated_at: string;
}

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

export interface Database {
  public: {
    Tables: {
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'id' | 'created_at'>>;
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Client, 'id' | 'created_at'>>;
      };
      sales: {
        Row: Sale;
        Insert: Omit<Sale, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Sale, 'id' | 'created_at'>>;
      };
      installments: {
        Row: Installment;
        Insert: Omit<Installment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Installment, 'id' | 'created_at'>>;
      };
      expenses: {
        Row: Expense;
        Insert: Omit<Expense, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Expense, 'id' | 'created_at'>>;
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];