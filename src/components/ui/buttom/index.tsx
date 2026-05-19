import React from 'react';

type Props = {
  type?: 'button' | 'submit';
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
};

const Button: React.FC<Props> = ({
  type = 'button',
  onClick,
  className = '',
  children,
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      // eslint-disable-next-line
      type={type ?? 'button'}
      onClick={handleClick}
      className={`p-2 px-4 bg-blue-500 text-white hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 flex items-center justify-center ${className}`}
      aria-label="Remove item"
    >
      {children}
    </button>
  );
};

Button.displayName = 'Button';

export default Button;
