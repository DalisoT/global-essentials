import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { VisualSearchClient } from '@/components/catalog/VisualSearchClient';

/**
 * Public catalog page: visual product search (Phase 8 / 8.2).
 *
 * Customers upload (or drag-drop) a product photo. We send it to
 * Groq's vision model together with the shop's product names, and
 * the model returns the top 1-3 matches. The customer clicks through
 * to the product detail page.
 *
 * No auth required — catalog browsing is anonymous.
 */
export default function VisualSearchPage() {
  return (
    <div className="min-h-screen bg-black px-4 py-6 max-w-2xl mx-auto">
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to catalog
      </Link>

      <div className="space-y-1 mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-tactical-blue" />
          <h1 className="text-2xl font-black tracking-tighter">Visual Search</h1>
        </div>
        <p className="text-xs text-white/50 uppercase tracking-wider">
          Upload a photo · AI finds the closest matches
        </p>
      </div>

      <VisualSearchClient />
    </div>
  );
}
