export interface Product {
  id: string;
  name: string;
  cost_price: number;
  selling_price: number;
  stock_level: number;
  image_url: string | null;
  image_urls: string[] | null;
  category_id: string | null;
  is_visible_in_catalog?: boolean;
  catalog_price?: number | null;
  /** Phase 7.7 — days from order placement to supplier delivery. */
  lead_time_days?: number;
  /** Phase 8.1 — public catalog long-form description (Groq-generated, human-edited). */
  description?: string | null;
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
  /** Units of `product_id` sold in this row. Defaults to 1. */
  quantity: number;
  payment_status: 'paid' | 'pending';
  payment_method: 'cash' | 'pay-slow';
  created_at: string;
  updated_at: string;
}

export interface Installment {
  id: string;
  sale_id: string;
  amount_due: number;
  amount_paid: number | null;
  due_date: string;
  is_paid: boolean;
  paid_at: string | null;
  note: string | null;
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

// ─────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────

/** Row as written to `audit_log`. See ROADMAP.md#F10. */
export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  /** Free-form JSONB. UI should render defensively (keys may change per action). */
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Audit log row joined with the actor's profile (full_name, role). */
export interface AuditLogWithActor extends AuditLog {
  actor: {
    id: string;
    full_name: string | null;
    role: string | null;
  } | null;
}

// ─────────────────────────────────────────────
// AI USAGE
// ─────────────────────────────────────────────

/** One row per AI call. See ROADMAP.md#3A.4. */
export interface AiUsage {
  id: string;
  /** Null for background / system calls. */
  user_id: string | null;
  /** Free-form feature tag, e.g. 'cfo' | 'analytics' | 'reminder' | 'advisor'. */
  route: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  model: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────
// LEARNING ACADEMY (Phase 4)
// ─────────────────────────────────────────────

/** A category of lessons. e.g. 'Financial Literacy', 'Diversification'. */
export interface Pillar {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Lucide icon name. The UI does a dynamic import. */
  icon: string | null;
  /** Tailwind color token, e.g. 'tactical-blue'. */
  color: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

/** A single lesson. body_md is rendered with a small markdown renderer. */
export interface Lesson {
  id: string;
  pillar_id: string;
  slug: string;
  title: string;
  body_md: string;
  audio_url: string | null;
  est_minutes: number;
  display_order: number;
  /** Which data sources the lesson "needs" to be most useful. */
  requires_data: string[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

/** Per-user progress on a single lesson. UNIQUE(user_id, lesson_id). */
export interface UserLessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  started_at: string;
  completed_at: string | null;
  /** 0-100. NULL = quiz not yet taken. */
  quiz_score: number | null;
  scroll_depth_pct: number;
  read_seconds: number;
  bookmarked: boolean;
  last_seen_at: string;
}

/** Link from a lesson to an internal route, external URL, or app action. */
export interface LessonResource {
  id: string;
  lesson_id: string;
  label: string;
  /** Route, URL, or app:// scheme. */
  href: string;
  /** 'internal' | 'external' | 'action'. */
  kind: string;
  display_order: number;
}

/** Lesson joined with its progress for the current user (or null if untouched). */
export interface LessonWithProgress extends Lesson {
  progress: UserLessonProgress | null;
  pillar: Pick<Pillar, 'id' | 'slug' | 'name' | 'color'>;
}

// ─────────────────────────────────────────────────────────────────────
// Predictive AI / forecasting (Phase 7)
// ─────────────────────────────────────────────────────────────────────

/** Discriminator for what kind of forecast a row represents. */
export type ForecastKind = 'demand' | 'cashflow' | 'default_risk' | 'review_summary';

/**
 * One row in the `forecasts` table. The shape of `payload` depends
 * on `kind` — the TypeScript types for each kind's payload live in
 * `lib/actions/forecast.ts` (Phase 7.2–7.4).
 */
export interface Forecast {
  id: string;
  kind: ForecastKind;
  /** NULL for business-wide (cashflow) forecasts. */
  target_id: string | null;
  horizon_days: number;
  payload: Record<string, unknown>;
  /** 'simple-moving-avg' | 'groq-llama-3.3-70b' | 'rule-based' | ... */
  model: string;
  generated_at: string;
  /** When the row should be regenerated by the nightly cron (7.8). */
  expires_at: string;
  created_at: string;
  updated_at: string;
}

/** Demand forecast payload — series of (date, qty) for a product. */
export interface DemandForecastPayload {
  /** [{date: 'YYYY-MM-DD', predicted_qty: number, lower: number, upper: number}] */
  series: Array<{
    date: string;
    predicted_qty: number;
    /** Lower bound (e.g. 80% lower). Used for the chart fill. */
    lower: number;
    /** Upper bound. */
    upper: number;
  }>;
  /** Simple heuristic. 0-1. */
  confidence: number;
  /** Human-readable method label, e.g. "30-day moving average". */
  method_label: string;
}

/** Cash-flow forecast payload — daily inflows vs outflows for the next N days. */
export interface CashflowForecastPayload {
  /** [{date: 'YYYY-MM-DD', inflow: number, outflow: number, net: number, cumulative: number}] */
  series: Array<{
    date: string;
    inflow: number;
    outflow: number;
    net: number;
    /** Running total starting from today's opening cash. */
    cumulative: number;
  }>;
  /** Sum of all inflows in the horizon. */
  total_inflow: number;
  /** Sum of all outflows in the horizon. */
  total_outflow: number;
  /** Net position at the end of the horizon. */
  end_cash: number;
  /** Day the cumulative cash is lowest. */
  min_cash_day: string;
  min_cash_amount: number;
}

/** Default-risk forecast payload — probability + factors for a client. */
export interface DefaultRiskForecastPayload {
  /** 0-1. */
  probability: number;
  /** 'low' | 'medium' | 'high' */
  risk_band: 'low' | 'medium' | 'high';
  /** Top factors that drove the score, in order of importance. */
  factors: Array<{
    label: string;
    /** Positive = increases risk, negative = decreases. */
    impact: number;
  }>;
  /** Optional short AI-generated recommendation. */
  recommendation?: string;
}

/** Review-summary payload — Groq-distilled themes from the reviews. */
export interface ReviewSummaryPayload {
  /** 1-2 sentence overall sentiment ('overwhelmingly positive', 'mixed', etc). */
  overall: string;
  /** Top themes mentioned across the reviews, in order of frequency. */
  themes: Array<{
    label: string; // 1-3 words
    sentiment: 'positive' | 'negative' | 'mixed';
  }>;
  /** Up to 3 verbatim quotes (1-2 sentences each). */
  quotes: string[];
  /** How many reviews were summarised into this. */
  reviewCount: number;
}

// ─────────────────────────────────────────────────────────────────────
// AI Recommendations inbox (Phase 9)
// ─────────────────────────────────────────────────────────────────────

/** Discriminator for the kind of AI recommendation. */
export type AIRecommendationKind =
  | 'reorder_alert'
  | 'cashflow_warning'
  | 'anomaly'
  | 'weekly_briefing'
  | 'goal_progress'
  | 'forecast_alert'
  | 'custom';

export type AIRecommendationPriority = 'low' | 'medium' | 'high';

export type AIRecommendationStatus =
  | 'pending'     // not yet shown
  | 'delivered'   // shown to the user
  | 'dismissed'   // user discarded
  | 'accepted'    // user marked as useful
  | 'acted_on';   // user took the suggested action

/**
 * One row in the `ai_recommendations` inbox. The payload is
 * kind-specific (see lib/actions/recommendations.ts for the
 * per-kind shape).
 */
export interface AIRecommendation {
  id: string;
  kind: AIRecommendationKind;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  priority: AIRecommendationPriority;
  status: AIRecommendationStatus;
  source_action: string | null;
  related_id: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  dismissed_at: string | null;
  acted_on_at: string | null;
  expires_at: string | null;
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

export interface ShippingRate {
  id: string;
  shipping_type: string;
  carrier: string;
  transit_days: number;
  rate_type: 'per_kg' | 'per_cbm' | 'per_ton';
  tier_min_kg: number | null;
  tier_max_kg: number | null;
  rate: number;
  volume_min_cbm: number | null;
  volume_max_cbm: number | null;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRateCustom {
  id: string;
  currency_pair: string;
  rate: number;
  updated_at: string;
}

// ─────────────────────────────────────────────
// ONLINE STORE TYPES
// ─────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  subtotal: number;
  shipping_cost: number;
  total: number;
  shipping_method: string | null;
  shipping_tracking: string | null;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shipping_address_line: string | null;
  shipping_city: string | null;
  shipping_province: string | null;
  shipping_postal_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  maxStock: number;
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
      shipping_rates: {
        Row: ShippingRate;
        Insert: Omit<ShippingRate, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ShippingRate, 'id' | 'created_at'>>;
      };
      exchange_rates_custom: {
        Row: ExchangeRateCustom;
        Insert: Omit<ExchangeRateCustom, 'id' | 'updated_at'>;
        Update: Partial<Omit<ExchangeRateCustom, 'id'>>;
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];