import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  onClose: () => void;
  modalTitle: string;
}

const Portal: React.FC<Props> = ({ children, onClose, modalTitle }) => {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      style={{
        background:
          'radial-gradient(120% 120% at 50% 0%, rgba(230,57,70,0.18), rgba(15,23,42,0.55) 60%)',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white max-h-[86vh] w-full max-w-[min(960px,96vw)] overflow-hidden flex flex-col"
        style={{
          borderRadius: 28,
          boxShadow:
            '0 40px 100px rgba(15,23,42,0.28), 0 12px 32px rgba(15,23,42,0.10)',
          border: '1px solid var(--color-line)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <header
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--color-line)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              aria-hidden
              className="inline-flex items-center justify-center"
              style={{
                width: 8,
                height: 28,
                borderRadius: 4,
                background:
                  'linear-gradient(180deg, var(--color-primary), var(--color-primary-deep))',
              }}
            />
            <h4
              className="text-[17px] font-bold tracking-tight truncate"
              style={{ color: 'var(--color-ink)' }}
            >
              {modalTitle ?? 'Select Item'}
            </h4>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ds-iconbtn"
            aria-label="Close modal"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default Portal;
