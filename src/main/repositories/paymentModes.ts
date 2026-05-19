import db from '../db/db';
import { ModeOfPayment } from '../api/invoice';

let INSERT_PAYMENT_MODE: any;
let GET_ALL_PAYMENT_MODES: any;
let DELETE_ALL_PAYMENT_MODES: any;
let GET_DEFAULT_MODE: any;
let SET_DEFAULT_MODE: any;

function getInsertPaymentMode() {
  if (!INSERT_PAYMENT_MODE) {
    INSERT_PAYMENT_MODE = db.prepare(`
      INSERT OR REPLACE INTO payment_modes (name, type)
      VALUES (?, ?)
    `);
  }
  return INSERT_PAYMENT_MODE;
}

function getGetAllPaymentModes() {
  if (!GET_ALL_PAYMENT_MODES) {
    GET_ALL_PAYMENT_MODES = db.prepare(`
      SELECT name, type FROM payment_modes ORDER BY name
    `);
  }
  return GET_ALL_PAYMENT_MODES;
}

function getDeleteAllPaymentModes() {
  if (!DELETE_ALL_PAYMENT_MODES) {
    DELETE_ALL_PAYMENT_MODES = db.prepare(`
      DELETE FROM payment_modes
    `);
  }
  return DELETE_ALL_PAYMENT_MODES;
}

function getGetDefaultMode() {
  if (!GET_DEFAULT_MODE) {
    GET_DEFAULT_MODE = db.prepare(`
      SELECT value FROM app_config WHERE key = 'user_default_payment_mode'
    `);
  }
  return GET_DEFAULT_MODE;
}

function getSetDefaultMode() {
  if (!SET_DEFAULT_MODE) {
    SET_DEFAULT_MODE = db.prepare(`
      INSERT OR REPLACE INTO app_config (key, value)
      VALUES ('user_default_payment_mode', ?)
    `);
  }
  return SET_DEFAULT_MODE;
}

export function savePaymentMode(mode: ModeOfPayment): void {
  const stmt = getInsertPaymentMode();
  stmt.run(mode.name, mode.type);
}

export function savePaymentModes(modes: ModeOfPayment[]): void {
  const transaction = db.transaction(() => {
    for (const mode of modes) {
      savePaymentMode(mode);
    }
  });
  transaction();
}

export function getAllPaymentModes(): ModeOfPayment[] {
  const stmt = getGetAllPaymentModes();
  return stmt.all();
}

export function clearAllPaymentModes(): void {
  const stmt = getDeleteAllPaymentModes();
  stmt.run();
}

export function saveDefaultPaymentMode(modeName: string | null): void {
  if (!modeName) return;
  const stmt = getSetDefaultMode();
  stmt.run(modeName);
}

export function getDefaultPaymentMode(): string | null {
  const stmt = getGetDefaultMode();
  const row = stmt.get() as { value: string } | undefined;
  return row?.value || null;
}
