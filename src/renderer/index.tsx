import { createRoot } from 'react-dom/client';
import './index.css';
import '../locales/i18n';
import App from './App';

// Global error handler - logs all unhandled errors
window.addEventListener(
  'error',
  (event: ErrorEvent) => {
    console.error('[Global Error Handler] Unhandled error:', event.error);
    console.error('[Global Error Handler] Message:', event.message);
    console.error('[Global Error Handler] Filename:', event.filename);
    console.error('[Global Error Handler] Line:', event.lineno, 'Column:', event.colno);
    
    try {
      const msg = (event && (event.message || '')) as string;
      if (msg && msg.includes('ResizeObserver loop completed with undelivered notifications')) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    } catch (_) {
      // ignore
    }
  },
  true,
);

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  console.error('[Global Promise Rejection] Unhandled promise rejection:', event.reason);
  console.error('[Global Promise Rejection] Promise:', event.promise);
});

console.log('[index.tsx] Starting application...');
console.log('[index.tsx] Environment:', process.env.NODE_ENV);

const container = document.getElementById('root') as HTMLElement;
if (!container) {
  console.error('[index.tsx] FATAL: Could not find root element!');
  throw new Error('Could not find root element');
}

console.log('[index.tsx] Found root container, creating React root...');
const root = createRoot(container);

console.log('[index.tsx] Rendering App component...');
root.render(<App />);
console.log('[index.tsx] App component rendered');

// calling IPC exposed from preload script
window.electron?.ipcRenderer.once('ipc-example', (arg) => {
  // eslint-disable-next-line no-console
  console.log(arg);
});
window.electron?.ipcRenderer.sendMessage('ipc-example', ['ping']);
