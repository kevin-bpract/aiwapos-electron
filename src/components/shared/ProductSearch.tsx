import {
  Keyboard,
  FileSpreadsheet,
  Search,
  Loader2,
  Minus,
  Plus,
} from 'lucide-react';
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactDOM from 'react-dom';
import {
  type ProductItem,
} from '../../main/api/products';

export interface ProductSearchRef {
  focus: () => void;
}

interface ProductSearchProps {
  compact?: boolean;
  onSearch?: (query: string) => void;
  onProductLookup?: () => void;
  onProductFound?: (product: ProductItem) => void;
  onNumeriPadInvoke?: () => void;
  onIncreaseQuantity?: () => void;
  onDecreaseQuantity?: () => void;
  onExportExcel?: () => void;
  showQuantityControls?: boolean;
  barcodeOnly?: boolean;
}

const ProductSearch = forwardRef<ProductSearchRef, ProductSearchProps>(({
  compact = false,
  onSearch,
  onProductLookup,
  onProductFound,
  onNumeriPadInvoke,
  onIncreaseQuantity,
  onDecreaseQuantity,
  onExportExcel,
  showQuantityControls = false,
  barcodeOnly = false,
}, ref) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Expose focus method via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
  }));

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query || query.trim() === '') {
      setShowDropdown(false);
      setProducts([]);
      return;
    }

    // Check if query is numeric (likely a barcode)
    const isNumeric = /^\d+$/.test(query.trim());
    if (isNumeric && query.trim().length >= 3) {
      try {
        const productByBarcode = await window.products.getByBarcode(query.trim());
        if (productByBarcode) {
          handleProductSelect(productByBarcode);
          return;
        }
      } catch (error) {
        console.error('Error checking barcode:', error);
      }
    }

    // Only show dropdown and search by name/code if barcodeOnly is false
    if (barcodeOnly) {
      setShowDropdown(false);
      setProducts([]);
      return;
    }

    setShowDropdown(true);
    setIsSearching(true);
    try {
      const allProducts = await window.products.search(query.trim(), 100);
      setProducts(allProducts.slice(0, 10));
      setSelectedProductIndex(0);
    } catch (error) {
      console.error('Error searching products:', error);
      setProducts([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleProductSelect = (product: ProductItem) => {
    if (onProductFound) {
      onProductFound(product);
    }
    setSearchQuery('');
    onSearch?.('');
    setShowDropdown(false);
    setProducts([]);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownMaxHeight = 320; // max-h-80 is 20rem = 320px
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top = rect.bottom + 4;
      if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
        // Not enough space below, and there is more space above
        top = rect.top - Math.min(spaceAbove - 10, products.length > 0 ? (products.length * 60 + 20) : 150) - 4;

        // Ensure it doesn't go off search top
        if (top < 10) top = 10;
      }

      setDropdownPosition({
        top,
        left: rect.left,
        width: Math.max(rect.width, 384),
      });
    }
  }, [showDropdown, products.length]);

  const [lastInteractedWithKeyboard, setLastInteractedWithKeyboard] = useState(false);
  const handleMouseMove = () => {
    if (lastInteractedWithKeyboard) {
      setLastInteractedWithKeyboard(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showDropdown || products.length === 0) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setShowDropdown(false);
        setSearchQuery('');
        onSearch?.('');
        setProducts([]);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setLastInteractedWithKeyboard(true);
        setSelectedProductIndex((prev) =>
          prev < products.length - 1 ? prev + 1 : 0,
        );
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setLastInteractedWithKeyboard(true);
        setSelectedProductIndex((prev) =>
          prev > 0 ? prev - 1 : products.length - 1,
        );
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (products[selectedProductIndex]) {
          handleProductSelect(products[selectedProductIndex]);
        }
      }
    };

    if (showDropdown) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDropdown, products, selectedProductIndex, onSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('[data-numpad="true"]')
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        className="flex items-center gap-2 p-2"
        style={
          compact
            ? undefined
            : {
                background: '#fff',
                border: '1.5px solid var(--color-line)',
                borderRadius: 16,
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              }
        }
      >
        <div className="flex-1 relative">
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-primary)' }}
          >
            {isSearching ? (
              <Loader2 size={18} className="animate-spin" strokeWidth={2.4} />
            ) : (
              <Search size={18} strokeWidth={2.4} />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            dir="auto"
            placeholder="Search products by name, code or barcode…"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => {
              if (searchQuery && products.length > 0) {
                setShowDropdown(true);
              }
            }}
            className="ds-input"
            style={{
              paddingLeft: 40,
              paddingRight: 14,
              borderRadius: 12,
              minHeight: 46,
              cursor: barcodeOnly ? 'default' : 'text',
            }}
            readOnly={barcodeOnly && false}
          />
        </div>

        {showQuantityControls && (
          <>
            <button
              type="button"
              onClick={onDecreaseQuantity}
              className="ds-btn ds-btn-secondary"
              style={{ padding: '10px 14px', minHeight: 46 }}
              aria-label="Decrease quantity"
            >
              <Minus size={16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={onNumeriPadInvoke}
              className="ds-btn ds-btn-soft"
              style={{ padding: '10px 14px', minHeight: 46 }}
              aria-label="Numeric keypad"
            >
              <Keyboard size={18} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={onIncreaseQuantity}
              className="ds-btn ds-btn-primary"
              style={{ padding: '10px 14px', minHeight: 46 }}
              aria-label="Increase quantity"
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onProductLookup}
          className="ds-btn ds-btn-primary"
          style={{ padding: '10px 16px', minHeight: 46 }}
        >
          <Search size={16} strokeWidth={2.4} />
          <span className="hidden sm:inline">Lookup</span>
        </button>

        {onExportExcel && (
          <button
            type="button"
            onClick={onExportExcel}
            className="ds-btn ds-btn-secondary"
            style={{ padding: '10px 16px', minHeight: 46 }}
          >
            <FileSpreadsheet size={16} strokeWidth={2.2} />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
      </div>

      {showDropdown &&
        dropdownPosition &&
        ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              zIndex: 9999,
            }}
            className="flex flex-col overflow-hidden"
            style={{
              background: '#fff',
              border: '1px solid var(--color-line)',
              borderRadius: 14,
              boxShadow:
                '0 24px 60px rgba(15,23,42,0.18), 0 6px 18px rgba(15,23,42,0.08)',
              maxHeight: 320,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="overflow-y-auto"
              style={{ maxHeight: 320 }}
              onMouseMove={handleMouseMove}
            >
              {isSearching ? (
                <div
                  className="p-4 text-center text-[13px] font-semibold"
                  style={{ color: 'var(--color-ink-muted)' }}
                >
                  Loading…
                </div>
              ) : products.length > 0 ? (
                products.map((product, index) => {
                  const active = index === selectedProductIndex;
                  return (
                    <div
                      key={product.item_code}
                      className="p-3 cursor-pointer transition-colors"
                      style={{
                        borderBottom: '1px solid var(--color-line)',
                        background: active
                          ? 'var(--color-primary-soft)'
                          : 'transparent',
                      }}
                      onMouseOver={(e) => {
                        if (!active)
                          e.currentTarget.style.background =
                            'var(--color-primary-tint)';
                      }}
                      onMouseOut={(e) => {
                        if (!active)
                          e.currentTarget.style.background = 'transparent';
                      }}
                      onClick={() => handleProductSelect(product)}
                      onMouseEnter={() => {
                        if (!lastInteractedWithKeyboard) {
                          setSelectedProductIndex(index);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div
                            className="truncate text-[14px] font-bold"
                            style={{ color: 'var(--color-ink)' }}
                          >
                            {product.item_name}
                          </div>
                          {product.item_name_arabic?.trim() ? (
                            <div
                              dir="auto"
                              className="truncate text-[13px] font-medium mt-0.5"
                              style={{ color: 'var(--color-ink-muted)' }}
                            >
                              {product.item_name_arabic}
                            </div>
                          ) : null}
                          <div
                            className="truncate text-[11px] font-semibold uppercase tracking-wider mt-1"
                            style={{ color: 'var(--color-primary)' }}
                          >
                            {product.item_code}
                          </div>
                          {product.barcode && (
                            <div
                              className="truncate text-[11px] mt-0.5"
                              style={{ color: 'var(--color-ink-subtle)' }}
                            >
                              {product.barcode}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div
                            className="tnum text-[15px] font-extrabold"
                            style={{ color: 'var(--color-primary-deep)' }}
                          >
                            {product.standard_rate?.toFixed(2) || 'N/A'}
                          </div>
                          <div
                            className="text-[11px] mt-0.5"
                            style={{ color: 'var(--color-ink-muted)' }}
                          >
                            Stock: {product.actual_qty || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : searchQuery ? (
                <div
                  className="p-4 text-center text-[13px] font-semibold"
                  style={{ color: 'var(--color-ink-muted)' }}
                >
                  No products found
                </div>
              ) : (
                <div
                  className="p-4 text-center text-[13px] font-semibold"
                  style={{ color: 'var(--color-ink-muted)' }}
                >
                  Type to search products
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
});

ProductSearch.displayName = 'ProductSearch';

export default ProductSearch;
