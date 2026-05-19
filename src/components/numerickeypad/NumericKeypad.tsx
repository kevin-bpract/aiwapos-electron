import React, { useEffect, useState, useCallback, useRef } from 'react';

interface NumericKeypadProps {
  className?: string;
}

const NumericKeypad: React.FC<NumericKeypadProps> = ({ className = '' }) => {
  const [lastFocusedElement, setLastFocusedElement] = useState<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        setLastFocusedElement(target);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const input = target.closest('input, textarea, [contenteditable="true"]') as HTMLElement;
      if (input) {
        setLastFocusedElement(input);
      }
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('click', handleClick, true);

    const activeElement = document.activeElement as HTMLElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable)
    ) {
      setLastFocusedElement(activeElement);
    }

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  const sendKeyToFocused = useCallback((key: string) => {
    const activeElement = document.activeElement as HTMLElement;
    const targetElement =
      activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable)
        ? activeElement
        : lastFocusedElement;

    if (!targetElement) return;

    if (targetElement !== document.activeElement) {
      targetElement.focus();
    }

    if (
      targetElement instanceof HTMLInputElement ||
      targetElement instanceof HTMLTextAreaElement
    ) {
      const input = targetElement;
      const isNumberInput = input.type === 'number';

      if (key === 'Enter') {
        // Robust Enter key simulation
        const dispatchEvent = (type: string) => {
          const ev = new KeyboardEvent(type, {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            view: window
          });
          // Ensure legacy properties are set even if constructor doesn't set them
          Object.defineProperty(ev, 'keyCode', { value: 13 });
          Object.defineProperty(ev, 'which', { value: 13 });
          input.dispatchEvent(ev);
        };

        dispatchEvent('keydown');
        dispatchEvent('keypress');
        dispatchEvent('keyup');
        return;
      }

      const isBackspace = key === 'Backspace';

      if (isNumberInput) {
        const currentValue = input.value || '';
        if (isBackspace) {
          const newValue = currentValue.slice(0, -1);
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          setter?.call(input, newValue);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          const newValue = currentValue + key;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          setter?.call(input, newValue);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const currentValue = input.value;

        let newValue = '';
        let newPos = start;

        if (isBackspace) {
          if (start === end && start > 0) {
            newValue = currentValue.slice(0, start - 1) + currentValue.slice(start);
            newPos = start - 1;
          } else {
            newValue = currentValue.slice(0, start) + currentValue.slice(end);
            newPos = start;
          }
        } else {
          newValue = currentValue.slice(0, start) + key + currentValue.slice(end);
          newPos = start + key.length;
        }

        const proto = input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter?.call(input, newValue);

        try {
          input.setSelectionRange(newPos, newPos);
        } catch (e) {
          // ignore
        }

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (targetElement.isContentEditable) {
      if (key === 'Enter') {
        document.execCommand('insertLineBreak');
      } else if (key === 'Backspace') {
        document.execCommand('delete', false);
      } else {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(key));
          range.collapse(false);
        }
      }
    }
  }, [lastFocusedElement]);

  const handleDigit = (digit: string) => sendKeyToFocused(digit);
  const handleDecimal = () => sendKeyToFocused('.');
  const handleBackspace = () => sendKeyToFocused('Backspace');
  const handleEnter = () => sendKeyToFocused('Enter');

  const handleClear = () => {
    const activeElement = document.activeElement as HTMLElement;
    const targetElement =
      activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable)
        ? activeElement
        : lastFocusedElement;

    if (!targetElement) return;

    if (targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement) {
      const proto = targetElement instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(targetElement, '');
      targetElement.dispatchEvent(new Event('input', { bubbles: true }));
      targetElement.dispatchEvent(new Event('change', { bubbles: true }));
      targetElement.focus();
    } else if (targetElement.isContentEditable) {
      targetElement.textContent = '';
      targetElement.focus();
    }
  };

  const keypadLayout = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => e.preventDefault()}
      data-numpad="true"
      className={`bg-white border border-gray-200 p-0 select-none ${className}`}
    >
      <div className="flex bg-gray-600">
        <div className="flex flex-col w-24">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleEnter}
            className="flex-1 bg-[#E63946] hover:bg-[#C81E2C] active:bg-[#8E0D18] text-white text-xs font-bold transition-all duration-200 px-3 py-4 border-r border-b border-white/10"
          >
            ENTER
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="flex-1 bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white text-xs font-bold transition-all duration-200 px-3 py-4 border-r border-white/10"
          >
            CLEAR
          </button>
        </div>

        {/* Right Three Columns - Numeric Keypad */}
        <div className="flex-1 flex flex-col">
          {keypadLayout.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-3">
              {row.map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleDigit(digit)}
                  className="bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white text-xl font-bold transition-all duration-200 py-6 border-r border-b border-white/10"
                >
                  {digit}
                </button>
              ))}
            </div>
          ))}

          {/* Bottom Row: Backspace, 0, Decimal */}
          <div className="grid grid-cols-3">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleBackspace}
              className="bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white text-xl font-bold transition-all duration-200 py-6 border-r border-white/10 last:border-r-0"
            >
              ←
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleDigit('0')}
              className="bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white text-xl font-bold transition-all duration-200 py-6 border-r border-white/10 last:border-r-0"
            >
              0
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDecimal}
              className="bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white text-xl font-bold transition-all duration-200 py-6 border-r border-white/10 last:border-r-0"
            >
              .
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NumericKeypad;
