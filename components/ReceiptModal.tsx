'use client';

import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Download, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;
    try {
      const canvas = await html2canvas(contentRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, width, height);
      pdf.save('receipt.pdf');
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  const handleDownloadHTML = () => {
    const blob = new Blob([sanitizedHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'receipt.html';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Receipt downloaded');
  };

  const handleShare = async () => {
    if (!contentRef.current) return;
    try {
      const canvas = await html2canvas(contentRef.current, { scale: 2, useCORS: true });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to create image');
      const file = new File([blob], 'receipt.png', { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Receipt',
          files: [file],
        });
        toast.success('Receipt shared');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'receipt.png';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Receipt image downloaded');
      }
    } catch {
      toast.error('Failed to share receipt');
    }
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
            onClick={handleShare}
            className="btn-tactical-secondary flex-1 h-12 flex items-center justify-center gap-2"
          >
            <Share2 className="w-5 h-5" />
            Share
          </button>
          <button
            onClick={handleDownloadPDF}
            className="btn-tactical flex-1 h-12 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}