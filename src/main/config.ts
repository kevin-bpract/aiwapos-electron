import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { getAppConfig, saveAppConfig } from './repositories/settings';

/* eslint-disable-next-line prefer-const */
export let cachedBackendUrl = '';

// Persistent config file (survives DB deletion)
const getConfigFilePath = () => path.join(app.getPath('userData'), 'config.json');

interface PersistentConfig {
  backendUrl?: string;
}

// Read from persistent JSON file
function readPersistentConfig(): PersistentConfig {
  try {
    const configPath = getConfigFilePath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read persistent config:', err);
  }
  return {};
}

// Write to persistent JSON file
function writePersistentConfig(config: PersistentConfig): void {
  try {
    const configPath = getConfigFilePath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('✅ Persistent config saved:', configPath);
  } catch (err) {
    console.error('Failed to write persistent config:', err);
  }
}

export const setBackendUrl = (url: string) => {
  cachedBackendUrl = url;
  // Save to both persistent file and DB (for backwards compatibility)
  writePersistentConfig({ backendUrl: url });
  try {
    saveAppConfig('backendUrl', url);
  } catch (err) {
    console.warn('Failed to save backendUrl to DB (may be closed):', err);
  }
};

export const initConfig = async () => {
  // Try persistent file first (survives DB deletion)
  const persistentConfig = readPersistentConfig();
  if (persistentConfig.backendUrl) {
    cachedBackendUrl = persistentConfig.backendUrl;
    console.log('✅ Config initialized from persistent file:', cachedBackendUrl);
    // Sync to DB for backwards compatibility
    try {
      saveAppConfig('backendUrl', cachedBackendUrl);
    } catch (err) {
      console.warn('Failed to sync backendUrl to DB:', err);
    }
    return;
  }

  // Fallback: try DB (for existing installations)
  try {
    const url = await getAppConfig('backendUrl');
    if (url) {
      cachedBackendUrl = url;
      // Migrate to persistent file
      writePersistentConfig({ backendUrl: url });
      console.log('✅ Config initialized from DB (migrated to file):', cachedBackendUrl);
      return;
    }
  } catch (err) {
    console.warn('Failed to read backendUrl from DB:', err);
  }

  console.log('⚠️ No backend URL configured');
};
