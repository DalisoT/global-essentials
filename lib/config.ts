// Application configuration
// All hardcoded values should be accessed through this module

// Currency formatting
export const CURRENCY_LOCALE = process.env.CURRENCY_LOCALE || 'en-ZM';
export const CURRENCY_SYMBOL = process.env.CURRENCY_SYMBOL || 'K';

// Inventory alerts
export const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD || '5', 10);

// Installment limits
export const MIN_INSTALLMENT_MONTHS = parseInt(process.env.MIN_INSTALLMENT_MONTHS || '2', 10);
export const MAX_INSTALLMENT_MONTHS = parseInt(process.env.MAX_INSTALLMENT_MONTHS || '60', 10);

// Cash flow forecast
export const DEFAULT_LEAD_TIME_DAYS = parseInt(process.env.DEFAULT_LEAD_TIME_DAYS || '14', 10);
export const DEFAULT_SAFETY_STOCK = parseInt(process.env.DEFAULT_SAFETY_STOCK || '5', 10);

// Exchange rate fallbacks (used when API is unavailable)
export const FALLBACK_EXCHANGE_RATES = {
  ZMW: 1,
  USD: parseFloat(process.env.FALLBACK_USD_RATE || '0.042'),
  EUR: parseFloat(process.env.FALLBACK_EUR_RATE || '0.038'),
  GBP: parseFloat(process.env.FALLBACK_GBP_RATE || '0.033'),
  BWP: parseFloat(process.env.FALLBACK_BWP_RATE || '0.58'),
  ZAR: parseFloat(process.env.FALLBACK_ZAR_RATE || '0.79'),
  UGX: parseFloat(process.env.FALLBACK_UGX_RATE || '155'),
};