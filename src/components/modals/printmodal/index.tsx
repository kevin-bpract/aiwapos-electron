import React, { useEffect } from 'react';
import Button from '../../ui/buttom';

interface Props {
  onPrint?: (printer: string, paperSize: string) => void;
  onClose?: () => void;
}

const PrintModal: React.FC<Props> = ({ onPrint, onClose }) => {
  const [printers] = React.useState<string[]>([
    'POS_Printer_1',
    'Office_Printer_A',
    'USB_Receipt_Printer',
  ]);
  const [selectedPrinter, setSelectedPrinter] = React.useState<string>(
    printers[0],
  );
  const [paperSize, setPaperSize] = React.useState<string>('A4');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    if (onPrint) onPrint(selectedPrinter, paperSize);
  };

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-md min-w-[420px]">
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold">Print Invoice</h3>
      </div>

      <div className="p-4 flex gap-6">
        <div className="w-1/2">
          <p className="text-sm font-medium text-gray-600 mb-2">Available Printers</p>
          <div className="space-y-2">
            {printers.map((p) => (
              <label
                key={p}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="radio"
                  name="printer"
                  value={p}
                  checked={selectedPrinter === p}
                  onChange={() => setSelectedPrinter(p)}
                />
                <span className="text-sm">{p}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="w-1/2">
          <p className="text-sm font-medium text-gray-600 mb-2">Paper Size</p>
          <div className="space-y-2">
            <label className="flex items-center gap-3">
              <input
                type="radio"
                name="paperSize"
                value="A4"
                checked={paperSize === 'A4'}
                onChange={() => setPaperSize('A4')}
              />
              <span className="text-sm">A4</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="radio"
                name="paperSize"
                value="3.5in"
                checked={paperSize === '3.5in'}
                onChange={() => setPaperSize('3.5in')}
              />
              <span className="text-sm">3.5 in (Receipt)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="radio"
                name="paperSize"
                value="80mm"
                checked={paperSize === '80mm'}
                onChange={() => setPaperSize('80mm')}
              />
              <span className="text-sm">80 mm (Receipt)</span>
            </label>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
        <Button
          type="button"
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-red-600 text-white font-medium shadow-sm hover:bg-red-700"
        >
          Cancel
        </Button>

        <button
          type="button"
          onClick={handlePrint}
          className="px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700"
        >
          Print
        </button>
      </div>
    </div>
  );
};

export default PrintModal;
