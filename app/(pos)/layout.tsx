'use client';

import { useState } from 'react';
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
  CloudOff,
  Plane,
  Settings,
  Menu,
  X,
  MoreHorizontal,
  Calculator,
  BarChart3,
  ShieldCheck,
  Brain,
  GraduationCap,
} from 'lucide-react';
import { signOut } from '@/lib/actions/auth';
import { useAuthStore } from '@/stores/auth-store';
import { GlobalSearch } from '@/components/GlobalSearch';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { motion, AnimatePresence } from 'framer-motion';

const primaryNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/new-sale', label: 'New Sale', icon: ShoppingCart },
  { href: '/ledger', label: 'Ledger', icon: BookOpen },
  { href: '/debts', label: 'Debts', icon: AlertCircle },
  { href: '/orders', label: 'Orders', icon: Package },
];

const secondaryNav = [
  // AI CFO is the flagship of Phase 3 — surface it first in the drawer
  // so it's one tap from any screen, not buried under the rest.
  { href: '/cfo', label: 'AI CFO', icon: Brain },
  // Learning Academy (Phase 4) — surface it right after AI CFO so the
  // two flagship features sit together at the top of the drawer.
  { href: '/learn', label: 'Learning Academy', icon: GraduationCap },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/expenses', label: 'Expenses', icon: Wallet },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/profitability', label: 'Profitability', icon: BarChart3 },
  { href: '/accounting', label: 'Accounting', icon: Calculator },
  { href: '/import-simulator', label: 'Import', icon: Plane },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/export', label: 'Export', icon: Download },
];

// Admin-only surfaces. Kept separate from `secondaryNav` so non-admins never
// see the link — defense in depth, since the audit page itself also blocks
// non-admins (F10).
const adminNav = [
  { href: '/audit', label: 'Audit Log', icon: ShieldCheck },
];

function NavItem({
  href,
  label,
  icon: Icon,
  compact = false,
  iconOnly = false,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-1 rounded-xl transition-all duration-200 hover:text-tactical-blue active:scale-95',
        iconOnly
          ? 'flex-1 flex-col items-center justify-center py-3 px-1 min-w-0'
          : compact
            ? 'px-3 py-2.5'
            : 'px-4 py-3',
        'text-white/60'
      )}
    >
      <Icon className={cn('shrink-0', iconOnly ? 'w-5 h-5' : 'w-5 h-5')} />
      {!iconOnly && (
        <span className={cn('font-semibold uppercase tracking-wide', compact ? 'text-[10px]' : 'text-xs')}>
          {label}
        </span>
      )}
      {iconOnly && (
        <span className="text-[9px] font-semibold uppercase tracking-wide truncate w-full text-center mt-0.5">
          {label}
        </span>
      )}
    </Link>
  );
}

function DrawerItem({
  href,
  label,
  icon: Icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-4 px-4 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all"
    >
      <Icon className="w-5 h-5 text-tactical-blue" />
      <span className="font-semibold text-sm">{label}</span>
    </Link>
  );
}

export default function POSLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { pendingCount, isSyncing, syncError } = useSyncStatus();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black pb-24">
      <ServiceWorkerRegistration />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-tactical-blue flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{user?.fullName || 'Staff'}</p>
              <p className="text-xs text-white/40 capitalize">{user?.role || 'staff'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {pendingCount > 0 && (
              <div className={`
                flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold
                ${isSyncing ? 'bg-tactical-blue/20 text-tactical-blue animate-pulse' : 'bg-tactical-orange/20 text-tactical-orange'}
                ${syncError ? 'bg-tactical-red/20 text-tactical-red' : ''}
              `}>
                <CloudOff className="w-3 h-3" />
                {isSyncing ? 'Syncing...' : `${pendingCount} pending`}
              </div>
            )}
            {syncError && pendingCount === 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-tactical-red/20 text-tactical-red text-xs font-bold">
                <AlertCircle className="w-3 h-3" />
                Sync failed
              </div>
            )}
            <GlobalSearch />
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto">{children}</main>

      {/* Bottom Nav - 5 primary items, icon-only, evenly spaced */}
      <nav className="fixed bottom-0 left-0 right-0 glassmorphism">
        <div className="flex items-center max-w-lg mx-auto">
          {primaryNav.map((item) => (
            <NavItem key={item.href} {...item} compact iconOnly />
          ))}
        </div>
      </nav>

      {/* Side Drawer - secondary items */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-72 bg-tactical-slate z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <MoreHorizontal className="w-5 h-5 text-tactical-blue" />
                  <span className="font-bold text-white">More</span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {secondaryNav.map((item) => (
                  <DrawerItem
                    key={item.href}
                    {...item}
                    onClick={() => setDrawerOpen(false)}
                  />
                ))}
                {user?.role === 'admin' && (
                  <>
                    <div className="h-px bg-white/10 my-2" />
                    {adminNav.map((item) => (
                      <DrawerItem
                        key={item.href}
                        {...item}
                        onClick={() => setDrawerOpen(false)}
                      />
                    ))}
                  </>
                )}
              </div>
              <div className="p-3 border-t border-white/10">
                <form action={signOut}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-all"
                  >
                    <LogOut className="w-5 h-5 text-tactical-red" />
                    <span className="font-semibold text-sm">Sign Out</span>
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}