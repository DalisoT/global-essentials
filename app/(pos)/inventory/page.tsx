'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getInventory, createProduct, updateProduct, deleteProduct, uploadProductImage } from '@/lib/actions/inventory';
import { formatCurrency } from '@/lib/utils';
import { Package, Plus, X, Pencil, Trash2, Search, ImagePlus, Upload, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/appwrite-types';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  // Form state
  const [name, setName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stockLevel, setStockLevel] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    loadProducts();
  }, [page]);

  const loadProducts = async () => {
    const offset = (page - 1) * PAGE_SIZE;
    const { data, count } = await getInventory({ limit: PAGE_SIZE, offset });
    if (data) setProducts(data as unknown as Product[]);
    setTotalCount(count || 0);
  };

  const resetForm = () => {
    setName('');
    setCostPrice('');
    setSellingPrice('');
    setStockLevel('');
    setImageUrl('');
    setImageFile(null);
    setImagePreview(null);
    setEditingProduct(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCostPrice(product.cost_price.toString());
    setSellingPrice(product.selling_price.toString());
    setStockLevel(product.stock_level.toString());
    setImageUrl(product.image_url || '');
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!name || !costPrice || !sellingPrice || !stockLevel) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);

    let finalImageUrl = imageUrl;

    if (imageFile) {
      setIsUploadingImage(true);
      const reader = new FileReader();
      const imageData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });
      const { data: uploadedUrl, error: uploadError } = await uploadProductImage(imageData);
      setIsUploadingImage(false);

      if (uploadError) {
        toast.error('Failed to upload image');
        setIsSubmitting(false);
        return;
      }

      finalImageUrl = uploadedUrl!;
    }

    const productData = {
      name,
      cost_price: parseFloat(costPrice),
      selling_price: parseFloat(sellingPrice),
      stock_level: parseInt(stockLevel),
      image_url: finalImageUrl || undefined,
    };

    const { error } = editingProduct
      ? await updateProduct(editingProduct.id, productData)
      : await createProduct(productData);

    setIsSubmitting(false);

    if (error) {
      toast.error(editingProduct ? 'Failed to update' : 'Failed to create');
    } else {
      toast.success(editingProduct ? 'Product updated' : 'Product created');
      setShowModal(false);
      resetForm();
      loadProducts();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await deleteProduct(id);
    if (error) {
      toast.error('Failed to delete product');
    } else {
      toast.success('Product deleted');
      loadProducts();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Use JPEG, PNG, WebP, or GIF.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Max 5MB.');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageUrl('');
  };

  const clearImageFile = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-tactical text-tactical">INVENTORY</h1>
          <p className="text-white/60 text-sm uppercase tracking-wider">
            {products.length} Products
          </p>
        </div>
        <button onClick={openCreate} className="btn-tactical px-4">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
        />
      </div>

      {/* Pagination */}
      {Math.ceil(totalCount / PAGE_SIZE) > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/50">
            {totalCount} products
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-white/50">
              Page {page}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / PAGE_SIZE), p + 1))}
              disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className={cn(
              'card-tactical',
              product.stock_level <= 5 && product.stock_level > 0 && 'border-tactical-orange',
              product.stock_level === 0 && 'border-tactical-red opacity-60'
            )}
          >
            {/* Image */}
            <div className="w-full aspect-square rounded-xl bg-white/5 mb-3 flex items-center justify-center overflow-hidden">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="w-12 h-12 text-white/20" />
              )}
            </div>

            {/* Info */}
            <div className="space-y-1 mb-3">
              <p className="font-bold text-sm truncate">{product.name}</p>
              <p className="text-lg font-black text-tactical-neon">
                {formatCurrency(product.selling_price)}
              </p>
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold uppercase tracking-wide ${
                    product.stock_level === 0
                      ? 'text-tactical-red'
                      : product.stock_level <= 5
                      ? 'text-tactical-orange'
                      : 'text-white/40'
                  }`}
                >
                  Stock: {product.stock_level}
                </span>
                <span className="text-xs text-white/30">
                  Cost: {formatCurrency(product.cost_price)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => openEdit(product)}
                className="flex-1 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(product.id)}
                className="flex-1 p-2 rounded-lg bg-tactical-red/10 hover:bg-tactical-red/20 text-tactical-red transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-tactical-slate rounded-t-3xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tight">
                {editingProduct ? 'Edit Product' : 'New Product'}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">
                  Product Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter product name"
                  className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">
                    Cost Price
                  </label>
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">
                    Selling Price
                  </label>
                  <input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">
                  Stock Level
                </label>
                <input
                  type="number"
                  value={stockLevel}
                  onChange={(e) => setStockLevel(e.target.value)}
                  placeholder="0"
                  className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">
                  Product Image
                </label>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Image Preview */}
                {(imagePreview || imageUrl) && (
                  <div className="relative mb-3 w-full aspect-square rounded-xl overflow-hidden bg-white/5">
                    <img
                      src={imagePreview || imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={clearImageFile}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white/80 hover:text-white"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* Upload or URL Toggle */}
                {!imagePreview && !imageUrl && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-14 flex items-center justify-center gap-2 bg-white/5 border border-white/10 border-dashed rounded-xl text-white/60 hover:text-white hover:border-tactical-blue transition-colors"
                    >
                      <ImagePlus className="w-5 h-5" />
                      <span>Upload from Gallery</span>
                    </button>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-xs text-white/30 uppercase">or</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Paste image URL"
                      className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
                    />
                  </div>
                )}

                {/* Change image button when preview/url exists */}
                {(imagePreview || imageUrl) && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-12 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:border-tactical-blue transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">Change Image</span>
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploadingImage}
              className="w-full btn-tactical"
            >
              {isSubmitting || isUploadingImage
                ? isUploadingImage
                  ? 'Uploading Image...'
                  : 'Saving...'
                : editingProduct
                  ? 'Update Product'
                  : 'Add Product'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
