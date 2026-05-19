/**
 * Compute the effective print page size from saved printer settings.
 *
 * Historical bug: every print path used to key off `settings.paperSize` directly,
 * but `paperSize` is only mutated in the PDF tab of Global Settings. Users on
 * the POS (Thermal) tab set `posPrinterWidth` while `paperSize` stayed at its
 * stale default ('A4'), so thermal prints went out as A4 and got split into
 * multiple pages by the printer driver.
 *
 * This helper centralises the rule: when the user has selected POS (Thermal)
 * mode, honour `posPrinterWidth`; otherwise honour `paperSize`.
 */
export type EffectivePageSize = '58mm' | '80mm' | 'A4' | string;

interface PrintSettingsShape {
  printerType?: 'pdf' | 'pos';
  posPrinterWidth?: '58mm' | '80mm';
  paperSize?: string;
}

export function resolvePageSize(
  settings: PrintSettingsShape | null | undefined,
): EffectivePageSize {
  if (!settings) return 'A4';
  if (settings.printerType === 'pos') {
    return settings.posPrinterWidth || '80mm';
  }
  return settings.paperSize || 'A4';
}

/** Convenience: true if effective size is a thermal width. */
export function isThermalPageSize(size: EffectivePageSize): boolean {
  return size === '58mm' || size === '80mm';
}
