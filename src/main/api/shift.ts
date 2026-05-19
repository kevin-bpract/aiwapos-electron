import { httpClient } from './http-client';
import { cachedBackendUrl } from '../config';

export interface GetShiftClosingListParams {
    from_date?: string;
    to_date?: string;
    status?: string;
    limit_page_length?: number;
}

export async function getClosingList(params: GetShiftClosingListParams = {}): Promise<any> {
    const queryParams = new URLSearchParams();

    if (params.from_date) queryParams.append('from_date', params.from_date);
    if (params.to_date) queryParams.append('to_date', params.to_date);
    if (params.status) queryParams.append('status', params.status);
    if (params.limit_page_length)
        queryParams.append('limit_page_length', String(params.limit_page_length));

    try {
        const url = `${cachedBackendUrl}/api/method/pos_api.api.get_my_sessions?${queryParams.toString()}`;
        const response = await httpClient.get(url, { withCredentials: true });
        // Normalize to the historical `entries` shape so consumers don't need to care
        // that the endpoint now returns `sessions`. Privileged users (view_all_transaction_role)
        // receive everyone's sessions via the same endpoint — no client-side branching needed.
        const msg = response.data?.message;
        if (msg && Array.isArray(msg.sessions) && !Array.isArray(msg.entries)) {
            msg.entries = msg.sessions;
        }
        return response.data;
    } catch (error) {
        console.error('Error fetching shift sessions:', error);
        throw error;
    }
}

export async function getSessionDetails(name: string): Promise<any> {
    const queryParams = new URLSearchParams({
        name,
        include_details: '1',
        limit_page_length: '1',
    });
    try {
        const url = `${cachedBackendUrl}/api/method/pos_api.api.get_my_sessions?${queryParams.toString()}`;
        const response = await httpClient.get(url, { withCredentials: true });
        const session = response.data?.message?.sessions?.[0] ?? null;
        return session;
    } catch (error) {
        console.error('Error fetching shift session details:', error);
        throw error;
    }
}

export async function getOpenShift(): Promise<any> {
    try {
        const url = `${cachedBackendUrl}/api/method/pos_api.api.get_open_shift`;
        const response = await httpClient.get(url, { withCredentials: true });
        return response.data;
    } catch (error) {
        console.error('Error fetching open shift:', error);
        throw error;
    }
}
