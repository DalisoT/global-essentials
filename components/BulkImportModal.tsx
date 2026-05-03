'use client';

import { useState, useCallback } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { parseCSV, validateProductRow, validateExpenseRow, validateClientRow } from '@/lib/import/parser';
import { downloadTemplate, CSV_TEMPLATES } from '@/lib/import/templates';
import { importProducts, importExpenses, importClients } from '@/lib/actions/import';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ImportType = 'products' | 'expenses' | 'clients';

interface ParsedRow {
  row: number;
  data: Record<string, string>;
  errors: string[];
}

export function BulkImportModal({
  isOpen,
  onClose,
  type,
}: {
  isOpen: boolean;
  onClose: () => void;
  type: ImportType;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  const template = CSV_TEMPLATES[type];

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      setFile(selectedFile);
      setImportResult(null);

      const result = await parseCSV(selectedFile);
      setParsedData(result.rows);
      setHeaders(result.headers);
    },
    []
  );

  const handleImport = async () => {
    setIsImporting(true);

    try {
      let result: { success: number; failed: number; errors: string[] };

      if (type === 'products') {
        const products = parsedData
          .filter((r) => r.errors.length === 0)
          .map((r) => ({
            name: r.data.name,
            cost_price: parseFloat(r.data.cost_price),
            selling_price: parseFloat(r.data.selling_price),
            stock_level: parseInt(r.data.stock_level),
            barcode: r.data.barcode || undefined,
          }));

        result = await importProducts(products);
      } else if (type === 'expenses') {
        const expenses = parsedData
          .filter((r) => r.errors.length === 0)
          .map((r) => ({
            description: r.data.description,
            amount: parseFloat(r.data.amount),
            category: r.data.category,
            created_at: r.data.date,
          }));

        result = await importExpenses(expenses);
      } else {
        const clients = parsedData
          .filter((r) => r.errors.length === 0)
          .map((r) => ({
            full_name: r.data.full_name,
            phone_number: r.data.phone_number,
          }));

        result = await importClients(clients);
      }

      setImportResult({ success: result.success, failed: result.failed });
      toast.success(`Imported ${result.success} ${type} successfully`);
    } catch (error) {
      toast.error('Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const resetModal = () => {
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    setImportResult(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-tactical-slate rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <h3 className="font-bold text-white">Bulk Import {template.name}</h3>
            <p className="text-xs text-white/60">{template.description}</p>
          </div>
          <button
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {!file ? (
            <div className="space-y-4">
              {/* Download Template */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-white/40" />
                  <div>
                    <p className="font-semibold text-white">{template.name} Template</p>
                    <p className="text-xs text-white/40">
                      Headers: {template.headers.join(', ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => downloadTemplate(type)}
                  className="btn-tactical-secondary h-10 text-sm flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>

              {/* Upload Area */}
              <label className="block border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-tactical-blue/50 transition-colors">
                <Upload className="w-8 h-8 text-white/40 mx-auto mb-3" />
                <p className="font-semibold text-white">Click to upload CSV</p>
                <p className="text-xs text-white/40 mt-1">
                  or drag and drop your file here
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          ) : importResult ? (
            /* Import Complete */
            <div className="space-y-4 text-center py-8">
              {importResult.failed === 0 ? (
                <CheckCircle className="w-16 h-16 text-tactical-neon mx-auto" />
              ) : (
                <AlertCircle className="w-16 h-16 text-tactical-orange mx-auto" />
              )}
              <div>
                <p className="text-xl font-bold text-white">
                  Import Complete
                </p>
                <p className="text-white/60 mt-2">
                  {importResult.success} imported, {importResult.failed} failed
                </p>
              </div>
              <button
                onClick={resetModal}
                className="btn-tactical-secondary"
              >
                Import More
              </button>
            </div>
          ) : (
            /* Preview Data */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/60">
                  {parsedData.length} rows found
                </p>
                <button
                  onClick={resetModal}
                  className="text-sm text-tactical-blue hover:underline"
                >
                  Choose different file
                </button>
              </div>

              {/* Data Preview Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      {headers.map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 text-white/60 font-semibold uppercase text-xs"
                        >
                          {h}
                        </th>
                      ))}
                      <th className="text-left px-3 py-2 text-white/60 font-semibold uppercase text-xs">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((row) => (
                      <tr
                        key={row.row}
                        className={cn(
                          'border-b border-white/5',
                          row.errors.length > 0 && 'bg-tactical-red/5'
                        )}
                      >
                        {headers.map((h) => (
                          <td key={h} className="px-3 py-2 text-white">
                            {row.data[h]}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          {row.errors.length > 0 ? (
                            <span className="text-tactical-red text-xs">
                              {row.errors[0]}
                            </span>
                          ) : (
                            <span className="text-tactical-neon text-xs">✓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 10 && (
                  <p className="text-center text-white/40 text-sm py-2">
                    + {parsedData.length - 10} more rows
                  </p>
                )}
              </div>

              {/* Errors Summary */}
              {parsedData.some((r) => r.errors.length > 0) && (
                <div className="bg-tactical-red/10 border border-tactical-red/20 rounded-xl p-4">
                  <p className="text-tactical-red font-semibold text-sm">
                    {parsedData.filter((r) => r.errors.length > 0).length} rows have
                    errors and will be skipped
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!importResult && file && parsedData.length > 0 && (
          <div className="flex gap-3 p-4 border-t border-white/10">
            <button
              onClick={resetModal}
              className="flex-1 btn-tactical-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting || parsedData.filter((r) => r.errors.length === 0).length === 0}
              className="flex-1 btn-tactical disabled:opacity-50"
            >
              {isImporting ? 'Importing...' : `Import ${parsedData.filter((r) => r.errors.length === 0).length} Rows`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}