import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { SaleItem } from '../types/saleItem';
import type { Customer } from '../types/customer';
import { createEmptyRow } from '../utils/pricing';

interface CartData {
  items: SaleItem[];
  charges: number;
  discount: number;
  discountPercent: number;
  selectedCustomer: Customer | null;
}

export const useCart = () => {
  const [currentCartId, setCurrentCartId] = useState<number | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [charges, setCharges] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isCartLoaded, setIsCartLoaded] = useState<boolean>(false);

  useEffect(() => {
    const loadCart = async () => {
      try {
        const cart = await window.cart.getCurrent();
        if (cart) {
          setCurrentCartId(cart.id);
          const loadedItems = cart.items.map((item: any) => ({
            id: item.id,
            productCode: item.product_code,
            quantity: item.quantity,
            barcode: item.barcode,
            description: item.description,
            descriptionArabic: item.description_arabic || undefined,
            unit: item.unit,
            inclusiveTax: Boolean(item.inclusive_tax),
            inclusivePrice: item.inclusive_price,
            unitPrice: item.unit_price,
            taxRate: item.tax_rate,
            discountPercent: item.discount_percent,
            discountAmount: item.discount_amount,
            batch: item.batch,
            expiry: item.expiry,
            notes: item.notes,
            availableUoms: item.available_uoms ? JSON.parse(item.available_uoms) : [],
            prices: item.prices ? JSON.parse(item.prices) : [],
            maxDiscountPercent: item.max_discount_percent,
            maxDiscountAmount: item.max_discount_amount,
          }));
          if (loadedItems.length === 0) {
            loadedItems.push(createEmptyRow());
          }
          setItems(loadedItems);
          setCharges(cart.charges || 0);
          setDiscount(cart.discount || 0);
          setDiscountPercent(cart.discount_percent || 0);
          if (cart.customer_code) {
            setSelectedCustomer({
              name: cart.customer_code,
              customer_name: cart.customer_name || '',
              mobile_no: '',
              tax_id: '',
            } as Customer);
          }
        } else {
          setItems([createEmptyRow()]);
        }
      } catch (error) {
        console.error('Error loading cart:', error);
        setItems([createEmptyRow()]);
      } finally {
        setIsCartLoaded(true);
      }
    };
    loadCart();
  }, []);

  useEffect(() => {
    // Skip auto-save during clear operation
    if (isClearing) return;

    const hasValidItems = items.some(
      (item) => item.productCode && item.productCode.trim() !== '',
    );
    if (!hasValidItems && !currentCartId) return;

    // Debounce: wait 500ms after last change before saving to reduce I/O pressure
    const timer = setTimeout(async () => {
      try {
        const validItems = items.filter(
          (item) => item.productCode && item.productCode.trim() !== '',
        );

        const total =
          validItems.reduce(
            (sum, item) => sum + item.inclusivePrice * item.quantity,
            0,
          ) +
          charges -
          discount;

        const cartData = {
          id: currentCartId || undefined,
          customer_code: selectedCustomer?.name || null,
          customer_name: selectedCustomer?.customer_name || null,
          items: validItems.map((item) => ({
            id: item.id,
            product_code: item.productCode,
            quantity: item.quantity,
            barcode: item.barcode,
            description: item.description,
            description_arabic: item.descriptionArabic ?? null,
            unit: item.unit,
            inclusive_tax: item.inclusiveTax ? 1 : 0,
            inclusive_price: item.inclusivePrice,
            unit_price: item.unitPrice,
            tax_rate: item.taxRate || 0,
            discount_percent: item.discountPercent || 0,
            discount_amount: item.discountAmount || 0,
            batch: item.batch,
            expiry: item.expiry,
            notes: item.notes,
            available_uoms: item.availableUoms ? JSON.stringify(item.availableUoms) : null,
            prices: item.prices ? JSON.stringify(item.prices) : null,
            max_discount_percent: item.maxDiscountPercent,
            max_discount_amount: item.maxDiscountAmount,
          })),
          charges,
          discount,
          discount_percent: discountPercent,
          total,
        };

        const cartId = await window.cart.save(cartData);
        if (!currentCartId) {
          setCurrentCartId(cartId);
        }
      } catch (error) {
        console.error('Error saving cart:', error);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [items, charges, discount, discountPercent, selectedCustomer, currentCartId, isClearing]);

  const clearCart = async () => {
    // Set clearing flag to prevent auto-save during clear
    setIsClearing(true);

    if (currentCartId) {
      try {
        await window.cart.delete(currentCartId);
      } catch (error) {
        console.error('Error clearing cart:', error);
      }
    }

    setCurrentCartId(null);
    setItems([createEmptyRow()]);
    setCharges(0);
    setDiscount(0);
    setDiscountPercent(0);
    setSelectedCustomer(null);

    // Delay clearing flag to ensure state updates complete
    setTimeout(() => setIsClearing(false), 100);
  };

  const deleteItem = async (id: string) => {
    // We don't need to call window.cart.deleteItem because saveCart (triggered by useEffect)
    // will replace all items in the DB with the updated list from local state.

    setItems((prevItems) => {
      const filtered = prevItems.filter((item) => item.id !== id);
      if (filtered.length === 0) {
        return [createEmptyRow()];
      }
      return filtered;
    });
  };

  /* Cart Behavior - use ref to avoid stale closure in addItem */
  const cartBehaviorRef = useRef<'increment' | 'new_line'>('increment');
  const [cartBehavior, setCartBehavior] = useState<'increment' | 'new_line'>('increment');

  // Load local config for cart behavior and listen for runtime changes
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const val = await window.app_config.get('cart_item_behavior');
        const behavior = val === 'new_line' ? 'new_line' : 'increment';
        cartBehaviorRef.current = behavior;
        setCartBehavior(behavior);
      } catch (err) {
        console.error('Error loading cart behavior config', err);
      }
    };
    loadConfig();

    const handleBehaviorChange = (e: Event) => {
      const behavior = (e as CustomEvent<{ behavior: 'increment' | 'new_line' }>).detail.behavior;
      cartBehaviorRef.current = behavior;
      setCartBehavior(behavior);
    };
    window.addEventListener('cart_behavior_changed', handleBehaviorChange);
    return () => window.removeEventListener('cart_behavior_changed', handleBehaviorChange);
  }, []);

  const addItem = (item: SaleItem) => {
    setItems((prevItems) => {
      // 1. If behavior is 'increment', Check if item already exists with same productCode AND unit
      if (cartBehaviorRef.current === 'increment') {
        const existingItemIndex = prevItems.findIndex(
          (i) => i.productCode === item.productCode && i.unit === item.unit
        );

        if (existingItemIndex !== -1) {
          const updatedItems = [...prevItems];
          const existingItem = updatedItems[existingItemIndex];
          updatedItems[existingItemIndex] = {
            ...existingItem,
            quantity: existingItem.quantity + item.quantity,
          };
          const label =
            existingItem.description || existingItem.productCode || 'Item';
          queueMicrotask(() => {
            toast.info('Already in cart', {
              description: `${label} · qty +${item.quantity} (now ${existingItem.quantity + item.quantity})`,
              duration: 2800,
            });
          });
          return updatedItems;
        }
      }

      // 2. Check for an empty row to replace (one with no productCode)
      const emptyRowIndex = prevItems.findIndex((i) => !i.productCode || i.productCode.trim() === '');
      if (emptyRowIndex !== -1) {
        const updatedItems = [...prevItems];
        updatedItems[emptyRowIndex] = item;
        return updatedItems;
      }

      // 3. Otherwise, append the new item
      const dupLine =
        cartBehaviorRef.current === 'new_line' &&
        item.productCode &&
        prevItems.some(
          (i) =>
            i.productCode === item.productCode &&
            (i.unit || '') === (item.unit || ''),
        );
      if (dupLine) {
        const label = item.description || item.productCode;
        queueMicrotask(() => {
          toast.info('Already in cart', {
            description: `${label} · added as new line`,
            duration: 2800,
          });
        });
      }
      return [...prevItems, item];
    });
  };

  const addEmptyRow = () => {
    setItems((prevItems) => [...prevItems, createEmptyRow()]);
  };

  const updateItemQuantity = (id: string, quantity: number) => {
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, quantity } : item)),
    );
  };

  return {
    currentCartId,
    items,
    charges,
    discount,
    discountPercent,
    selectedCustomer,
    isCartLoaded,
    setItems,
    setCharges,
    setDiscount,
    setDiscountPercent,
    setSelectedCustomer,
    clearCart,
    deleteItem,
    addItem,
    addEmptyRow,
    updateItemQuantity,
    cartBehavior,
  };
};
