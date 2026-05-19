export interface HeldCart {
  id: string;
  customerName: string;
  customerCode: string;
  items: Array<{
    id: string;
    quantity: number;
    barcode: string;
    description: string;
    unit: string;
    inclusiveTax: boolean;
    inclusivePrice: number;
    unitPrice: number;
  }>;
  charges: number;
  discount: number;
  total: number;
  heldAt: string;
  heldBy?: string;
}

export interface HeldCartParams {
  limit_start?: number;
  limit_page_length?: number;
}

const STORAGE_KEY = 'held_carts';

export async function saveHeldCart(cart: Omit<HeldCart, 'id' | 'heldAt'>): Promise<HeldCart> {
  try {
    const heldCart: HeldCart = {
      ...cart,
      id: `HOLD-${Date.now()}`,
      heldAt: new Date().toISOString(),
    };

    const existingCarts = await getHeldCarts({});
    const updatedCarts = [heldCart, ...existingCarts];

    if (window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCarts));
    }

    return heldCart;
  } catch (error) {
    console.error('Error saving held cart:', error);
    throw error;
  }
}

export async function getHeldCarts(params: HeldCartParams): Promise<HeldCart[]> {
  try {
    if (!window.localStorage) {
      return [];
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const carts: HeldCart[] = JSON.parse(stored);
    
    const start = params.limit_start || 0;
    const limit = params.limit_page_length || 50;
    
    return carts.slice(start, start + limit);
  } catch (error) {
    console.error('Error fetching held carts:', error);
    return [];
  }
}

export async function deleteHeldCart(id: string): Promise<void> {
  try {
    const existingCarts = await getHeldCarts({});
    const updatedCarts = existingCarts.filter(cart => cart.id !== id);

    if (window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCarts));
    }
  } catch (error) {
    console.error('Error deleting held cart:', error);
    throw error;
  }
}

export async function getHeldCart(id: string): Promise<HeldCart | null> {
  try {
    const carts = await getHeldCarts({});
    return carts.find(cart => cart.id === id) || null;
  } catch (error) {
    console.error('Error fetching held cart:', error);
    return null;
  }
}
