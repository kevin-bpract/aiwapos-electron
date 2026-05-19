import { fetchAllSalesHistory } from './data.sync';
import { saveSalesHistoryBatch, clearSalesHistory } from '../repositories/salesHistory';
import log from 'electron-log';

export async function syncSalesHistory(): Promise<void> {
  try {
    log.info('Syncing sales history...');
    const salesHistory = await fetchAllSalesHistory();
    // clearSalesHistory(); // REMOVED: Unsafe, upsert handles updates
    saveSalesHistoryBatch(salesHistory);
    log.info(`✅ Synced ${salesHistory.length} sales history records`);
  } catch (error) {
    log.error('Failed to sync sales history:', error);
    throw error;
  }
}
