import { create } from 'zustand';

interface ClientInfo {
  id: string;
  full_name: string;
  phone_number: string;
  created_at: string;
}

interface ClientHistoryData {
  client: ClientInfo;
  sales: Array<{
    id: string;
    created_at: string;
    total_amount: number;
    payment_status: 'paid' | 'pending';
    payment_method: 'cash' | 'pay-slow';
    product: { name: string };
  }>;
  installments: Array<{
    id: string;
    amount_due: number;
    due_date: string;
    is_paid: boolean;
    paid_at: string | null;
    sale_id: string;
  }>;
  timeline: Array<{
    id: string;
    type: 'sale' | 'payment';
    date: string;
    productName?: string;
    amount: number;
    isPaid?: boolean;
    dueDate?: string;
  }>;
  totalDebt: number;
  totalPaid: number;
  onTimePayments: number;
  latePayments: number;
}

interface ClientStore {
  selectedClientId: string | null;
  clientHistory: ClientHistoryData | null;
  isLoading: boolean;
  setSelectedClientId: (id: string | null) => void;
  setClientHistory: (history: ClientHistoryData | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useClientStore = create<ClientStore>((set) => ({
  selectedClientId: null,
  clientHistory: null,
  isLoading: false,
  setSelectedClientId: (selectedClientId) => set({ selectedClientId }),
  setClientHistory: (clientHistory) => set({ clientHistory }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () =>
    set({
      selectedClientId: null,
      clientHistory: null,
      isLoading: false,
    }),
}));