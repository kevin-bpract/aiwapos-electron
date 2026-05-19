/**
 * Restaurant-owned cart hook. Separate from hooks/useCart (used by Sales/Supermarket)
 * so changes to sales/supermarket cart do not affect restaurant.
 */
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { SaleItem } from '../../../types/saleItem';
import type { Customer } from '../../../types/customer';
import { createEmptyRow } from '../lib/pricing';

export const useRestaurantCart = () => {
  const [currentCartId, setCurrentCartId] = useState<number | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [charges, setCharges] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  useEffect(() => {
    const loadCart = async () => {
      try {
        const cart = await window.cart.getCurrent();
        if (cart) {
          setCurrentCartId(cart.id);
          const loadedItems = cart.items.map((item: Record<string, unknown>) => ({
            id: item.id as string,
            productCode: (item.product_code as string) || '',
            quantity: (item.quantity as number) || 1,
            barcode: (item.barcode as string) || '',
            description: (item.description as string) || '',
            descriptionArabic: (item.description_arabic as string) || undefined,
            unit: (item.unit as string) || '',
            inclusiveTax: Boolean(item.inclusive_tax),
            inclusivePrice: (item.inclusive_price as number) || 0,
            unitPrice: (item.unit_price as number) || 0,
            taxRate: (item.tax_rate as number) || 0,
            discountPercent: (item.discount_percent as number) || 0,
            discountAmount: (item.discount_amount as number) || 0,
            batch: (item.batch as string) || '',
            expiry: (item.expiry as string) || '',
            notes: (item.notes as string) || '',
            availableUoms: item.available_uoms
              ? (JSON.parse(item.available_uoms as string) as SaleItem['availableUoms'])
              : [],
            prices: item.prices ? (JSON.parse(item.prices as string) as SaleItem['prices']) : [],
            maxDiscountPercent: item.max_discount_percent as number | undefined,
            maxDiscountAmount: item.max_discount_amount as number | undefined,
          }));
          if (loadedItems.length === 0) {
            loadedItems.push(createEmptyRow());
          }
          setItems(loadedItems);
          setCharges((cart.charges as number) || 0);
          setDiscount((cart.discount as number) || 0);
          setDiscountPercent((cart.discount_percent as number) || 0);
          if (cart.customer_code) {
            setSelectedCustomer({
              name: cart.customer_code as string,
              customer_name: (cart.customer_name as string) || '',
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
      }
    };
    loadCart();
  }, []);

  // Debounce cart save to avoid blocking UI on every add/quantity change
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isClearing) return;

    const hasValidItems = items.some(
      (item) => item.productCode && item.productCode.trim() !== '',
    );
    if (!hasValidItems && !currentCartId) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      saveTimeoutRef.current = null;
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
    }, 300);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [items, charges, discount, discountPercent, selectedCustomer, currentCartId, isClearing]);

  const clearCart = async () => {
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

    setTimeout(() => setIsClearing(false), 100);
  };

  const deleteItem = async (id: string) => {
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
          (i) => i.productCode === item.productCode && i.unit === item.unit,
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

      const emptyRowIndex = prevItems.findIndex(
        (i) => !i.productCode || i.productCode.trim() === '',
      );
      if (emptyRowIndex !== -1) {
        const updatedItems = [...prevItems];
        updatedItems[emptyRowIndex] = item;
        return updatedItems;
      }

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
    setItems(
      items.map((item) => (item.id === id ? { ...item, quantity } : item)),
    );
  };

  return {
    currentCartId,
    items,
    charges,
    discount,
    discountPercent,
    selectedCustomer,
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
  };
};
