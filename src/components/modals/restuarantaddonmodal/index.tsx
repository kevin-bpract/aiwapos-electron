import React, { useState } from 'react';
import RestuarantAddonItem from '../../restaurantaddonitem';
import Button from '../../ui/buttom';
import { formatCurrency } from '../../../utils/format';

interface Props {
  onClose?: () => void;
  onConfirm?: (selectedAddons: any[], selectedTags?: string[]) => void;
  items: any[];
  tags?: string[];
  initialSelectedTags?: string[];
}

const RestaurantItemAddOnModal: React.FC<Props> = ({
  items,
  onClose,
  onConfirm,
  tags = [],
  initialSelectedTags = [],
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    new Set(initialSelectedTags),
  );
  const [notes, setNotes] = useState<string>('');

  const toggleAddon = (id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    const selected = items.filter((item) => selectedIds.has(item.id));
    onConfirm?.(selected, Array.from(selectedTags));
    onClose?.();
  };

  const handleSkip = () => {
    onClose?.();
  };

  const totalPrice = items
    .filter((item) => selectedIds.has(item.id))
    .reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">Need Add-ons?</h3>
          <p className="text-sm text-gray-500 mt-1">
            Select add-ons to enhance your meal
          </p>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <svg
              className="w-16 h-16 mx-auto mb-3 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-base">No add-ons available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((addon) => (
              <RestuarantAddonItem
                key={addon.id}
                title={addon.title}
                imageUrl={addon.imageUrl}
                onRemoveItem={() => { }}
                price={addon.price}
                isSelected={selectedIds.has(addon.id)}
                onToggle={() => toggleAddon(addon.id)}
              />
            ))}
          </div>
        )}
      </div>

      {tags && tags.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-200">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => {
              const tagString = typeof tag === 'string' ? tag : String(tag);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggleTag(tagString)}
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${selectedTags.has(tagString)
                      ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {tagString}
                  {selectedTags.has(tagString) && (
                    <svg
                      className="ml-1.5 w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-6 py-3 border-t border-gray-200">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Notes</h2>
        <textarea
          className="w-full border border-gray-300 rounded-md p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          placeholder="Add special instructions or notes..."
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="px-6 py-4 border-t border-gray-200 space-y-3">
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 rounded-lg p-3 flex justify-between items-center">
            <span className="font-medium text-gray-700">Total Add-ons</span>
            <span className="text-lg font-bold text-blue-600">
              {formatCurrency(totalPrice)}
            </span>
          </div>
        )}
        <div className="flex gap-3">
          <Button
            onClick={handleSkip}
            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium"
          >
            Skip
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium"
          >
            Confirm {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RestaurantItemAddOnModal;
