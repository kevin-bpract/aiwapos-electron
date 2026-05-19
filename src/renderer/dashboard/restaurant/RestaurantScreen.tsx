import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import RestaurantItem from '../../../components/restaurantitemcard';
import ProductSearch from '../../../components/shared/ProductSearch';
import Portal from '../../../components/portal';
import RestaurantItemAddOnModal from '../../../components/modals/restuarantaddonmodal';
import ProductInfoModal, {
  type SalesDetailsData,
} from '../../../components/modals/productinfomodal';
import RestaurantSettingsModal from '../../../components/modals/restaurantsettingsmodal';
import RestaurantCheckoutModal from '../../../components/modals/restaurantcheckoutmodal';
import RestaurantOrderModal from '../../../components/modals/restaurantordermodal';
import RestaurantOrderHistoryModal from '../../../components/modals/restaurantorderhistorymodal';
import RestaurantInvoiceHistoryModal from '../../../components/modals/restaurantinvoicehistorymodal';
import RestaurantChekoutCartItem from '../../../components/restaurantchekoutcartitem';
import { getSalesOrder, type SalesOrder } from '../../../main/api/salesOrders';
import { type ProductItem } from '../../../main/api/products';
import ListProductsModal from '../../../components/modals/listproductsmodal';
import EditProductModal from '../../../components/modals/editproductmodal';
import { type Customer } from '../../../types/customer';
import {
  useCustomerType,
  CustomerTypeProvider,
} from '../../contexts/CustomerTypeContext';
import { useAuth } from '../../contexts/AuthContext';
import { type POSSettings } from '../../../types/posSettings';
import {
  productToSaleItem,
  calculateTotalAmount,
  getPriceFromPriceList,
} from './lib/pricing';
import { useRestaurantCart } from './hooks/useRestaurantCart';
import { formatCurrency } from '../../../utils/format';
import { exportToExcel } from '../../../utils/export';
import {
  Settings,
  Trash2,
  ChevronDown,
  ShoppingBag,
  ClipboardList,
  PauseCircle,
  ListOrdered,
  Receipt,
  CreditCard,
  Phone,
} from 'lucide-react';
import './styles.scss';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcut';
import KeyboardConfig from '../../../constants/kb_config';
import { toast } from 'sonner';
import type { RestaurantUiSettings } from '../../../components/modals/restaurantsettingsmodal';
import HoldListModal from '../../../components/modals/holdlistmodal';
import { saveHeldCart, deleteHeldCart, type HeldCart } from '../../../main/api/heldCarts';
import { RESTAURANT_CARD } from '../../../constants/restaurantCardDimensions';
import OnScreenKeyboard from '../../../components/onscreenkeyboard/OnScreenKeyboard';
import { useOnScreenKeyboardEnabled } from '../../../hooks/useOnScreenKeyboardEnabled';

const RESTAURANT_UI_SETTINGS_KEY = 'restaurant_ui_settings';

function clampCardWidth(w: number): number {
  return Math.min(
    RESTAURANT_CARD.W_MAX,
    Math.max(
      RESTAURANT_CARD.W_MIN,
      Math.round(w / RESTAURANT_CARD.STEP) * RESTAURANT_CARD.STEP,
    ),
  );
}

function clampCardHeight(h: number): number {
  return Math.min(
    RESTAURANT_CARD.H_MAX,
    Math.max(
      RESTAURANT_CARD.H_MIN,
      Math.round(h / RESTAURANT_CARD.STEP) * RESTAURANT_CARD.STEP,
    ),
  );
}

/** Substring match for product grid: English (case-insensitive), Arabic, codes, barcodes */
function productMatchesRestaurantSearch(p: ProductItem, raw: string): boolean {
  const needle = raw.trim();
  if (!needle) return true;

  const parts: string[] = [
    p.item_name,
    p.name ?? '',
    p.item_name_arabic ?? '',
    p.item_code,
    p.description ?? '',
  ];

  if (Array.isArray(p.barcodes)) {
    for (const b of p.barcodes) {
      if (b && typeof b === 'object' && b.barcode) {
        parts.push(String(b.barcode));
      }
    }
  }

  const haystack = parts
    .filter((s) => s != null && String(s).length > 0)
    .map((s) => String(s).normalize('NFC'))
    .join('\0');

  const n = needle.normalize('NFC');
  if (haystack.includes(n)) return true;

  return haystack.toLocaleLowerCase().includes(n.toLocaleLowerCase());
}

interface Category {
  id: string;
  name: string;
  parent_item_group?: string;
  image?: string | null;
  custom_is_favorite_group?: number;
}

const CARD_GAP = 8;
const OVERSCAN_ROWS = 3;

