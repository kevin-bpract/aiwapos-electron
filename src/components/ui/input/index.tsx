import React, { forwardRef, ForwardedRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: ForwardedRef<HTMLInputElement>;
}

const InputField = forwardRef<HTMLInputElement, InputProps>(
  ({ placeholder = '', value = '', className = '', ...props }, ref) => {
    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          placeholder={placeholder}
          value={value}
          className={`w-full p-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm font-medium shadow-sm ${className}`}
          {...props}
        />
      </div>
    );
  },
);

InputField.displayName = 'InputField';

export default InputField;
