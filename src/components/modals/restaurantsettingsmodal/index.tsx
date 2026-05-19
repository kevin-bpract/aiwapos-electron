import React from 'react';
import { RESTAURANT_CARD } from '../../../constants/restaurantCardDimensions';

export interface RestaurantUiSettings {
  cardWidth: number;
  cardHeight: number;
  showProductImages: boolean;
}

interface RestaurantSettingsModalProps {
  cardWidth: number;
  cardHeight: number;
  showProductImages: boolean;
  /** Live preview while dragging sliders or toggling (updates grid behind modal). */
  onCardWidthChange: (width: number) => void;
  onCardHeightChange: (height: number) => void;
  onShowProductImagesChange: (show: boolean) => void;
  onCancel: () => void;
  /** Persist current values and close (values already applied via preview). */
  onSave: () => void;
}

// Brand tokens (kept inline; scoped to this modal — see docs/DESIGN_SYSTEM.md)
const RED = '#E63946';
const RED_HOVER = '#C81E2C';
const RED_SOFT = '#FFE5E8';
const TEXT = '#0F172A';
const TEXT_MUTED = '#64748B';
const TEXT_SUBTLE = '#94A3B8';
const BORDER = '#E2E5EA';
const BORDER_STRONG = '#CBD0D8';
const SURFACE_SOFT = '#F7F8FA';

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3
    style={{
      margin: 0,
      fontSize: 11,
      fontWeight: 700,
      color: TEXT_SUBTLE,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </h3>
);

const SliderCard: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}> = ({ label, value, min, max, step, onChange }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: RED,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}px
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rsm-slider"
        style={{
          width: '100%',
          height: 6,
          appearance: 'none',
          WebkitAppearance: 'none',
          background: `linear-gradient(to right, ${RED} 0%, ${RED} ${pct}%, ${BORDER} ${pct}%, ${BORDER} 100%)`,
          borderRadius: 999,
          outline: 'none',
          cursor: 'pointer',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8,
          fontSize: 11,
          fontWeight: 500,
          color: TEXT_SUBTLE,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{min}px</span>
        <span>{max}px</span>
      </div>
    </div>
  );
};

const RestaurantSettingsModal: React.FC<RestaurantSettingsModalProps> = ({
  cardWidth,
  cardHeight,
  showProductImages,
  onCardWidthChange,
  onCardHeightChange,
  onShowProductImagesChange,
  onCancel,
  onSave,
}) => {
  return (
    <div
      style={{
        background: '#FFFFFF',
        width: 'min(520px, 92vw)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: TEXT,
      }}
    >
      {/* Slider thumb + focus styling (scoped via class) */}
      <style>{`
        .rsm-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #FFFFFF;
          border: 2px solid ${RED};
          box-shadow: 0 2px 6px rgba(230,57,70,0.35);
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.18s ease;
        }
        .rsm-slider::-webkit-slider-thumb:hover { transform: scale(1.08); }
        .rsm-slider::-webkit-slider-thumb:active { transform: scale(0.96); }
        .rsm-slider:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 4px rgba(230,57,70,0.15);
        }
        .rsm-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #FFFFFF;
          border: 2px solid ${RED};
          box-shadow: 0 2px 6px rgba(230,57,70,0.35);
          cursor: pointer;
        }
        .rsm-btn-primary:hover { background: ${RED_HOVER} !important; transform: translateY(-1px); box-shadow: 0 12px 26px rgba(230,57,70,0.34) !important; }
        .rsm-btn-primary:active { transform: translateY(0); }
        .rsm-btn-secondary:hover { border-color: ${RED} !important; color: ${RED} !important; background: #FFF1F3 !important; }
      `}</style>

      <div
        style={{
          padding: '20px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          maxHeight: 'min(70vh, 560px)',
          overflowY: 'auto',
        }}
      >
        {/* Display section */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionLabel>Display</SectionLabel>
          <div
            style={{
              background: SURFACE_SOFT,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: TEXT,
                }}
              >
                Product images
              </p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  fontWeight: 400,
                  color: TEXT_MUTED,
                  lineHeight: 1.4,
                }}
              >
                Show product photos on cards (updates live).
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showProductImages}
              aria-label="Toggle product images"
              onClick={() => onShowProductImagesChange(!showProductImages)}
              style={{
                position: 'relative',
                flexShrink: 0,
                width: 44,
                height: 26,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                background: showProductImages ? RED : BORDER_STRONG,
                transition: 'background 0.18s ease',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: showProductImages ? 21 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.18)',
                  transition: 'left 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
              />
            </button>
          </div>
        </section>

        {/* Card size section */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <SectionLabel>Card size</SectionLabel>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 400,
                color: TEXT_MUTED,
              }}
            >
              Adjust sliders — product cards update in real time.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SliderCard
              label="Width"
              value={cardWidth}
              min={RESTAURANT_CARD.W_MIN}
              max={RESTAURANT_CARD.W_MAX}
              step={RESTAURANT_CARD.STEP}
              onChange={onCardWidthChange}
            />
            <SliderCard
              label="Height"
              value={cardHeight}
              min={RESTAURANT_CARD.H_MIN}
              max={RESTAURANT_CARD.H_MAX}
              step={RESTAURANT_CARD.STEP}
              onChange={onCardHeightChange}
            />
          </div>
        </section>
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          padding: '16px 24px',
          borderTop: `1px solid ${BORDER}`,
          background: SURFACE_SOFT,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="rsm-btn-secondary"
          style={{
            padding: '12px 22px',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '0.01em',
            color: TEXT,
            background: '#FFFFFF',
            border: `1.5px solid ${BORDER}`,
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            cursor: 'pointer',
            transition:
              'background 0.18s ease, color 0.18s ease, border-color 0.18s ease',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rsm-btn-primary"
          style={{
            padding: '12px 26px',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '0.01em',
            color: '#FFFFFF',
            background: RED,
            border: 'none',
            boxShadow: '0 8px 20px rgba(230,57,70,0.28)',
            cursor: 'pointer',
            transition:
              'background 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease',
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default RestaurantSettingsModal;
