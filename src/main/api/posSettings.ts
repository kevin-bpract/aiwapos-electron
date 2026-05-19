import { httpClient } from './http-client';
import { cachedBackendUrl } from '../config';
import { POSSettingsResponse, POSSettings } from '../../types/posSettings';
import log from 'electron-log';

/**
 * Fetch POS settings from the API
 */
export async function getPOSSettings(): Promise<POSSettings> {
  try {
    log.info('Fetching POS settings from API...');

    const res = await httpClient.get<POSSettingsResponse>(
      `${cachedBackendUrl}/api/method/pos_api.api.get_pos_settings`,
      {
        withCredentials: true,
      },
    );

    if (res.data?.message?.settings) {
      log.info('Successfully fetched POS settings');
      return res.data.message.settings;
    }

    throw new Error('Invalid POS settings response structure');
  } catch (error) {
    log.error('Error fetching POS settings:', error);
    throw error;
  }
}
