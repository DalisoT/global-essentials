'use client';

import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Download, X } from 'lucide-react';
import { toast } from 'sonner';

interface ReceiptModalProps {
  html: string;
  onClose: () => void;
}

function sanitizeHTML(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe/gi, '&lt;iframe')
    .replace(/<object/gi, '&lt;object')
    .replace(/<embed/gi, '&lt;embed')
    .replace(/<link/gi, '&lt;link')
    .replace(/<form/gi, '&lt;form');
}

export function ReceiptModal({ html, onClose }: ReceiptModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    documentTitle: 'Receipt',
    contentRef: contentRef,
  });

  const handleDownload = () => {
    const blob = new Blob([sanitizedHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'receipt.html';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Receipt downloaded');
  };

  const sanitizedHTML = sanitizeHTML(html);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-tactical-slate rounded-2xl w-full max-w-md mx-4 overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="font-bold text-white">Receipt</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview */}
        <div
          ref={contentRef}
          className="p-4 max-h-96 overflow-y-auto [&_*]:text-black [&_*]:bg-white"
          dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
        />

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-white/10">
          <button
            onClick={handlePrint}
            className="btn-tactical-secondary flex-1 h-12 flex items-center justify-center gap-2"
          >
            <Printer className="w-5 h-5" />
            Print
          </button>
          <button
            onClick={handleDownload}
            className="btn-tactical flex-1 h-12 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}