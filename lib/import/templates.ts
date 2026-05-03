export const CSV_TEMPLATES = {
  products: {
    name: 'Products Import',
    description: 'Import products with name, prices, stock, and optional barcode',
    headers: ['name', 'cost_price', 'selling_price', 'stock_level', 'barcode'],
    example: [
      ['Product Name', 'cost_price', 'selling_price', 'stock_level', 'barcode'],
      ['Example Product', '100.00', '150.00', '50', '1234567890123'],
    ],
  },
  expenses: {
    name: 'Expenses Import',
    description: 'Import expenses with description, amount, category, and date',
    headers: ['description', 'amount', 'category', 'date'],
    example: [
      ['description', 'amount', 'category', 'date'],
      ['Office Supplies', '250.00', 'Operations', '2024-01-15'],
    ],
  },
  clients: {
    name: 'Clients Import',
    description: 'Import clients with name and phone number',
    headers: ['full_name', 'phone_number'],
    example: [
      ['full_name', 'phone_number'],
      ['John Banda', '+260971234567'],
    ],
  },
};

export function generateCSVContent(
  template: keyof typeof CSV_TEMPLATES
): string {
  const t = CSV_TEMPLATES[template];
  return t.example.map((row) => row.join(',')).join('\n');
}

export function downloadTemplate(template: keyof typeof CSV_TEMPLATES) {
  const content = generateCSVContent(template);
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${template}-import-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}