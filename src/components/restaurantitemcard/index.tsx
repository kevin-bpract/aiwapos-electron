import React, { useState, useEffect } from 'react';
import { Heart, ImageIcon } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

interface RestaurantItemProps {
  id?: number;
  name: string;
  arabic_name: string;
  description: string;
  price: number;
  imageUrl: string;
  itemCode: string;
  isFavorite?: number;
  onFavoriteChange?: (itemCode: string, isFavorite: number) => void;
  onClick?: () => void;
  onCustomize?: () => void;
  customWidth?: number;
  customHeight?: number;
  hasCustomOptions?: boolean;
  /** Setting: when false, the image block is not rendered. URL is unchanged. */
  showImage?: boolean;
}

const RestaurantItem: React.FC<RestaurantItemProps> = ({
  name,
  arabic_name,
  description,
  price,
  imageUrl,
  itemCode,
  isFavorite: initialIsFavorite = 0,
  onFavoriteChange,
  onClick,
  onCustomize,
  customWidth,
  customHeight,
  hasCustomOptions = false,
  showImage = true,
}) => {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite === 1);
  const [imageError, setImageError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setIsFavorite(initialIsFavorite === 1);
  }, [initialIsFavorite]);

  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  useEffect(() => {
    if (showImage) setImageError(false);
  }, [showImage]);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdating) return;
    const newFavoriteStatus = isFavorite ? 0 : 1;
    setIsUpdating(true);
    try {
      setIsFavorite(!isFavorite);
      await window.products.updateFavorite(itemCode, newFavoriteStatus);
      onFavoriteChange?.(itemCode, newFavoriteStatus);
    } catch (error) {
      console.error('Failed to update favorite status:', error);
      setIsFavorite(isFavorite);
    } finally {
      setIsUpdating(false);
    }
  };

  const w = customWidth ?? 240;
  const h = customHeight ?? 300;
  const imageHeight = customHeight ? Math.round(customHeight * 0.58) : 174;

  const priceRow = (
    <div className="flex shrink-0 items-center justify-between gap-2">
      <p
        className="tnum text-[17px] font-extrabold tracking-tight"
        style={{ color: 'var(--color-success-deep)' }}
      >
        {formatCurrency(price)}
      </p>
      {hasCustomOptions && onCustomize && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCustomize();
          }}
          className="inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors"
          style={{
            background: 'var(--color-primary-soft)',
            color: 'var(--color-primary-deep)',
            border: '1px solid transparent',
          }}
          title="Customize"
        >
          Customize
        </button>
      )}
    </div>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="group relative flex flex-col overflow-hidden bg-white cursor-pointer transition-all duration-200"
      style={{
        width: `${w}px`,
        minWidth: `${w}px`,
        maxWidth: `${w}px`,
        height: `${h}px`,
        borderRadius: 20,
        border: '1.5px solid var(--color-line)',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = 'var(--color-primary)';
        el.style.transform = 'translateY(-3px)';
        el.style.boxShadow =
          '0 18px 40px rgba(230, 57, 70, 0.18), 0 4px 12px rgba(15, 23, 42, 0.06)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = 'var(--color-line)';
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.04)';
      }}
    >
      <button
        type="button"
        onClick={handleFavoriteClick}
        className="absolute top-3 right-3 z-10 flex items-center justify-center transition-all duration-200"
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          background: isFavorite
            ? 'var(--color-primary)'
            : 'rgba(255, 255, 255, 0.95)',
          color: isFavorite ? '#fff' : 'var(--color-ink-subtle)',
          boxShadow: isFavorite
            ? '0 6px 14px rgba(230, 57, 70, 0.32)'
            : '0 2px 6px rgba(15, 23, 42, 0.12)',
          border: isFavorite
            ? '1px solid var(--color-primary)'
            : '1px solid var(--color-line)',
        }}
        aria-label="Toggle favorite"
      >
        <Heart
          size={16}
          strokeWidth={2.4}
          fill={isFavorite ? 'currentColor' : 'none'}
        />
      </button>

      {showImage && (
        <div
          className="w-full flex-shrink-0 overflow-hidden relative"
          style={{
            height: `${imageHeight}px`,
            background:
              'linear-gradient(135deg, var(--color-primary-tint) 0%, #fff 100%)',
          }}
        >
          {imageUrl.trim() && !imageError ? (
            <img
              src={imageUrl}
              alt={name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ color: 'var(--color-primary)' }}
            >
              <ImageIcon size={42} strokeWidth={1.5} />
            </div>
          )}
        </div>
      )}

      {showImage ? (
        <div className="flex min-h-0 flex-1 flex-col justify-between overflow-hidden px-3 py-2.5">
          <div className="min-h-0 flex-1 overflow-hidden">
            <h3
              className="line-clamp-1 text-[14px] font-bold leading-tight"
              style={{ color: 'var(--color-ink)' }}
            >
              {name}
            </h3>
            {arabic_name?.trim() && (
              <p
                dir="rtl"
                className="line-clamp-1 text-[13px] font-medium leading-tight mt-0.5"
                style={{ color: 'var(--color-ink-muted)' }}
              >
                {arabic_name}
              </p>
            )}
            {description?.trim() && (
              <p
                className="mt-1 line-clamp-2 text-[11px] leading-snug"
                style={{ color: 'var(--color-ink-subtle)' }}
              >
                {description}
              </p>
            )}
          </div>
          <div className="mt-2 shrink-0">{priceRow}</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col justify-center px-4 py-3 pr-14">
            <p
              className="truncate text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ color: 'var(--color-primary)' }}
            >
              {itemCode}
            </p>
            <h3
              className="mt-1 line-clamp-3 text-[14px] font-bold leading-snug"
              style={{ color: 'var(--color-ink)' }}
            >
              {name}
            </h3>
            {description ? (
              <p
                className="mt-1.5 line-clamp-4 text-[11px] leading-relaxed"
                style={{ color: 'var(--color-ink-muted)' }}
              >
                {description}
              </p>
            ) : null}
          </div>
          <div
            className="shrink-0 px-4 py-2.5"
            style={{ borderTop: '1px solid var(--color-line)' }}
          >
            {priceRow}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(RestaurantItem);
