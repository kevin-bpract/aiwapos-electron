import React from 'react';

interface SideHeadingProps {
  title: string;
  className?: string;
}

const SideHeading: React.FC<SideHeadingProps> = ({ title, className = '' }) => {
  return (
    <h2
      className={`relative inline-flex items-center gap-3 text-[26px] font-extrabold tracking-tight m-0 px-1 py-2 select-none ${className}`}
      style={{ color: 'var(--color-ink)' }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 6,
          height: 26,
          borderRadius: 3,
          background:
            'linear-gradient(180deg, var(--color-primary), var(--color-primary-deep))',
        }}
      />
      {title}
    </h2>
  );
};

SideHeading.displayName = 'SideHeading';

export default SideHeading;
