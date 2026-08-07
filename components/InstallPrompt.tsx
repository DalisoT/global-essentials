'use client';

import { useState, useEffect } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { cn } from '@/lib/utils';

/**
 * Bottom-of-screen banner that prompts the user to install the PWA.
 *
 * - On Android/Desktop (Chromium): shows an "Install" button that fires the
 *   browser's native prompt (we caught the event in useInstallPrompt).
 * - On iOS Safari: shows step-by-step instructions (Share → Add to Home Screen)
 *   because iOS doesn't fire beforeinstallprompt.
 *
 * The banner is dismissable and stays dismissed for 7 days. It's hidden
 * completely when the app is already installed (display-mode: standalone).
 */
export function InstallPrompt() {
  const { shouldShowBanner, isIOS, isInstalled, promptInstall, dismissBanner } = useInstallPrompt();
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [outcome, setOutcome] = useState<'accepted' | 'dismissed' | null>(null);

  // Animate in after a short delay so it doesn't pop in immediately on page load
  useEffect(() => {
    if (shouldShowBanner) {
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [shouldShowBanner]);

  if (isInstalled || (!shouldShowBanner && !visible)) return null;

  const handleInstall = async () => {
    setInstalling(true);
    const result = await promptInstall();
    setInstalling(false);
    if (result === 'accepted' || result === 'dismissed') {
      setOutcome(result);
    }
    if (result === 'accepted') {
      // Browser will fire 'appinstalled' which hides us via the hook
      setTimeout(() => setVisible(false), 1500);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install app"
      className={cn(
        'fixed left-3 right-3 z-50 transition-all duration-300',
        // Sit just above the bottom nav (which is fixed bottom-0)
        'bottom-20 sm:bottom-24',
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-full opacity-0 pointer-events-none'
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-lg mx-auto bg-tactical-slate border border-tactical-blue/30 rounded-2xl shadow-tactical-lg p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-tactical-blue/20 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-tactical-blue" />
        </div>

        <div className="flex-1 min-w-0">
          {outcome === 'accepted' ? (
            <>
              <p className="font-bold text-tactical-neon text-sm">Installing…</p>
              <p className="text-xs text-white/60">Almost done.</p>
            </>
          ) : showIOSHelp ? (
            <>
              <p className="font-bold text-white text-sm">Add to Home Screen</p>
              <ol className="text-xs text-white/60 mt-1.5 space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  <span className="flex items-center gap-1">
                    Tap the <Share className="w-3 h-3 inline" /> <span className="font-semibold">Share</span> button
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                  <span className="flex items-center gap-1">
                    Scroll, tap <Plus className="w-3 h-3 inline" /> <span className="font-semibold">Add to Home Screen</span>
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                  <span>Tap <span className="font-semibold">Add</span></span>
                </li>
              </ol>
              <button
                onClick={() => setShowIOSHelp(false)}
                className="text-xs text-tactical-blue mt-2 font-semibold"
              >
                ← Back
              </button>
            </>
          ) : (
            <>
              <p className="font-bold text-white text-sm">Install Global Essentials</p>
              <p className="text-xs text-white/60 mt-0.5">
                Add to your home screen for one-tap access. Works offline.
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                {isIOS ? (
                  <button
                    onClick={() => setShowIOSHelp(true)}
                    className="px-3 py-1.5 rounded-lg bg-tactical-blue text-white text-xs font-bold"
                  >
                    How to install
                  </button>
                ) : (
                  <button
                    onClick={handleInstall}
                    disabled={installing}
                    className="px-3 py-1.5 rounded-lg bg-tactical-blue text-white text-xs font-bold disabled:opacity-50"
                  >
                    {installing ? 'Installing…' : 'Install'}
                  </button>
                )}
                <button
                  onClick={dismissBanner}
                  className="text-xs text-white/40 font-semibold px-2"
                >
                  Not now
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={dismissBanner}
          aria-label="Dismiss install prompt"
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
