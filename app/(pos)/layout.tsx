'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  AlertCircle,
  Package,
  TrendingUp,
  Wallet,
  Download,
  LogOut,
  User,
} from 'lucide-react';
import { signOut } from '@/lib/actions/auth';
import { useAuthStore } from '@/stores/auth-store';
import { GlobalSearch } from '@/components/GlobalSearch';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/new-sale', label: 'New Sale', icon: ShoppingCart },
  { href: '/ledger', label: 'Ledger', icon: BookOpen },
  { href: '/debts', label: 'Debts', icon: AlertCircle },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/expenses', label: 'Expenses', icon: Wallet },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/export', label: 'Export', icon: Download },
];

function NavItem({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center gap-1 px-3 py-2 rounded-xl',
        'text-[10px] font-semibold uppercase tracking-wide',
        'transition-all duration-200 hover:text-tactical-blue active:scale-95',
        'text-white/60'
      )}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </Link>
  );
}

export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-tactical-blue flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {user?.fullName || 'Staff'}
              </p>
              <p className="text-xs text-white/40 capitalize">{user?.role || 'staff'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <form action={signOut}>
              <button
                type="submit"
                className="p-2 rounded-lg bg-tactical-slate hover:bg-white/10 transition-colors text-white/60"
                aria-label="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto">{children}</main>

      {/* Glassmorphism Bottom Navbar - scrollable */}
      <nav className="fixed bottom-0 left-0 right-0 glassmorphism">
        <div className="flex items-center justify-start px-2 py-3 max-w-lg mx-auto gap-1 overflow-x-auto hide-scrollbar">
          {navItems.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>
      </nav>
    </div>
  );
}