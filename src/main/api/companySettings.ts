import { httpClient } from './http-client';
import { cachedBackendUrl } from '../config';
import log from 'electron-log';

export interface CompanySettingsResponse {
  message?: {
    success_key?: number;
    message?: string;
    company?: string;
    default_currency?: string;
    country?: string;
    abbr?: string;
  };
  [key: string]: any;
}

export interface CompanySettings {
  company: string;
  default_currency: string;
  country: string;
  abbr: string;
}

/**
 * Fetch company default currency from the API
 */
export async function getCompanyDefaultCurrency(): Promise<CompanySettings> {
  try {
    log.info('Fetching company default currency from API...');

    const res = await httpClient.get<CompanySettingsResponse>(
      `${cachedBackendUrl}/api/method/pos_api.api.get_company_default_currency`,
      {
        withCredentials: true,
      },
    );

    const msg = res.data?.message;

    if (msg?.default_currency) {
      const settings: CompanySettings = {
        company: msg.company || '',
        default_currency: msg.default_currency,
        country: msg.country || '',
        abbr: msg.abbr || '',
      };

      log.info(`Fetched company default currency: ${settings.default_currency}`);
      return settings;
    }

    throw new Error('Invalid company settings response structure');
  } catch (error) {
    log.error('Error fetching company default currency:', error);
    throw error;
  }
}

