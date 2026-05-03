'use client';

import { useState } from 'react';
import { Download, FileText, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { getSalesHistory } from '@/lib/actions/ledger';
import { getExpenses } from '@/lib/actions/expenses';
import { searchDebts } from '@/lib/actions/ledger';
import { toast } from 'sonner';

export default function ExportPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'sales' | 'expenses' | 'debts'>('sales');

  const downloadCSV = async (type: 'sales' | 'expenses' | 'debts') => {
    setIsExporting(true);
    setExportType(type);

    try {
      let csv = '';
      let filename = '';

      if (type === 'sales') {
        const { data } = await getSalesHistory();
        const headers = ['Date', 'Product', 'Client', 'Amount', 'Status', 'Method'];
        const rows = (data || []).map((sale: any) => [
          new Date(sale.created_at).toLocaleDateString(),
          sale.product?.name || 'N/A',
          sale.client?.full_name || 'N/A',
          sale.total_amount.toFixed(2),
          sale.payment_status,
          sale.payment_method,
        ]);
        csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
        filename = `sales_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (type === 'expenses') {
        const { data } = await getExpenses();
        const headers = ['Date', 'Description', 'Category', 'Amount'];
        const rows = (data || []).map((exp: any) => [
          new Date(exp.created_at).toLocaleDateString(),
          `"${exp.description}"`,
          exp.category,
          exp.amount.toFixed(2),
        ]);
        csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
        filename = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (type === 'debts') {
        const { data } = await searchDebts();
        const headers = ['Client', 'Product', 'Amount Due', 'Due Date', 'Status'];
        const rows = (data || []).map((debt: any) => {
          const isOverdue = new Date(debt.due_date) < new Date();
          return [
            debt.sale?.client?.full_name || 'N/A',
            debt.sale?.product?.name || 'N/A',
            debt.amount_due.toFixed(2),
            new Date(debt.due_date).toLocaleDateString(),
            isOverdue ? 'Overdue' : 'Upcoming',
          ];
        });
        csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
        filename = `debts_${new Date().toISOString().split('T')[0]}.csv`;
      }

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully!`);
    } catch (error) {
      toast.error('Failed to export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl text-tactical text-tactical">EXPORT</h1>
        <p className="text-white/60 text-sm uppercase tracking-wider">
          Download Reports for Accounting
        </p>
      </div>

      {/* Export Options */}
      <div className="space-y-4">
        <button
          onClick={() => downloadCSV('sales')}
          disabled={isExporting}
          className="w-full card-tactical flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-tactical-neon/20 flex items-center justify-center">
              <DollarSign className="w-7 h-7 text-tactical-neon" />
            </div>
            <div className="text-left">
              <p className="font-bold">Sales Report</p>
              <p className="text-sm text-white/40">All transactions with details</p>
            </div>
          </div>
          <Download className="w-6 h-6 text-tactical-neon" />
        </button>

        <button
          onClick={() => downloadCSV('expenses')}
          disabled={isExporting}
          className="w-full card-tactical flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-tactical-red/20 flex items-center justify-center">
              <FileText className="w-7 h-7 text-tactical-red" />
            </div>
            <div className="text-left">
              <p className="font-bold">Expenses Report</p>
              <p className="text-sm text-white/40">All business expenses by category</p>
            </div>
          </div>
          <Download className="w-6 h-6 text-tactical-red" />
        </button>

        <button
          onClick={() => downloadCSV('debts')}
          disabled={isExporting}
          className="w-full card-tactical flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-tactical-orange/20 flex items-center justify-center">
              <Clock className="w-7 h-7 text-tactical-orange" />
            </div>
            <div className="text-left">
              <p className="font-bold">Debts Report</p>
              <p className="text-sm text-white/40">Outstanding installments</p>
            </div>
          </div>
          <Download className="w-6 h-6 text-tactical-orange" />
        </button>
      </div>

      {/* Info */}
      <div className="card-tactical bg-tactical-blue/10 border-tactical-blue/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-tactical-blue mt-0.5" />
          <div>
            <p className="text-sm font-semibold">CSV Format</p>
            <p className="text-xs text-white/60 mt-1">
              Downloads are in CSV format, compatible with Excel, Google Sheets, and accounting software.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
