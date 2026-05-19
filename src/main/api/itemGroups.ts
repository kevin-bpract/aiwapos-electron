import { httpClient } from './http-client';
import { cachedBackendUrl } from '../config';

export interface ItemGroup {
  name: string;
  parent_item_group: string;
  image: string | null;
  custom_is_favorite_group: number;
}

export interface GetItemGroupsResponse {
  message?: {
    success_key?: number;
    message?: string;
    item_groups?: ItemGroup[];
  };
  [key: string]: any;
}

export async function getItemGroups(): Promise<ItemGroup[]> {
  try {
    const response = await httpClient.get<GetItemGroupsResponse>(
      `${cachedBackendUrl}/api/method/pos_api.api.get_item_groups`,
      {
        withCredentials: true,
      },
    );

    if (
      response?.data?.message?.success_key === 1 &&
      Array.isArray(response.data.message.item_groups)
    ) {
      return response.data.message.item_groups;
    }

    console.error('Invalid response format for item groups:', response);
    return [];
  } catch (error) {
    console.error('Failed to fetch item groups:', error);
    return [];
  }
}
