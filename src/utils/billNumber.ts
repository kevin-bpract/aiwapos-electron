/**
 * Bill Number Generator Utility
 * Generates incremental bill numbers that reset every 24 hours
 */

interface BillNumberState {
  currentNumber: number;
  lastResetDate: string; // ISO date string
}

const STORAGE_KEY = 'restaurant_bill_number_state';
const RESET_INTERVAL_HOURS = 24;

/**
 * Get the current bill number state from storage
 */
function getBillNumberState(): BillNumberState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading bill number state:', error);
  }

  // Default state
  return {
    currentNumber: 0,
    lastResetDate: new Date().toISOString(),
  };
}

/**
 * Save the bill number state to storage
 */
function saveBillNumberState(state: BillNumberState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving bill number state:', error);
  }
}

/**
 * Check if the bill number should be reset (24 hours have passed)
 */
function shouldReset(lastResetDate: string): boolean {
  const lastReset = new Date(lastResetDate);
  const now = new Date();
  const hoursDiff = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
  return hoursDiff >= RESET_INTERVAL_HOURS;
}

/**
 * Get the next bill number
 * This increments the counter and resets it if 24 hours have passed
 */
export function getNextBillNumber(): number {
  const state = getBillNumberState();
  const now = new Date();

  // Check if we need to reset
  if (shouldReset(state.lastResetDate)) {
    // Reset to 1 (first bill of the new period)
    const newState: BillNumberState = {
      currentNumber: 1,
      lastResetDate: now.toISOString(),
    };
    saveBillNumberState(newState);
    return 1;
  }

  // Increment the current number
  const newNumber = state.currentNumber + 1;
  const newState: BillNumberState = {
    currentNumber: newNumber,
    lastResetDate: state.lastResetDate, // Keep the same reset date
  };
  saveBillNumberState(newState);

  return newNumber;
}

/**
 * Get the current bill number without incrementing
 */
export function getCurrentBillNumber(): number {
  const state = getBillNumberState();
  return state.currentNumber;
}

/**
 * Reset the bill number manually (for testing or admin purposes)
 */
export function resetBillNumber(): void {
  const newState: BillNumberState = {
    currentNumber: 0,
    lastResetDate: new Date().toISOString(),
  };
  saveBillNumberState(newState);
}

/**
 * Get the time until next reset (in milliseconds)
 */
export function getTimeUntilReset(): number {
  const state = getBillNumberState();
  const lastReset = new Date(state.lastResetDate);
  const nextReset = new Date(lastReset.getTime() + RESET_INTERVAL_HOURS * 60 * 60 * 1000);
  const now = new Date();
  return Math.max(0, nextReset.getTime() - now.getTime());
}

