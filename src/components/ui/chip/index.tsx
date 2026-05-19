import React from 'react';

interface ChipProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'default';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const variantStyles = {
    primary: 'bg-blue-100 text-blue-700 border-blue-200',
    secondary: 'bg-purple-100 text-purple-700 border-purple-200',
    success: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-orange-100 text-orange-700 border-orange-200',
    default: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {label}
    </span>
  );
};

export default Chip;
