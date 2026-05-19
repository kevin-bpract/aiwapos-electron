import React, { useState, useEffect } from 'react';
import { Minus, Plus, X, ImageIcon } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

interface Props {
  serialNumber?: number;
  title: string;
  /** Arabic product name (shown under English title when set) */
  titleArabic?: string | null;
  price: number;
  quantity: number;
  imageUrl: string;
  /** When false, hide the thumbnail column. When true, show 64×64 area (photo or placeholder). */
  showImage?: boolean;
  onIncrease?: () => void;
  onDecrease?: () => void;
  onRemove?: () => void;
  onClick?: () => void;
}

const RestaurantChekoutCartItem: React.FC<Props> = ({
  serialNumber,
  title,
  titleArabic,
  price,
  quantity,
  imageUrl,
  showImage = true,
  onIncrease,
  onDecrease,
  onRemove,
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  const handleClick = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).tagName === 'BUTTON'
    ) {
      return;
    }
    onClick?.();
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative flex gap-3 p-3 transition-all duration-150"
      style={{
        background: '#fff',
        border: '1.5px solid var(--color-line)',
        borderRadius: 16,
        cursor: onClick ? 'pointer' : 'default',
        borderColor: hover ? 'var(--color-primary)' : 'var(--color-line)',
        boxShadow: hover
          ? '0 8px 18px rgba(230, 57, 70, 0.10)'
          : '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
    >
      {serialNumber !== undefined && (
        <span
          className="absolute -left-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center px-1.5 text-[10px] font-bold tabular-nums"
          style={{
            background: 'var(--color-primary)',
            color: '#fff',
            borderRadius: 999,
            boxShadow: '0 4px 10px rgba(230, 57, 70, 0.32)',
          }}
        >
          {serialNumber}
        </span>
      )}

      {showImage && (
        <div
          className="flex-shrink-0 overflow-hidden relative"
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            background:
              'linear-gradient(135deg, var(--color-primary-tint) 0%, #fff 100%)',
            border: '1px solid var(--color-line)',
          }}
        >
          {imageUrl.trim() && !imageError ? (
            <img
              src={imageUrl}
              alt={[title, titleArabic].filter(Boolean).join(' · ')}
              className="h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ color: 'var(--color-primary)' }}
            >
              <ImageIcon size={22} strokeWidth={1.5} />
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h3
          className="truncate text-[13px] font-bold leading-tight"
          style={{ color: 'var(--color-ink)' }}
        >
          {title}
        </h3>
        {titleArabic?.trim() ? (
          <p
            dir="auto"
            className="truncate text-[12px] font-medium mt-0.5"
            style={{ color: 'var(--color-ink-muted)' }}
          >
            {titleArabic}
          </p>
        ) : null}
        <p
          className="tnum text-[14px] font-extrabold mt-1"
          style={{ color: 'var(--color-success-deep)' }}
        >
          {formatCurrency(price)}
        </p>

        <div
          className="mt-2 inline-flex items-center"
          style={{
            border: '1.5px solid var(--color-line)',
            borderRadius: 999,
            padding: 2,
            background: 'var(--color-page)',
          }}
        >
          <button
            type="button"
            onClick={onDecrease}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors"
            style={{
              color: 'var(--color-primary-deep)',
              background: '#fff',
              border: '1px solid var(--color-line)',
            }}
            aria-label="Decrease quantity"
          >
            <Minus size={14} strokeWidth={2.5} />
          </button>
          <span
            className="tnum mx-2 min-w-[20px] text-center text-[13px] font-bold"
            style={{ color: 'var(--color-ink)' }}
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={onIncrease}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors"
            style={{
              color: '#fff',
              background: 'var(--color-primary)',
              border: '1px solid var(--color-primary)',
              boxShadow: '0 4px 10px rgba(230, 57, 70, 0.28)',
            }}
            aria-label="Increase quantity"
          >
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="ds-iconbtn flex-shrink-0"
        style={{ width: 30, height: 30 }}
        title="Remove item"
        aria-label="Remove item"
      >
        <X size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
};

export default RestaurantChekoutCartItem;
