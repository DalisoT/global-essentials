import Link from 'next/link';
import { Star } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center px-6 space-y-6">
        <div className="w-24 h-24 rounded-3xl bg-white/5 flex items-center justify-center mx-auto">
          <Star className="w-12 h-12 text-white/20" />
        </div>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Product Not Found</h1>
          <p className="text-white/40 mt-2">This product may have been removed or is out of stock.</p>
        </div>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-tactical-blue text-white font-bold hover:bg-tactical-blue/80 transition-colors"
        >
          Back to Catalog
        </Link>
      </div>
    </div>
  );
}
