export interface ReceiptData {
  id: string;
  date: string;
  productName: string;
  clientName: string;
  clientPhone: string;
  paymentMethod: 'cash' | 'pay-slow';
  totalAmount: number;
  installments?: Array<{
    amount: number;
    dueDate: string;
    isPaid: boolean;
  }>;
}

export function generateReceiptHTML(receipt: ReceiptData): string {
  const isPaySlow = receipt.paymentMethod === 'pay-slow';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt - ${receipt.id}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          padding: 40px;
          max-width: 400px;
          margin: 0 auto;
          background: #fff;
          color: #111;
        }
        .logo {
          width: 120px;
          height: auto;
          margin: 0 auto 15px;
          display: block;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px dashed #ddd;
        }
        .header h1 {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .header p { font-size: 12px; color: #666; }
        .info { margin-bottom: 25px; }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .info-label { color: #666; font-weight: 500; }
        .info-value { font-weight: 600; }
        .items { margin-bottom: 25px; }
        .item {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #eee;
        }
        .item-name { font-weight: 600; }
        .item-price { font-weight: 700; font-size: 16px; }
        .total {
          display: flex;
          justify-content: space-between;
          padding: 15px 0;
          font-size: 20px;
          font-weight: 900;
          background: #f8f8f8;
          margin-bottom: 25px;
        }
        .installments { margin-bottom: 25px; }
        .installments h3 {
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
          color: #333;
        }
        .installment {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 13px;
          color: #555;
        }
        .installment.paid { color: #22c55e; }
        .installment.unpaid { color: #f97316; }
        .footer {
          text-align: center;
          padding-top: 20px;
          border-top: 2px dashed #ddd;
          font-size: 12px;
          color: #888;
        }
        .footer p { margin-bottom: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="/logo.png" alt="Global Essentials Logo" class="logo" />
        <h1>Global Essentials</h1>
        <p>POS & Debt Management</p>
      </div>

      <div class="info">
        <div class="info-row">
          <span class="info-label">Receipt No.</span>
          <span class="info-value">${receipt.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date</span>
          <span class="info-value">${new Date(receipt.date).toLocaleDateString('en-ZM', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Client</span>
          <span class="info-value">${receipt.clientName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Phone</span>
          <span class="info-value">${receipt.clientPhone}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment</span>
          <span class="info-value" style="text-transform: uppercase;">${receipt.paymentMethod === 'cash' ? 'Cash' : 'Pay-Slow'}</span>
        </div>
      </div>

      <div class="items">
        <div class="item">
          <span class="item-name">${receipt.productName}</span>
          <span class="item-price">K${receipt.totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div class="total">
        <span>TOTAL</span>
        <span>K${receipt.totalAmount.toFixed(2)}</span>
      </div>

      ${
        isPaySlow && receipt.installments
          ? `
        <div class="installments">
          <h3>Payment Schedule</h3>
          ${receipt.installments
            .map(
              (inst, i) => `
            <div class="installment ${inst.isPaid ? 'paid' : 'unpaid'}">
              <span>${inst.isPaid ? '✓' : '○'} Installment ${i + 1} - Due ${new Date(inst.dueDate).toLocaleDateString('en-ZM')}</span>
              <span>K${inst.amount.toFixed(2)}</span>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      <div class="footer">
        <p>Thank you for your business!</p>
        <p>For questions, contact us via WhatsApp</p>
      </div>
    </body>
    </html>
  `;
}