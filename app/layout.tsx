import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { AuthProvider } from './providers';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { InstallPrompt } from '@/components/InstallPrompt';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Global Essentials - POS & Debt Management',
  description: 'Mobile-first POS system with debt management for Global Essentials',
  applicationName: 'Global Essentials',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Essentials',
    statusBarStyle: 'black-translucent',
    startupImage: [
      // iPhone X/XS/11 Pro (812x375pt @3x = 1242x2436)
      // iOS will fall back to background_color (#0a0a0a) for sizes not
      // listed here, so a brief black flash is acceptable.
    ],
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
  // viewport-fit=cover lets the PWA use the area behind the iPhone notch /
  // Android cutout. Combined with safe-area-inset-* in CSS, the UI sits in
  // the visible region.
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <ServiceWorkerRegistration />
          <InstallPrompt />
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}