import { useCallback, useEffect, useState } from 'react';
import { PRINTER_SETTINGS_CHANGED } from '../constants/printerSettingsEvents';

export function useOnScreenKeyboardEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = (await window.printerSettings.get()) as {
        onScreenKeyboardEnabled?: boolean;
      } | null;
      setEnabled(Boolean(s?.onScreenKeyboardEnabled));
    } catch {
      setEnabled(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onChanged = () => {
      load();
    };
    window.addEventListener(PRINTER_SETTINGS_CHANGED, onChanged);
    return () => window.removeEventListener(PRINTER_SETTINGS_CHANGED, onChanged);
  }, [load]);

  return enabled;
}
