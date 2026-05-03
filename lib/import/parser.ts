import Papa from 'papaparse';

export interface ParsedRow {
  row: number;
  data: Record<string, string>;
  errors: string[];
}

export interface ParseResult {
  success: boolean;
  rows: ParsedRow[];
  headers: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: ParsedRow[] = results.data.map(
          (row: Record<string, string>, index: number) => ({
            row: index + 1,
            data: row,
            errors: validateRow(row, results.meta.fields || []),
          })
        );

        const validRows = rows.filter((r) => r.errors.length === 0).length;
        const errorRows = rows.filter((r) => r.errors.length > 0).length;

        resolve({
          success: results.errors.length === 0,
          rows,
          headers: results.meta.fields || [],
          totalRows: rows.length,
          validRows,
          errorRows,
        });
      },
      error: (error) => {
        resolve({
          success: false,
          rows: [],
          headers: [],
          totalRows: 0,
          validRows: 0,
          errorRows: 0,
        });
      },
    });
  });
}

function validateRow(row: Record<string, string>, headers: string[]): string[] {
  const errors: string[] = [];

  for (const header of headers) {
    if (!row[header] && row[header] !== '0') {
      errors.push(`Missing required field: ${header}`);
    }
  }

  return errors;
}

export function validateProductRow(row: Record<string, string>): string[] {
  const errors: string[] = [];

  if (!row.name) errors.push('Product name is required');
  if (!row.cost_price && row.cost_price !== '0') errors.push('Cost price is required');
  if (!row.selling_price && row.selling_price !== '0') errors.push('Selling price is required');
  if (!row.stock_level && row.stock_level !== '0') errors.push('Stock level is required');

  // Validate price formats
  if (row.cost_price && isNaN(parseFloat(row.cost_price))) {
    errors.push('Invalid cost price format');
  }
  if (row.selling_price && isNaN(parseFloat(row.selling_price))) {
    errors.push('Invalid selling price format');
  }
  if (row.stock_level && isNaN(parseInt(row.stock_level))) {
    errors.push('Invalid stock level format');
  }

  return errors;
}

export function validateExpenseRow(row: Record<string, string>): string[] {
  const errors: string[] = [];

  if (!row.description) errors.push('Description is required');
  if (!row.amount && row.amount !== '0') errors.push('Amount is required');
  if (!row.category) errors.push('Category is required');

  if (row.amount && isNaN(parseFloat(row.amount))) {
    errors.push('Invalid amount format');
  }

  return errors;
}

export function validateClientRow(row: Record<string, string>): string[] {
  const errors: string[] = [];

  if (!row.full_name) errors.push('Full name is required');
  if (!row.phone_number) errors.push('Phone number is required');

  return errors;
}