import React from 'react';
import Button from '../ui/buttom';
import InputField from '../ui/input';

interface Props {
  initialValue?: number;
  onChange?: (value: number) => void;
  onSubmit?: (value: number) => void;
}

const keypadLayout = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

const NumericKeypadModal: React.FC<Props> = ({
  initialValue = 0,
  onChange,
  onSubmit,
}) => {
  const [value, setValue] = React.useState<string>(String(initialValue ?? ''));

  const emit = (next: string) => {
    setValue(next);
    const parsed = next === '' ? 0 : Number(next);
    if (!Number.isNaN(parsed)) {
      onChange?.(parsed);
    }
  };

  const handleDigit = (digit: string) => {
    emit(value === '0' ? digit : value + digit);
  };

  const handleBack = () => {
    if (value.length <= 1) emit('');
    else emit(value.slice(0, -1));
  };

  const handleOk = () => {
    const parsed = value === '' ? 0 : Number(value);
    if (!Number.isNaN(parsed)) {
      onSubmit?.(parsed);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/[^\d]/g, '');
    emit(next);
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-200 shadow-md p-4 flex flex-col gap-3">
      {/* Display input */}
      <InputField
        value={value}
        onChange={handleInputChange}
        className="w-full text-right font-semibold"
        placeholder="0"
      />

      {/* Keypad */}
      <div className="flex flex-col gap-3">
        {keypadLayout.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-3 gap-3">
            {row.map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="h-14 rounded-md bg-gray-600 text-white text-lg font-semibold shadow-sm hover:bg-gray-700 active:bg-gray-800 transition-colors"
              >
                {digit}
              </button>
            ))}
          </div>
        ))}

        <div className="grid grid-cols-3 gap-3">
          {/* Back */}
          <button
            type="button"
            onClick={handleBack}
            className="h-14 col-span-2 rounded-md bg-gray-600 text-white text-base font-semibold shadow-sm hover:bg-gray-700 active:bg-gray-800 transition-colors"
          >
            Back
          </button>

          {/* 0 */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-md bg-gray-600 text-white text-lg font-semibold shadow-sm hover:bg-gray-700 active:bg-gray-800 transition-colors"
          >
            0
          </button>
        </div>
      </div>

      {/* OK button */}
      <Button
        type="button"
        onClick={handleOk}
        className="mt-1 w-full h-12 rounded-md bg-emerald-600 text-white text-lg font-semibold shadow-sm hover:bg-emerald-700 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
      >
        OK
      </Button>
    </div>
  );
};

export default NumericKeypadModal;
