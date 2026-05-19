import { httpClient } from './http-client';
import { cachedBackendUrl } from '../config';
import log from 'electron-log';

export interface UpdateFavoriteResponse {
  message?: {
    success_key?: number;
    message?: string;
  };
  [key: string]: any;
}

/**
 * Update item favorite status via API
 */
export async function updateItemFavorite(
  itemCode: string,
  isFavorite: number,
): Promise<UpdateFavoriteResponse> {
  try {
    log.info(`Updating favorite status for item ${itemCode} to ${isFavorite}`);

    const form = new URLSearchParams();
    form.append('item_code', itemCode);
    form.append('is_favorite', String(isFavorite));

    const res = await httpClient.post<UpdateFavoriteResponse>(
      `${cachedBackendUrl}/api/method/pos_api.api.update_item_favorite`,
      form.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        withCredentials: true,
      },
    );

    log.info(`Successfully updated favorite status for item ${itemCode}`);
    return res.data;
  } catch (error) {
    log.error(`Error updating favorite status for item ${itemCode}:`, error);
    throw error;
  }
}

