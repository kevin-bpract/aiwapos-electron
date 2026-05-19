import db from '../db/db';
import { type GridPreferences } from '../../types/gridPreferences';

// Lazy initialization - prepare statements only when first used
// This ensures migrations have run before tables are accessed
let SELECT_PREFERENCES: ReturnType<typeof db.prepare> | null = null;
let UPSERT_PREFERENCES: ReturnType<typeof db.prepare> | null = null;

function getSelectPreferences() {
  if (!SELECT_PREFERENCES) {
    SELECT_PREFERENCES = db.prepare(
      'SELECT data FROM grid_preferences WHERE view = ?',
    );
  }
  return SELECT_PREFERENCES;
}

function getUpsertPreferences() {
  if (!UPSERT_PREFERENCES) {
    UPSERT_PREFERENCES = db.prepare(`
      INSERT INTO grid_preferences (view, data, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(view) DO UPDATE SET
        data=excluded.data,
        updated_at=CURRENT_TIMESTAMP
    `);
  }
  return UPSERT_PREFERENCES;
}

export function getGridPreferences(view: string): GridPreferences | null {
  const row = getSelectPreferences().get(view) as { data?: string } | undefined;
  if (!row?.data) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.data) as GridPreferences;
    return parsed;
  } catch (error) {
    console.error('Failed to parse grid preferences for view', view, error);
    return null;
  }
}

export function saveGridPreferences(
  view: string,
  prefs: GridPreferences,
): void {
  const payload = JSON.stringify(prefs);
  getUpsertPreferences().run(view, payload);
}
