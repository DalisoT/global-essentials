export interface User {
  id: string;
  email?: string;
  fullName: string;
  role: 'staff' | 'admin';
  preferences: Record<string, unknown>;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}