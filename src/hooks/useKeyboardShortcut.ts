import { useEffect } from 'react';

interface KeyHandlerMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(handlers: KeyHandlerMap) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Build key string with modifiers
      let keyString = '';
      if (event.ctrlKey || event.metaKey) keyString += 'Control+';
      if (event.shiftKey) keyString += 'Shift+';
      if (event.altKey) keyString += 'Alt+';
      
      // Handle function keys (F1-F12)
      if (event.key.startsWith('F') && /^F\d{1,2}$/.test(event.key)) {
        keyString += event.key;
      } else if (event.key === 'Escape') {
        keyString += 'Escape';
      } else if (event.key.length === 1) {
        // Single character keys (letters, numbers, etc.)
        keyString += event.key.toUpperCase();
      } else {
        // Other special keys
        keyString += event.key;
      }

      const handler = handlers[keyString];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
