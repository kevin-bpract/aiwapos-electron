// Cache for currency to avoid repeated async calls
let cachedCurrency: string | null = null;

/**
 * Initialize currency cache from stored settings
 * Call this on app startup or when currency might have changed
 */
export async function initializeCurrency(): Promise<void> {
  try {
    // Try to get from window.app_config (renderer process)
    if (typeof window !== 'undefined' && window.app_config) {
      const currency = await window.app_config.get('default_currency');
      if (currency) {
        cachedCurrency = currency;
        return;
      }
    }
  } catch (error) {
    console.error('Error fetching currency from app_config:', error);
  }

  // Fallback to USD if not found
  if (!cachedCurrency) {
    cachedCurrency = 'USD';
  }
}

/**
 * Set currency cache directly (useful for main process)
 */
export function setCurrency(currency: string): void {
  cachedCurrency = currency;
}

/**
 * Get current currency (synchronous)
 */
export function getCurrency(): string {
  return cachedCurrency || 'USD';
}

/**
 * Format currency amount using the stored default currency
 * This is synchronous and uses cached currency value
 */
export function formatCurrency(amount: number): string {
  const currency = cachedCurrency || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
