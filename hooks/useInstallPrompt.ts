'use client';

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface UseInstallPromptReturn {
  /** True if the browser fired beforeinstallprompt and we have a deferred prompt ready. */
  canInstall: boolean;
  /** True if the app is already installed (standalone or minimal-ui). */
  isInstalled: boolean;
  /** iOS Safari doesn't fire beforeinstallprompt — show manual instructions. */
  isIOS: boolean;
  /** Show the install banner (after user hasn't dismissed recently). */
  shouldShowBanner: boolean;
  /** Trigger the install prompt. Returns true if accepted, false if dismissed. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** Dismiss the banner — won't show again for 7 days. */
  dismissBanner: () => void;
}

const DISMISS_KEY = 'ge-install-dismissed';
const DISMISS_DAYS = 7;

/**
 * Hook to manage the PWA install prompt.
 *
 * Chromium browsers fire `beforeinstallprompt` when the app is installable.
 * iOS Safari doesn't fire this event — users must use Safari's "Add to
 * Home Screen" sheet manually. We detect iOS and expose that so the UI
 * can show tailored instructions ("tap the share button → Add to Home Screen").
 */
export function useInstallPrompt(): UseInstallPromptReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // start true to avoid flash

  useEffect(() => {
    // Detect installed state — display-mode: standalone is the W3C standard;
    // navigator.standalone is iOS Safari's legacy equivalent.
    const installed =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        // @ts-expect-error — non-standard but works on iOS
        window.navigator.standalone === true);
    setIsInstalled(installed);

    // iOS detection
    const ios =
      typeof window !== 'undefined' &&
      /iPad|iPhone|iPod/.test(window.navigator.userAgent) &&
      // @ts-expect-error — non-standard
      !window.MSStream;
    setIsIOS(ios);

    // Check if user dismissed recently
    const lastDismissed = localStorage.getItem(DISMISS_KEY);
    if (lastDismissed) {
      const daysSince = (Date.now() - Number(lastDismissed)) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_DAYS) {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    } else {
      setIsDismissed(false);
    }

    // Listen for the browser's install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful install
    const handleInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setIsDismissed(true);
  }, []);

  // Show banner if:
  //  - not installed
  //  - we have a deferred prompt OR the user is on iOS (manual instructions)
  //  - user hasn't dismissed recently
  //  - user has used the app at least once (we know this if there are no pending
  //    debts/sales, but a simpler signal is to wait a beat so the page is loaded)
  const shouldShowBanner =
    !isInstalled && !isDismissed && (deferredPrompt !== null || isIOS);

  return {
    canInstall: deferredPrompt !== null,
    isInstalled,
    isIOS,
    shouldShowBanner,
    promptInstall,
    dismissBanner,
  };
}
