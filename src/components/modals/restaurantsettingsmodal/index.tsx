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
    <div className="flex flex-col min-w-[min(100vw-2rem,420px)] max-w-lg">
      <div className="px-5 pt-2 pb-4 space-y-6 max-h-[min(70vh,520px)] overflow-y-auto">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Display
          </h3>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">Product images</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Hide product photos on cards (updates live).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showProductImages}
                onClick={() => onShowProductImagesChange(!showProductImages)}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                  showProductImages ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
                    showProductImages ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Card size
          </h3>
          <p className="text-xs text-slate-500 -mt-1">
            Adjust sliders — product cards update in real time.
          </p>
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-800">Width</span>
                <span className="text-sm tabular-nums font-semibold text-blue-700">
                  {cardWidth}px
                </span>
              </div>
              <input
                type="range"
                min={RESTAURANT_CARD.W_MIN}
                max={RESTAURANT_CARD.W_MAX}
                step={RESTAURANT_CARD.STEP}
                value={cardWidth}
                onChange={(e) => onCardWidthChange(Number(e.target.value))}
                className="w-full h-2 rounded-full bg-slate-200 accent-blue-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-2">
                <span>{RESTAURANT_CARD.W_MIN}px</span>
                <span>{RESTAURANT_CARD.W_MAX}px</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-800">Height</span>
                <span className="text-sm tabular-nums font-semibold text-blue-700">
                  {cardHeight}px
                </span>
              </div>
              <input
                type="range"
                min={RESTAURANT_CARD.H_MIN}
                max={RESTAURANT_CARD.H_MAX}
                step={RESTAURANT_CARD.STEP}
                value={cardHeight}
                onChange={(e) => onCardHeightChange(Number(e.target.value))}
                className="w-full h-2 rounded-full bg-slate-200 accent-blue-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-2">
                <span>{RESTAURANT_CARD.H_MIN}px</span>
                <span>{RESTAURANT_CARD.H_MAX}px</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50/90">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default RestaurantSettingsModal;
