import Link from 'next/link';
import { getCatalogProducts } from '@/lib/actions/catalog';
import { MessageCircle, Phone } from 'lucide-react';
import { AnimatedProductCard } from './AnimatedProductCard';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const { data: products } = await getCatalogProducts();

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-tactical-blue/20 via-transparent to-tactical-neon/10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-tactical-blue/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-tactical-neon/20 rounded-full blur-3xl" />

        <div className="relative container mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-4">
            <img src="/logo.png" alt="Global Essentials Logo" className="w-14 h-14 rounded-2xl object-contain bg-white/10 p-1" />
            <div>
              <h1 className="text-3xl font-black tracking-tighter">GLOBAL ESSENTIALS</h1>
              <p className="text-white/60 uppercase tracking-widest text-sm">Premium Products</p>
            </div>
          </div>

          <p className="text-lg text-white/80 max-w-md leading-relaxed">
            Browse our collection of premium essentials. Quality products at unbeatable prices.
          </p>

          <Link
            href="https://wa.me/"
            target="_blank"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-2xl bg-tactical-neon text-black font-bold hover:bg-tactical-neon/90 transition-all hover:scale-105"
          >
            <MessageCircle className="w-5 h-5" />
            Chat with Us
          </Link>
        </div>
      </header>

      {/* Products Grid */}
      <section className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black uppercase tracking-tight">Featured Products</h2>
          <span className="text-sm text-white/40">{products?.length || 0} items</span>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products?.map((product: any, index: number) => (
            <AnimatedProductCard
              key={product.id}
              product={product}
              index={index}
            />
          ))}
        </div>

        {(!products || products.length === 0) && (
          <div className="text-center py-16">
            <Star className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 uppercase tracking-widest">No products available</p>
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-tactical-blue to-tactical-neon opacity-20" />
          <div className="relative p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-4">
              Can&apos;t Find What You&apos;re Looking For?
            </h2>
            <p className="text-white/70 mb-6 max-w-md mx-auto">
              Contact us directly and we&apos;ll help you find the perfect product for your needs.
            </p>
            <Link
              href="https://wa.me/"
              target="_blank"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-tactical-neon text-black font-bold text-lg hover:bg-white transition-all hover:scale-105"
            >
              <Phone className="w-5 h-5" />
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 mt-12">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-black uppercase tracking-tight">Global Essentials</span>
          </div>
          <p className="text-white/40 text-sm">Premium Quality. Fair Prices.</p>
          <p className="text-white/20 text-xs mt-2">© 2024 Global Essentials. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
