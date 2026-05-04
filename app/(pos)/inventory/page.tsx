'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getInventory, createProduct, updateProduct, deleteProduct, uploadProductImages } from '@/lib/actions/inventory';
import { formatCurrency } from '@/lib/utils';
import { Package, Plus, X, Pencil, Trash2, Search, ImagePlus, Upload, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/supabase-types';
import { Skeleton, SkeletonCard, EmptyState } from '@/components/ui/Skeleton';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  // Form state
  const [name, setName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stockLevel, setStockLevel] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    loadProducts();
  }, [page]);

  const loadProducts = async () => {
    setIsLoading(true);
    const offset = (page - 1) * PAGE_SIZE;
    const { data, count } = await getInventory({ limit: PAGE_SIZE, offset });
    if (data) setProducts(data as unknown as Product[]);
    setTotalCount(count || 0);
    setIsLoading(false);
  };

  const resetForm = () => {
    setName('');
    setCostPrice('');
    setSellingPrice('');
    setStockLevel('');
    setImageUrls([]);
    setImageFiles([]);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImagePreviews([]);
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
    const existingUrls = product.image_urls && product.image_urls.length > 0
      ? product.image_urls
      : product.image_url
        ? [product.image_url]
        : [];
    setImageUrls(existingUrls);
    setImageFiles([]);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImagePreviews([]);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!name || !costPrice || !sellingPrice || !stockLevel) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);

    let finalImageUrls = [...imageUrls];

    if (imageFiles.length > 0) {
      setIsUploadingImages(true);
      const imageDataArray = await Promise.all(
        imageFiles.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            })
        )
      );
      const { data: uploadedUrls, error: uploadError } = await uploadProductImages(imageDataArray);
      setIsUploadingImages(false);

      if (uploadError) {
        toast.error('Failed to upload images');
        setIsSubmitting(false);
        return;
      }

      finalImageUrls = [...finalImageUrls, ...(uploadedUrls || [])];
    }

    const productData = {
      name,
      cost_price: parseFloat(costPrice),
      selling_price: parseFloat(sellingPrice),
      stock_level: parseInt(stockLevel),
      image_urls: finalImageUrls.length > 0 ? finalImageUrls : undefined,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid file type. Use JPEG, PNG, WebP, or GIF.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File too large. Max 5MB per image.');
        return;
      }
    }

    const newFiles = [...imageFiles, ...files];
    setImageFiles(newFiles);

    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    const isExisting = index < imageUrls.length;
    if (isExisting) {
      setImageUrls(imageUrls.filter((_, i) => i !== index));
    } else {
      const previewIndex = index - imageUrls.length;
      const urlToRevoke = imagePreviews[previewIndex];
      URL.revokeObjectURL(urlToRevoke);
      setImageFiles((prev) => prev.filter((_, i) => i !== previewIndex));
      setImagePreviews((prev) => prev.filter((_, i) => i !== previewIndex));
    }
  };

  const clearAllImages = () => {
    setImageFiles([]);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImagePreviews([]);
    setImageUrls([]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    const { error } = await deleteProduct(id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Product deleted');
      loadProducts();
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const allImageUrls = [...imageUrls, ...imagePreviews];

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
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search ? 'No products found' : 'No products yet'}
          description={search ? `No products match "${search}"` : 'Add your first product to get started'}
          action={openCreate}
          actionLabel="Add Product"
        />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filteredProducts.map((product) => {
            const productImageUrls = product.image_urls || [];
            const firstImage = productImageUrls[0] || product.image_url;
            return (
              <div
                key={product.id}
                className={cn(
                  'card-tactical',
                  product.stock_level <= 5 && product.stock_level > 0 && 'border-tactical-orange',
                  product.stock_level === 0 && 'border-tactical-red opacity-60'
                )}
              >
                {/* Image */}
                <div className="w-full aspect-square rounded-xl bg-white/5 mb-3 flex items-center justify-center overflow-hidden relative">
                  {firstImage ? (
                    <>
                      <img
                        src={firstImage}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      {productImageUrls.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                          +{productImageUrls.length - 1}
                        </div>
                      )}
                    </>
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
            );
          })}
        </div>
      )}

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
                  Product Images
                </label>

                {/* Hidden file input - multiple */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Image Previews Grid */}
                {allImageUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {allImageUrls.map((url, index) => (
                      <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-white/5">
                        <img
                          src={url}
                          alt={`Image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/80 hover:text-white"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-14 flex items-center justify-center gap-2 bg-white/5 border border-white/10 border-dashed rounded-xl text-white/60 hover:text-white hover:border-tactical-blue transition-colors"
                >
                  <ImagePlus className="w-5 h-5" />
                  <span>Add Images</span>
                </button>

                {allImageUrls.length === 0 && (
                  <p className="text-xs text-white/30 text-center mt-1">
                    Upload multiple photos (JPEG, PNG, WebP, GIF up to 5MB each)
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploadingImages}
              className="w-full btn-tactical"
            >
              {isSubmitting || isUploadingImages
                ? isUploadingImages
                  ? 'Uploading Images...'
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