// Virtualized product grid: only renders visible rows + overscan for 1000+ products
const VirtualizedProductGrid = React.memo(function VirtualizedProductGrid({
  filteredProducts,
  cardWidth,
  cardHeight,
  showProductImages,
  backendUrl,
  userPriceList,
  isTaxIncluded,
  draggedProductIndex,
  onProductClick,
  onFavoriteChange,
  onCustomize,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragMove,
}: {
  filteredProducts: ProductItem[];
  cardWidth: number;
  cardHeight: number;
  showProductImages: boolean;
  backendUrl: string;
  userPriceList: string;
  isTaxIncluded: boolean;
  draggedProductIndex: number | null;
  onProductClick: (product: ProductItem) => void;
  onFavoriteChange: (itemCode: string, isFavorite: number) => void;
  onCustomize: (product: ProductItem) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragMove: (x: number, y: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const columnCount = Math.max(
    1,
    Math.floor((containerSize.width + CARD_GAP) / (cardWidth + CARD_GAP)),
  );

  const rowHeight = cardHeight + CARD_GAP;
  const rowCount = Math.ceil(filteredProducts.length / columnCount);
  const totalHeight = rowCount * rowHeight;

  const visibleRowStart = Math.max(
    0,
    Math.floor(scrollTop / rowHeight) - OVERSCAN_ROWS,
  );
  const visibleRowEnd = Math.min(
    rowCount - 1,
    Math.ceil((scrollTop + containerSize.height) / rowHeight) + OVERSCAN_ROWS,
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? {
        width: 0,
        height: 0,
      };
      setContainerSize({ width, height });
    });
    ro.observe(el);
    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, []);

  const handleDragOverCapture = useCallback(
    (e: React.DragEvent) => {
      onDragMove(e.clientX, e.clientY);
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const cell = target?.closest('[data-flat-index]');
      const idx = cell
        ? parseInt(cell.getAttribute('data-flat-index') ?? '', 10)
        : null;
      if (idx >= 0 && idx < filteredProducts.length) onDragOver(e, idx);
    },
    [filteredProducts.length, onDragOver, onDragMove],
  );

  const rows: {
    rowIndex: number;
    products: ProductItem[];
    startIndex: number;
  }[] = [];
  for (let r = visibleRowStart; r <= visibleRowEnd; r++) {
    const startIndex = r * columnCount;
    const slice = filteredProducts.slice(startIndex, startIndex + columnCount);
    if (slice.length > 0)
      rows.push({ rowIndex: r, products: slice, startIndex });
  }

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto overflow-x-hidden px-1"
      style={{ height: '100%', minHeight: 0 }}
      onScroll={handleScroll}
      onDragOver={handleDragOverCapture}
    >
      <div style={{ height: totalHeight, position: 'relative', minHeight: 1 }}>
        {rows.map(({ rowIndex, products: rowProducts, startIndex }) => (
          <div
            key={rowIndex}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: rowIndex * rowHeight,
              height: rowHeight,
              display: 'flex',
              flexWrap: 'nowrap',
              gap: CARD_GAP,
              alignItems: 'flex-start',
            }}
          >
            {rowProducts.map((product, colIndex) => {
              const flatIndex = startIndex + colIndex;
              return (
                <div
                  key={product.item_code}
                  data-flat-index={flatIndex}
                  style={{ flexShrink: 0 }}
                >
                  <ProductCard
                    product={product}
                    index={flatIndex}
                    isDragging={draggedProductIndex === flatIndex}
                    backendUrl={backendUrl}
                    userPriceList={userPriceList}
                    isTaxIncluded={isTaxIncluded}
                    cardWidth={cardWidth}
                    cardHeight={cardHeight}
                    onProductClick={onProductClick}
                    onFavoriteChange={onFavoriteChange}
                    onCustomize={onCustomize}
                    onDragStart={(e) => onDragStart(e, flatIndex)}
                    onDragOver={onDragOver}
                    onDragEnd={onDragEnd}
                    showProductImages={showProductImages}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

// Memoized product card to avoid re-rendering all products when parent state (e.g. cart) changes
const ProductCard = React.memo(function ProductCard({
  product,
  index,
  isDragging,
  backendUrl,
  userPriceList,
  isTaxIncluded,
  cardWidth,
  cardHeight,
  onProductClick,
  onFavoriteChange,
  onCustomize,
  onDragStart,
  onDragOver,
  onDragEnd,
  showProductImages,
}: {
  product: ProductItem;
  index: number;
  isDragging: boolean;
  backendUrl: string;
  userPriceList: string;
  isTaxIncluded: boolean;
  cardWidth: number;
  cardHeight: number;
  onProductClick: (product: ProductItem) => void;
  onFavoriteChange: (itemCode: string, isFavorite: number) => void;
  onCustomize: (product: ProductItem) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  showProductImages: boolean;
}) {
  const onProductClickRef = React.useRef(onProductClick);
  onProductClickRef.current = onProductClick;
  const onCustomizeRef = React.useRef(onCustomize);
  onCustomizeRef.current = onCustomize;
  const stableOnClick = React.useCallback(() => {
    onProductClickRef.current(product);
  }, [product]);
  const stableOnCustomize = React.useCallback(() => {
    onCustomizeRef.current(product);
  }, [product]);

  const getFullImageUrl = (imagePath: string | null | undefined): string => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://'))
      return imagePath;
    const base = backendUrl.endsWith('/')
      ? backendUrl.slice(0, -1)
      : backendUrl;
    const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${base}${path}`;
  };
  const price =
    getPriceFromPriceList(product, userPriceList, product.stock_uom || '')
      .price ||
    product.standard_rate ||
    product.current_price ||
    0;
  const tags = product.custom_item_tag_list
    ? Array.isArray(product.custom_item_tag_list)
      ? product.custom_item_tag_list
      : typeof product.custom_item_tag_list === 'string'
        ? (() => {
            try {
              const p = JSON.parse(product.custom_item_tag_list);
              return Array.isArray(p) ? p : [];
            } catch {
              return [];
            }
          })()
        : []
    : [];
  const hasCustomOptions = tags.length > 0;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: 'grab' }}
    >
      <RestaurantItem
        name={product.item_name || product.item_code}
        arabic_name={product.item_name_arabic || ''}
        description={product.description || product.item_name_arabic || ''}
        price={price}
        imageUrl={getFullImageUrl(product.image)}
        itemCode={product.item_code}
        isFavorite={product.custom_is_favorite || 0}
        onFavoriteChange={onFavoriteChange}
        onClick={stableOnClick}
        onCustomize={stableOnCustomize}
        hasCustomOptions={hasCustomOptions}
        customWidth={cardWidth}
        customHeight={cardHeight}
        showImage={showProductImages}
      />
    </div>
  );
});

const addOnList = [];

//
// Addons are disabled for now
// const addOnList = [
//   {
//     id: 1,
//     title: 'Extra Cheese',
//     price: 1.5,
//     imageUrl:
//       'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fwww.pngmart.com%2Ffiles%2F16%2FBacon-Cheese-Burger-PNG-File.png&f=1&nofb=1&ipt=fdaf38e418a01f67a6bca3f24bfc86a0db0415c8e2d6da561c893bbc64bd064f',
//   },
// ];

// const orderList = ['Mahalli', 'No Bun', 'Extra Cheese', 'Large Size'];

// const OrderListItem = ({ orderName }: { orderName: string }) => {
//   return (
//     <button className="bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-500 rounded-lg px-4 py-2 font-medium text-sm text-gray-700 hover:text-blue-600 transition-all duration-200 whitespace-nowrap flex-shrink-0">
//       {orderName}
//     </button>
//   );
// };

function Restaurant() {
  const { t } = useTranslation();
  const { userPriceList } = useCustomerType();
  const cart = useRestaurantCart();
  const [addOnModalVisible, setAddOnModalVisible] = useState<boolean>(false);
  const [productInfoModalVisible, setProductInfoModalVisible] =
    useState<boolean>(false);
  const [settingsModalVisible, setSettingsModalVisible] =
    useState<boolean>(false);
  const [checkoutModalVisible, setCheckoutModalVisible] =
    useState<boolean>(false);
  const [orderModalVisible, setOrderModalVisible] = useState<boolean>(false);
  const [orderHistoryModalVisible, setOrderHistoryModalVisible] =
    useState<boolean>(false);
  const [invoiceHistoryModalVisible, setInvoiceHistoryModalVisible] =
    useState<boolean>(false);
  const [holdListModalVisible, setHoldListModalVisible] =
    useState<boolean>(false);
  const [listProductsModalVisible, setListProductsModalVisible] =
    useState<boolean>(false);
  const [editProduct, setEditProduct] = useState<ProductItem | null>(null);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedProductIndex, setDraggedProductIndex] = useState<number | null>(
    null,
  );
  const [dragPosition, setDragPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [cardWidth, setCardWidth] = useState<number>(250);
  const [cardHeight, setCardHeight] = useState<number>(320);
  const [showProductImages, setShowProductImages] = useState<boolean>(true);
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [productImages, setProductImages] = useState<Map<string, string>>(
    new Map(),
  );
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(
    null,
  );
  const [showCustomerDropdown, setShowCustomerDropdown] =
    useState<boolean>(false);
  const { user } = useAuth();
  const onScreenKeyboardEnabled = useOnScreenKeyboardEnabled();
  const [posSettings, setPosSettings] = useState<POSSettings | null>(null);

  const salesPerson =
    posSettings?.sales_person_details?.find((p) => p.user === user) ||
    posSettings?.sales_person_details?.[0];

  const isTaxIncluded =
    (salesPerson?.is_this_tax_included_in_basic_rate ??
      parseInt(posSettings?.is_this_tax_included_in_basic_rate || '0')) === 1;
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState<boolean>(false);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState<number>(0);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const customerButtonRef = useRef<HTMLButtonElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch products from the database
  useEffect(() => {
    const fetchBackendUrl = async () => {
      try {
        const url = await window.appConfig.getBackendUrl();
        setBackendUrl(url);
      } catch (error) {
        console.error('Failed to fetch backend URL:', error);
      }
    };
    fetchBackendUrl();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await window.app_config.get(RESTAURANT_UI_SETTINGS_KEY);
        if (cancelled || !raw) return;
        const p = JSON.parse(raw) as Partial<RestaurantUiSettings>;
        if (typeof p.cardWidth === 'number') {
          setCardWidth(clampCardWidth(p.cardWidth));
        }
        if (typeof p.cardHeight === 'number') {
          setCardHeight(clampCardHeight(p.cardHeight));
        }
        if (typeof p.showProductImages === 'boolean') {
          setShowProductImages(p.showProductImages);
        }
      } catch (e) {
        console.error('Failed to load restaurant UI settings:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const restaurantUiSnapshotRef = useRef<RestaurantUiSettings | null>(null);

  const openRestaurantSettings = useCallback(() => {
    restaurantUiSnapshotRef.current = {
      cardWidth,
      cardHeight,
      showProductImages,
    };
    setSettingsModalVisible(true);
  }, [cardWidth, cardHeight, showProductImages]);

  const handleCloseRestaurantSettings = useCallback(() => {
    const snap = restaurantUiSnapshotRef.current;
    if (snap) {
      setCardWidth(snap.cardWidth);
      setCardHeight(snap.cardHeight);
      setShowProductImages(snap.showProductImages);
    }
    setSettingsModalVisible(false);
  }, []);

  const handlePreviewCardWidth = useCallback((w: number) => {
    setCardWidth(clampCardWidth(w));
  }, []);

  const handlePreviewCardHeight = useCallback((h: number) => {
    setCardHeight(clampCardHeight(h));
  }, []);

  const handleSaveRestaurantUi = useCallback(async () => {
    const s: RestaurantUiSettings = {
      cardWidth: clampCardWidth(cardWidth),
      cardHeight: clampCardHeight(cardHeight),
      showProductImages,
    };
    setCardWidth(s.cardWidth);
    setCardHeight(s.cardHeight);
    try {
      await window.app_config.save(
        RESTAURANT_UI_SETTINGS_KEY,
        JSON.stringify(s),
      );
      toast.success(t('messages.restaurantDisplaySettingsSaved'));
      restaurantUiSnapshotRef.current = s;
      setSettingsModalVisible(false);
    } catch (e) {
      console.error('Failed to save restaurant UI settings:', e);
      toast.error(t('messages.couldNotSaveDisplaySettings'));
    }
  }, [cardWidth, cardHeight, showProductImages, t]);

  // Load POS settings to determine tax inclusion
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await window.posSettings.get();
        setPosSettings(settings);
      } catch (error) {
        console.error('Failed to load POS settings:', error);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const itemGroups = await window.itemGroups.getAll();
        if (Array.isArray(itemGroups)) {
          const formattedCategories: Category[] = itemGroups.map(
            (group: any, index: number) => ({
              id: group.name,
              name: group.name,
              parent_item_group: group.parent_item_group,
              image: group.image,
              custom_is_favorite_group: group.custom_is_favorite_group,
            }),
          );
          // Apply saved order so it persists across app restarts
          const savedOrder = await window.categorySortOrder.get();
          if (savedOrder && savedOrder.length > 0) {
            const ordered = savedOrder
              .map((id) => formattedCategories.find((c) => c.id === id))
              .filter(Boolean) as Category[];
            const newOnes = formattedCategories.filter(
              (c) => !savedOrder.includes(c.id),
            );
            setCategories([...ordered, ...newOnes]);
          } else {
            setCategories(formattedCategories);
          }
        }
      } catch (error) {
        console.error('Failed to fetch item groups:', error);
      }
    };

    fetchCategories();
  }, []);

  // Resolve default customer name from POS sales_person_details for the logged user.
  // Backend field naming can vary; support common variants.
  const resolveConfiguredDefaultCustomerName = useCallback(():
    | string
    | null => {
    const details = salesPerson as unknown as
      | Record<string, unknown>
      | undefined;
    if (!details) return null;
    const candidates = [
      details.default_customer,
      details.customer,
      details.customer_name,
      details.default_customer_name,
      details.default_customer_code,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 0) return c.trim();
    }
    return null;
  }, [salesPerson]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const productsFromDB = await window.products.getAll();
        if (Array.isArray(productsFromDB)) {
          // Apply saved product order so it persists across app restarts
          const savedOrder = await window.productSortOrder.get();
          if (savedOrder && savedOrder.length > 0) {
            const orderMap = new Map(savedOrder.map((code, i) => [code, i]));
            const sorted = [...productsFromDB].sort((a, b) => {
              const aIdx = orderMap.get(a.item_code) ?? 1e9;
              const bIdx = orderMap.get(b.item_code) ?? 1e9;
              return aIdx - bIdx;
            });
            setProducts(sorted);
          } else {
            setProducts(productsFromDB);
          }
        } else {
          console.error(
            'Products.getAll() did not return an array:',
            productsFromDB,
          );
          setProducts([]);
        }
      } catch (error) {
        console.error('Failed to fetch products from database:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Save category order when user reorders (debounced to avoid IPC on every drag tick)
  const categorySaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(() => {
    if (categories.length === 0) return;
    if (categorySaveTimeoutRef.current)
      clearTimeout(categorySaveTimeoutRef.current);
    categorySaveTimeoutRef.current = setTimeout(() => {
      categorySaveTimeoutRef.current = null;
      const categoryIds = categories.map((cat) => cat.id);
      window.categorySortOrder
        .save(categoryIds)
        .catch((err) => console.error('Failed to save category order:', err));
    }, 400);
    return () => {
      if (categorySaveTimeoutRef.current)
        clearTimeout(categorySaveTimeoutRef.current);
    };
  }, [categories]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === index) return;

    const newCategories = [...categories];
    const draggedItem = newCategories[draggedIndex];

    newCategories.splice(draggedIndex, 1);
    newCategories.splice(index, 0, draggedItem);

    setCategories(newCategories);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleProductDragStart = (e: React.DragEvent, index: number) => {
    setDraggedProductIndex(index);
    setDragPosition({ x: e.clientX, y: e.clientY });
  };

  const handleProductDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedProductIndex === null || draggedProductIndex === index) return;

    const filtered = products.filter(
      (p) => selectedCategory === 'all' || p.item_group === selectedCategory,
    );
    const draggedProduct = filtered[draggedProductIndex];
    const targetProduct = filtered[index];
    if (!draggedProduct || !targetProduct) return;

    const fullIdxDragged = products.findIndex(
      (p) => p.item_code === draggedProduct.item_code,
    );
    const fullIdxTarget = products.findIndex(
      (p) => p.item_code === targetProduct.item_code,
    );
    if (fullIdxDragged === -1 || fullIdxTarget === -1) return;

    const newProducts = [...products];
    const [removed] = newProducts.splice(fullIdxDragged, 1);
    newProducts.splice(fullIdxTarget, 0, removed);

    setProducts(newProducts);
    setDraggedProductIndex(index);

    window.productSortOrder
      .save(newProducts.map((p) => p.item_code))
      .catch((err) => console.error('Failed to save product order:', err));
  };

  const handleProductDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedProductIndex(null);
    setDragPosition(null);
  };

  const cartRef = useRef(cart);
  cartRef.current = cart;
  const cartScrollRef = useRef<HTMLDivElement>(null);
  const keyboardHandlers = useMemo(
    () => ({
      [KeyboardConfig.clearCart]: () => cartRef.current.clearCart(),
      [KeyboardConfig.showProductList]: () => setListProductsModalVisible(true),
    }),
    [],
  );
  useKeyboardShortcuts(keyboardHandlers);

  // Auto-scroll cart to bottom when items are added or quantities change
  useEffect(() => {
    if (cartScrollRef.current && cart.items.length > 0) {
      cartScrollRef.current.scrollTo({
        top: cartScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [cart.items.length, cart.items.reduce((s, i) => s + i.quantity, 0)]);

  const getFullImageUrl = useCallback(
    (imagePath: string | null | undefined): string => {
      if (!imagePath) return '';
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://'))
        return imagePath;
      const baseUrl = backendUrl.endsWith('/')
        ? backendUrl.slice(0, -1)
        : backendUrl;
      const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
      return `${baseUrl}${path}`;
    },
    [backendUrl],
  );

  const filteredProducts = useMemo(() => {
    const byCategory = products.filter(
      (p) => selectedCategory === 'all' || p.item_group === selectedCategory,
    );
    if (!productSearchQuery.trim()) return byCategory;
    return byCategory.filter((p) =>
      productMatchesRestaurantSearch(p, productSearchQuery),
    );
  }, [products, selectedCategory, productSearchQuery]);

  const handleProductClick = useCallback(
    (product: ProductItem) => {
      const saleItem = productToSaleItem(product, userPriceList, isTaxIncluded);
      cartRef.current.addItem(saleItem);
    },
    [userPriceList, isTaxIncluded],
  );

  const handleProductFavoriteChange = useCallback(
    (itemCode: string, isFavorite: number) => {
      setProducts((prev) =>
        prev.map((p) =>
          p.item_code === itemCode
            ? { ...p, custom_is_favorite: isFavorite }
            : p,
        ),
      );
    },
    [],
  );

  const handleProductCustomize = useCallback((product: ProductItem) => {
    setSelectedProduct(product);
    setAddOnModalVisible(true);
  }, []);

  // Fetch product images for cart items
  useEffect(() => {
    const fetchImages = async () => {
      const imageMap = new Map<string, string>();
      for (const item of cart.items) {
        if (item.productCode && !imageMap.has(item.productCode)) {
          try {
            const product = await window.products.get(item.productCode);
            if (product?.image) {
              const fullUrl = getFullImageUrl(product.image);
              imageMap.set(item.productCode, fullUrl);
            }
          } catch (error) {
            console.error(
              `Failed to fetch product ${item.productCode}:`,
              error,
            );
          }
        }
      }
      setProductImages(imageMap);
    };
    if (cart.items.length > 0) {
      fetchImages();
    } else {
      setProductImages(new Map());
    }
  }, [cart.items, backendUrl]);

  // Load all customers on mount
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoadingCustomers(true);
        const data = await window.customers.getAll();
        console.log(
          `[Restaurant] Loaded ${data.length} customers from local DB:`,
          data.map((c) => c.customer_name || c.name),
        );
        setCustomers(data);

        // Log warning if no customers found
        if (data.length === 0) {
          console.warn(
            '[Restaurant] No customers found in local database. Sync may have failed or backend has no customers.',
          );
        }
      } catch (error) {
        console.error('Error loading customers:', error);
      } finally {
        setLoadingCustomers(false);
      }
    };
    loadCustomers();
  }, []);

  // Select default customer:
  // 1) user-specific customer from sales_person_details (matched by logged user email),
  // 2) fallback to custom_is_default_customer,
  // 3) otherwise leave unselected and UI will show "Cash Customer" placeholder text only.
  useEffect(() => {
    if (cart.selectedCustomer || customers.length === 0) return;

    const configured = resolveConfiguredDefaultCustomerName();
    const normalizedConfigured = configured?.toLowerCase();
    const userDefault = normalizedConfigured
      ? customers.find(
          (c) =>
            c.name?.toLowerCase() === normalizedConfigured ||
            c.customer_name?.toLowerCase() === normalizedConfigured,
        )
      : undefined;

    if (userDefault) {
      cart.setSelectedCustomer(userDefault);
      return;
    }

    const globalDefault = customers.find(
      (c) => c.custom_is_default_customer === 1,
    );
    if (globalDefault) {
      cart.setSelectedCustomer(globalDefault);
    }
  }, [customers, cart, resolveConfiguredDefaultCustomerName]);

  // Filter customers based on search query
  useEffect(() => {
    if (!customerSearchQuery) {
      setFilteredCustomers(customers.slice(0, 10));
      return;
    }

    const query = customerSearchQuery.toLowerCase();
    const filtered = customers.filter((c) => {
      return (
        c.name?.toLowerCase().includes(query) ||
        c.customer_name?.toLowerCase().includes(query) ||
        c.mobile_no?.toLowerCase().includes(query) ||
        c.tax_id?.toLowerCase().includes(query) ||
        c.custom_crn_no?.toLowerCase().includes(query)
      );
    });
    setFilteredCustomers(filtered.slice(0, 10));
  }, [customerSearchQuery, customers]);

  // Reset selected index when filtered customers change
  useEffect(() => {
    setSelectedCustomerIndex(0);
  }, [filteredCustomers]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(event.target as Node) &&
        customerButtonRef.current &&
        !customerButtonRef.current.contains(event.target as Node)
      ) {
        setShowCustomerDropdown(false);
        setCustomerSearchQuery('');
        setDropdownPosition(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showCustomerDropdown) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setShowCustomerDropdown(false);
        setCustomerSearchQuery('');
        setDropdownPosition(null);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (filteredCustomers.length > 0) {
          setSelectedCustomerIndex((prev) =>
            prev < filteredCustomers.length - 1 ? prev + 1 : 0,
          );
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (filteredCustomers.length > 0) {
          setSelectedCustomerIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCustomers.length - 1,
          );
        }
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (
          filteredCustomers.length > 0 &&
          filteredCustomers[selectedCustomerIndex]
        ) {
          handleCustomerSelect(filteredCustomers[selectedCustomerIndex]);
        }
      }
    };

    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCustomerDropdown, filteredCustomers, selectedCustomerIndex]);

  const handleCustomerButtonClick = () => {
    if (customerButtonRef.current) {
      const rect = customerButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 350),
      });
    }
    setShowCustomerDropdown(!showCustomerDropdown);
    setCustomerSearchQuery('');
  };

  const handleCustomerSelect = (customer: Customer) => {
    cart.setSelectedCustomer(customer);
    setShowCustomerDropdown(false);
    setCustomerSearchQuery('');
    setDropdownPosition(null);
  };

  const handleExportExcel = () => {
    if (cart.items.length === 0) return;

    const exportData = cart.items
      .filter((item) => item.productCode && item.productCode.trim() !== '')
      .map((item) => ({
        'Product Code': item.productCode,
        Description: item.description,
        Quantity: item.quantity,
        UOM: item.unit,
        'Unit Price': parseFloat(item.unitPrice.toFixed(2)),
        'Inclusive Price': parseFloat(item.inclusivePrice.toFixed(2)),
        'Line Total': parseFloat(
          (item.inclusivePrice * item.quantity).toFixed(2),
        ),
      }));

    if (exportData.length === 0) return;

    exportToExcel(
      exportData,
      `Restaurant_Order_${new Date().toISOString().split('T')[0]}`,
    );
  };

  const hasValidItems =
    cart.items.filter(
      (item) => item.productCode && item.productCode.trim() !== '',
    ).length > 0;

  const handleHold = async () => {
    if (!hasValidItems) return;
    try {
      const total =
        calculateTotalAmount(cart.items) + cart.charges - cart.discount;
      await saveHeldCart({
        customerName:
          cart.selectedCustomer?.customer_name || 'Walk-in Customer',
        customerCode: cart.selectedCustomer?.name || '',
        items: cart.items,
        charges: cart.charges,
        discount: cart.discount,
        total,
      });
      cart.clearCart();
      toast.success(t('messages.cartHeldSuccessfully'));
    } catch (error) {
      console.error('Failed to hold cart:', error);
      toast.error(t('messages.failedToHoldCart'));
    }
  };

  const handleRestoreHeldCart = (heldCart: HeldCart) => {
    cart.setItems(
      heldCart.items.map((item) => ({
        ...item,
        productCode: item.barcode || '',
      })),
    );
    cart.setCharges(heldCart.charges);
    cart.setDiscount(heldCart.discount);
    if (heldCart.customerCode) {
      cart.setSelectedCustomer({
        name: heldCart.customerCode,
        customer_name: heldCart.customerName,
        mobile_no: '',
        tax_id: '',
      } as any);
    }
    setHoldListModalVisible(false);
    toast.success(t('messages.heldCartRestored'));
  };

  const handleDeleteHeldCart = async (id: string) => {
    try {
      await deleteHeldCart(id);
      toast.success(t('messages.heldCartDeleted'));
    } catch (error) {
      console.error('Failed to delete held cart:', error);
      toast.error(t('messages.failedToDeleteHeldCart'));
    }
  };

  return (
    <>
      <div className="rest">
        {/* Category Sidebar */}
        <aside className="rest-sidebar">
          <div className="rest-sidebar__header">
            <h2>{t('common.categories')}</h2>
          </div>
          <div className="rest-sidebar__list">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rest-cat ${selectedCategory === 'all' ? 'rest-cat--active' : ''}`}
              title={t('common.allItems')}
            >
              <span className="rest-cat__label">{t('common.allItems')}</span>
            </button>
            {categories.map((category, index) => (
              <button
                type="button"
                key={category.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => setSelectedCategory(category.id)}
                className={`rest-cat ${
                  selectedCategory === category.id ? 'rest-cat--active' : ''
                } ${draggedIndex === index ? 'rest-cat--dragging' : ''}`}
                title={category.name}
              >
                <span className="rest-cat__label">{category.name}</span>
              </button>
            ))}
          </div>
          <div className="rest-sidebar__footer">
            <button
              type="button"
              onClick={openRestaurantSettings}
              className="rest-settings-btn"
            >
              <Settings size={18} strokeWidth={2} />
              <span className="rest-settings-btn__label">
                {t('common.settings')}
              </span>
            </button>
          </div>
        </aside>

        <section className="rest-main">
          <header className="rest-main__header">
            <h1 className="rest-main__title">{t('restaurant.title')}</h1>
          </header>
          <div className="rest-main__search">
            <ProductSearch
              onSearch={setProductSearchQuery}
              onProductFound={(product) => {
                const saleItem = productToSaleItem(
                  product,
                  userPriceList,
                  isTaxIncluded,
                );
                cart.addItem(saleItem);
              }}
              onExportExcel={handleExportExcel}
            />
          </div>

          <div className="rest-grid">
            {loading ? (
              <div className="rest-empty">
                <div className="rest-empty__tile">
                  <ShoppingBag size={28} strokeWidth={2} />
                </div>
                <h3>{t('common.loadingProducts')}</h3>
              </div>
            ) : products.length === 0 ? (
              <div className="rest-empty">
                <div className="rest-empty__tile">
                  <ShoppingBag size={28} strokeWidth={2} />
                </div>
                <h3>{t('common.noProductsFound')}</h3>
              </div>
            ) : (
              <VirtualizedProductGrid
                filteredProducts={filteredProducts}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                showProductImages={showProductImages}
                backendUrl={backendUrl}
                userPriceList={userPriceList}
                isTaxIncluded={isTaxIncluded}
                draggedProductIndex={draggedProductIndex}
                onProductClick={handleProductClick}
                onFavoriteChange={handleProductFavoriteChange}
                onCustomize={handleProductCustomize}
                onDragStart={handleProductDragStart}
                onDragOver={handleProductDragOver}
                onDragEnd={handleProductDragEnd}
                onDragMove={(x, y) => setDragPosition({ x, y })}
              />
            )}
          </div>
        </section>

        {/* Cart Sidebar */}
        <aside className="rest-cart">
          <div className="rest-cart__header">
            <h2>{t('common.currentOrder')}</h2>
            <button
              type="button"
              onClick={() => {
                cart.clearCart();
                setEditingOrder(null);
              }}
              className="rest-icon-btn"
              title={t('common.clearCart')}
              aria-label={t('common.clearCart')}
            >
              <Trash2 size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="rest-cart__customer">
            <label>{t('common.customer')}</label>
            <button
              type="button"
              ref={customerButtonRef}
              onClick={handleCustomerButtonClick}
              className={`rest-customer-btn ${showCustomerDropdown ? 'rest-customer-btn--open' : ''}`}
            >
              <span className="rest-customer-btn__name">
                {cart.selectedCustomer?.customer_name ||
                  cart.selectedCustomer?.name ||
                  t('common.cashCustomer')}
              </span>
              <ChevronDown
                size={16}
                strokeWidth={2}
                className="rest-customer-btn__chev"
              />
            </button>
          </div>

          <div ref={cartScrollRef} className="rest-cart__items">
            {cart.items.length > 0 ? (
              cart.items
                .filter(
                  (item) => item.productCode && item.productCode.trim() !== '',
                )
                .map((item, index) => (
                  <RestaurantChekoutCartItem
                    key={item.id}
                    serialNumber={index + 1}
                    title={item.description || item.productCode}
                    titleArabic={item.descriptionArabic}
                    price={item.inclusivePrice}
                    quantity={item.quantity}
                    imageUrl={productImages.get(item.productCode) || ''}
                    showImage={showProductImages}
                    onIncrease={() => {
                      const cartItem = cart.items.find((i) => i.id === item.id);
                      if (cartItem) {
                        cart.updateItemQuantity(item.id, cartItem.quantity + 1);
                      }
                    }}
                    onDecrease={() => {
                      const cartItem = cart.items.find((i) => i.id === item.id);
                      if (cartItem) {
                        cart.updateItemQuantity(
                          item.id,
                          Math.max(1, cartItem.quantity - 1),
                        );
                      }
                    }}
                    onRemove={() => cart.deleteItem(item.id)}
                    onClick={async () => {
                      // Fetch the product and open product info modal for editing
                      try {
                        const product = await window.products.get(
                          item.productCode,
                        );
                        if (product) {
                          setEditingCartItemId(item.id);
                          setSelectedProduct(product);
                          setProductInfoModalVisible(true);
                        }
                      } catch (error) {
                        console.error('Failed to fetch product:', error);
                      }
                    }}
                  />
                ))
            ) : (
              <div className="rest-cart__empty">
                <div className="rest-cart__empty__tile">
                  <ClipboardList size={28} strokeWidth={2} />
                </div>
                <h3>{t('common.noItemsInOrder')}</h3>
              </div>
            )}
          </div>

          {cart.items.length > 0 && (
            <div className="rest-cart__footer">
              <div className="rest-total">
                <span className="rest-total__label">
                  {t('common.totalAmount')}
                </span>
                <span className="rest-total__value">
                  {formatCurrency(
                    calculateTotalAmount(cart.items) +
                      cart.charges -
                      cart.discount,
                  )}
                </span>
              </div>

              <div className="rest-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditingOrder(null);
                    setOrderModalVisible(true);
                  }}
                  disabled={!hasValidItems}
                  className="rest-btn--secondary"
                >
                  <ClipboardList size={16} strokeWidth={2} />
                  {t('buttons.createOrder')}
                </button>
                <button
                  type="button"
                  onClick={() => setOrderHistoryModalVisible(true)}
                  className="rest-btn--secondary"
                >
                  <ListOrdered size={16} strokeWidth={2} />
                  {t('buttons.orderList')}
                </button>
                <button
                  type="button"
                  onClick={handleHold}
                  disabled={!hasValidItems}
                  className="rest-btn--secondary"
                >
                  <PauseCircle size={16} strokeWidth={2} />
                  {t('buttons.hold')}
                </button>
                <button
                  type="button"
                  onClick={() => setHoldListModalVisible(true)}
                  className="rest-btn--secondary"
                >
                  <ListOrdered size={16} strokeWidth={2} />
                  {t('buttons.holdList')}
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceHistoryModalVisible(true)}
                  className="rest-btn--secondary rest-btn--full"
                >
                  <Receipt size={16} strokeWidth={2} />
                  {t('buttons.invoiceHistory')}
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutModalVisible(true)}
                  disabled={!hasValidItems}
                  className="rest-btn--primary rest-btn--full rest-btn--lg"
                >
                  <CreditCard size={18} strokeWidth={2} />
                  {t('buttons.createInvoice')}
                </button>
              </div>
            </div>
          )}
        </aside>
        {/* Product Info Modal for Cart Editing */}
        {productInfoModalVisible && selectedProduct && editingCartItemId && (
          <ProductInfoModal
            product={selectedProduct}
            itemCode={selectedProduct.item_code}
            initialData={(() => {
              const item = cart.items.find((i) => i.id === editingCartItemId);
              if (!item) return undefined;
              return {
                product: selectedProduct,
                quantity: item.quantity,
                unit: item.unit,
                inclusiveTax: item.inclusiveTax,
                inclusivePrice: item.inclusivePrice,
                unitPrice: item.unitPrice,
                totalAmount: item.inclusivePrice * item.quantity,
                discountPercent: item.discountPercent,
                discountAmount: item.discountAmount,
                taxable:
                  (item.inclusivePrice * item.quantity) /
                  (1 + item.taxRate / 100), // Approximate
                taxPercent: item.taxRate,
                taxAmount:
                  (item.inclusivePrice * item.quantity * item.taxRate) /
                  (100 + item.taxRate), // Approximate
                lineTotal: item.inclusivePrice * item.quantity,
                batch: item.batch,
                expiry: item.expiry,
                notes: item.notes,
              };
            })()}
            onClose={() => {
              setProductInfoModalVisible(false);
              setEditingCartItemId(null);
              setSelectedProduct(null);
            }}
            onSave={(data: SalesDetailsData) => {
              // Update cart item with new data. Use lineTotal/quantity so the cart
              // amount reflects the discount (cart uses inclusivePrice * quantity).
              const effectiveInclusivePricePerUnit =
                data.quantity > 0
                  ? data.lineTotal / data.quantity
                  : data.inclusivePrice;
              cart.setItems((prevItems) =>
                prevItems.map((item) => {
                  if (item.id === editingCartItemId) {
                    return {
                      ...item,
                      quantity: data.quantity,
                      unit: data.unit,
                      inclusiveTax: data.inclusiveTax,
                      inclusivePrice: effectiveInclusivePricePerUnit,
                      unitPrice: data.unitPrice,
                      taxRate: data.taxPercent,
                      discountPercent: data.discountPercent,
                      discountAmount: data.discountAmount,
                      batch: data.batch,
                      expiry: data.expiry,
                      notes: data.notes,
                    };
                  }
                  return item;
                }),
              );
            }}
          />
        )}

        {/* Addon Modal for New Items */}
        {addOnModalVisible && selectedProduct && (
          <Portal
            onClose={() => setAddOnModalVisible(false)}
            modalTitle="Item Info"
          >
            <RestaurantItemAddOnModal
              onClose={() => {
                setAddOnModalVisible(false);
                setSelectedProduct(null);
                setEditingCartItemId(null);
              }}
              items={addOnList}
              tags={
                selectedProduct?.custom_item_tag_list
                  ? Array.isArray(selectedProduct.custom_item_tag_list)
                    ? selectedProduct.custom_item_tag_list
                    : typeof selectedProduct.custom_item_tag_list === 'string'
                      ? (() => {
                          try {
                            const parsed = JSON.parse(
                              selectedProduct.custom_item_tag_list,
                            );
                            return Array.isArray(parsed) ? parsed : [];
                          } catch {
                            return [];
                          }
                        })()
                      : []
                  : []
              }
              initialSelectedTags={
                editingCartItemId
                  ? (() => {
                      const cartItem = cart.items.find(
                        (i) => i.id === editingCartItemId,
                      );
                      return cartItem?.selectedTags || [];
                    })()
                  : []
              }
              onConfirm={(selectedAddons, selectedTags) => {
                // Add product to cart with addons and selected tags, or update existing item
                if (selectedProduct) {
                  const saleItem = productToSaleItem(
                    selectedProduct,
                    userPriceList,
                    isTaxIncluded,
                  );
                  const addonsPrice = selectedAddons.reduce(
                    (sum, addon) => sum + addon.price,
                    0,
                  );
                  saleItem.inclusivePrice =
                    saleItem.inclusivePrice + addonsPrice;
                  saleItem.unitPrice = saleItem.unitPrice + addonsPrice;
                  // Store selected tags in the cart item
                  if (selectedTags && selectedTags.length > 0) {
                    saleItem.selectedTags = selectedTags;
                  }

                  // If editing an existing cart item, update it instead of adding new
                  if (editingCartItemId) {
                    const existingItem = cart.items.find(
                      (i) => i.id === editingCartItemId,
                    );
                    if (existingItem) {
                      // Update the existing item with new data
                      const updatedItems = cart.items.map((i) =>
                        i.id === editingCartItemId
                          ? {
                              ...i,
                              ...saleItem,
                              id: editingCartItemId, // Keep the same ID
                              quantity: i.quantity, // Keep the same quantity
                              selectedTags:
                                selectedTags && selectedTags.length > 0
                                  ? selectedTags
                                  : i.selectedTags,
                            }
                          : i,
                      );
                      cart.setItems(updatedItems);
                    }
                    setEditingCartItemId(null);
                  } else {
                    // Adding new item
                    cart.addItem(saleItem);
                  }
                }
                setAddOnModalVisible(false);
                setSelectedProduct(null);
              }}
            />
          </Portal>
        )}
        {settingsModalVisible && (
          <Portal
            onClose={handleCloseRestaurantSettings}
            modalTitle="Restaurant Settings"
          >
            <RestaurantSettingsModal
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              showProductImages={showProductImages}
              onCardWidthChange={handlePreviewCardWidth}
              onCardHeightChange={handlePreviewCardHeight}
              onShowProductImagesChange={setShowProductImages}
              onCancel={handleCloseRestaurantSettings}
              onSave={handleSaveRestaurantUi}
            />
          </Portal>
        )}
        {checkoutModalVisible && (
          <RestaurantCheckoutModal
            onClose={() => setCheckoutModalVisible(false)}
            items={cart.items}
            charges={cart.charges}
            discount={cart.discount}
            total={
              calculateTotalAmount(cart.items) + cart.charges - cart.discount
            }
            customerName={
              cart.selectedCustomer?.customer_name ||
              cart.selectedCustomer?.name ||
              'Cash Customer'
            }
            customerCode={cart.selectedCustomer?.name || ''}
            onComplete={(data) => {
              // Clear cart after successful order/invoice creation
              cart.clearCart();
              setCheckoutModalVisible(false);
            }}
            showNumericKeypad={true}
            isTaxIncluded={isTaxIncluded}
          />
        )}
        {orderModalVisible && (
          <RestaurantOrderModal
            onClose={() => {
              setOrderModalVisible(false);
              setEditingOrder(null);
            }}
            items={cart.items}
            existingOrder={editingOrder}
            customerName={
              cart.selectedCustomer?.customer_name ||
              cart.selectedCustomer?.name ||
              'Cash Customer'
            }
            customerCode={cart.selectedCustomer?.name || ''}
            onComplete={async (orderName) => {
              setOrderModalVisible(false);
              const wasUpdate = Boolean(editingOrder);
              setEditingOrder(null);
              if (wasUpdate && orderName) {
                // User clicked "Update Order": load the order into the cart
                try {
                  const fullOrder = await getSalesOrder(orderName);
                  console.log(
                    '[RestaurantScreen] after Update Order: get_sales_order response',
                    {
                      orderName,
                      items_count: fullOrder?.items?.length ?? 0,
                      total: fullOrder?.grand_total ?? fullOrder?.total,
                    },
                  );
                  if (fullOrder) {
                    await cart.clearCart();
                    if (fullOrder.items?.length) {
                      const saleItems = fullOrder.items.map((item, idx) => ({
                        id:
                          item.name ||
                          `${fullOrder.name}-${item.item_code}-${idx}`,
                        productCode: item.item_code,
                        quantity: item.qty,
                        barcode: item.item_code,
                        description:
                          item.description || item.item_name || item.item_code,
                        unit: item.uom || '',
                        inclusiveTax: isTaxIncluded,
                        inclusivePrice: item.rate,
                        unitPrice: item.rate,
                        taxRate: 0,
                        discountPercent: 0,
                        discountAmount: 0,
                        availableUoms: [],
                        prices: [],
                      }));
                      cart.setItems(saleItems);
                      const cartTotal = saleItems.reduce(
                        (s, i) => s + i.inclusivePrice * i.quantity,
                        0,
                      );
                      console.log('[RestaurantScreen] cart loaded from order', {
                        saleItems_count: saleItems.length,
                        cartTotal,
                      });
                    }
                    if (fullOrder.customer) {
                      cart.setSelectedCustomer({
                        name: fullOrder.customer,
                        customer_name:
                          fullOrder.customer_name || fullOrder.customer,
                        mobile_no: '',
                        tax_id: '',
                      } as Customer);
                    }
                  }
                } catch (err) {
                  console.error(
                    'Error loading order into cart after update:',
                    err,
                  );
                }
              } else {
                // Create order: clear cart
                cart.clearCart();
              }
            }}
            isTaxIncluded={isTaxIncluded}
          />
        )}
        {orderHistoryModalVisible && (
          <RestaurantOrderHistoryModal
            onClose={() => setOrderHistoryModalVisible(false)}
            onSelectOrder={async (order) => {
              setOrderHistoryModalVisible(false);
              try {
                // Fetch full order for the modal; do NOT load into cart until user clicks "Update Order"
                const fullOrder = await getSalesOrder(order.name);
                const orderToLoad = fullOrder || order;
                setEditingOrder(orderToLoad);
                setOrderModalVisible(true);
              } catch (err) {
                console.error('Error loading order for edit:', err);
                alert('Failed to load order. Please try again.');
              }
            }}
          />
        )}
        {invoiceHistoryModalVisible && (
          <RestaurantInvoiceHistoryModal
            onClose={() => setInvoiceHistoryModalVisible(false)}
          />
        )}

        {holdListModalVisible && (
          <Portal
            onClose={() => setHoldListModalVisible(false)}
            modalTitle="Hold List"
          >
            <HoldListModal
              onClose={() => setHoldListModalVisible(false)}
              onSelect={handleRestoreHeldCart}
              onDelete={handleDeleteHeldCart}
            />
          </Portal>
        )}

        {/* List Products Modal */}
        {listProductsModalVisible && (
          <Portal
            onClose={() => setListProductsModalVisible(false)}
            modalTitle="Products"
          >
            <ListProductsModal
              onSelect={(product) => {
                const saleItem = productToSaleItem(
                  product,
                  userPriceList,
                  isTaxIncluded,
                );
                cart.addItem(saleItem);
                setListProductsModalVisible(false);
              }}
              onProductInfo={(product) => {
                setSelectedProduct(product);
                setListProductsModalVisible(false);
              }}
              onEdit={(product) => {
                setEditProduct(product);
              }}
              onClose={() => setListProductsModalVisible(false)}
            />
          </Portal>
        )}

        {/* Edit Product Modal */}
        {editProduct && (
          <EditProductModal
            product={editProduct}
            onClose={() => setEditProduct(null)}
            onSaved={() => setEditProduct(null)}
          />
        )}

        {/* Customer Dropdown Portal */}
        {showCustomerDropdown &&
          dropdownPosition &&
          ReactDOM.createPortal(
            <div
              ref={customerDropdownRef}
              style={{
                position: 'absolute',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`,
                zIndex: 9999,
              }}
              className="rest-cdrop"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rest-cdrop__search">
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder={t('common.searchCustomers')}
                  autoFocus
                />
              </div>
              <div className="rest-cdrop__list">
                {loadingCustomers ? (
                  <div className="rest-cdrop__hint">
                    {t('common.loadingCustomers')}
                  </div>
                ) : filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer, index) => (
                    <div
                      key={customer.name}
                      className={`rest-customer-row ${
                        index === selectedCustomerIndex
                          ? 'rest-customer-row--active'
                          : ''
                      }`}
                      onClick={() => handleCustomerSelect(customer)}
                      onMouseEnter={() => setSelectedCustomerIndex(index)}
                    >
                      <div className="rest-customer-row__name">
                        {customer.customer_name || customer.name}
                      </div>
                      {customer.mobile_no && (
                        <div className="rest-customer-row__sub">
                          <Phone size={12} strokeWidth={2} />
                          {customer.mobile_no}
                        </div>
                      )}
                      {customer.customer_group && (
                        <span className="rest-customer-row__tag">
                          {customer.customer_group}
                        </span>
                      )}
                    </div>
                  ))
                ) : customerSearchQuery ? (
                  <div className="rest-cdrop__hint">
                    {t('common.noCustomersMatching')} &quot;{customerSearchQuery}&quot;
                  </div>
                ) : (
                  <div className="rest-cdrop__hint">
                    {t('common.startTyping')}
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
      <OnScreenKeyboard
        mode="restaurant"
        settingsEnabled={onScreenKeyboardEnabled}
      />
    </>
  );
}

const RestaurantWithProvider: React.FC = () => {
  return (
    <CustomerTypeProvider>
      <Restaurant />
    </CustomerTypeProvider>
  );
};

export default RestaurantWithProvider;
