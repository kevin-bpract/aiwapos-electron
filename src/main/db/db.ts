import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { runMigrations } from './migrations';

// Store DB in user data folder
const dbPath = path.join(app.getPath('userData'), 'app.db');
const db = new Database(dbPath);

// for better perfomance
db.pragma('journal_mode = WAL');

// Run migrations immediately when database is initialized
// This ensures tables exist before any repository operations
// app.getPath() works even before app.whenReady()
runMigrations(db);

export default db;
