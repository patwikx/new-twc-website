"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ShiftType, POSTableStatus, POSOrderStatus, MenuCategory } from "@prisma/client";

// Types
export interface ActiveShift {
  id: string;
  outletId: string;
  outletName: string;
  cashierId: string;
  cashierName: string;
  type: ShiftType;
  startingCash: number;
  openedAt: Date;
}

export interface SelectedTable {
  id: string;
  number: string;
  capacity: number;
  status: POSTableStatus;
}

export interface Customer {
  type: "WALKIN" | "HOTEL_GUEST";
  name: string;
  phone?: string;
  // For hotel guests
  bookingId?: string;
  bookingRef?: string;
  roomNumber?: string;
  guestId?: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemCategory: MenuCategory;
  quantity: number;
  unitPrice: number;
  modifiers?: string;
  notes?: string;
  status: string;
}

export interface ActiveOrder {
  id: string;
  orderNumber: string;
  status: POSOrderStatus;
  tableId: string | null;
  tableName: string | null;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  total: number;
}

export interface AppliedDiscount {
  id: string;
  discountTypeId: string;
  discountTypeName: string;
  percentage: number;
  amount: number;
  idNumber?: string;
}

interface POSState {
  // Shift
  activeShift: ActiveShift | null;
  
  // Table & Order
  selectedTable: SelectedTable | null;
  customer: Customer | null;
  activeOrder: ActiveOrder | null;
  
  // Cart for building orders (before sending to backend)
  cartItems: Omit<OrderItem, "id" | "status">[];
  
  // Applied discounts
  appliedDiscounts: AppliedDiscount[];
  
  // UI State
  isCustomerDialogOpen: boolean;
  isPaymentDialogOpen: boolean;
  isDiscountDialogOpen: boolean;
  isVoidDialogOpen: boolean;
  
  // Actions - Shift
  setShift: (shift: ActiveShift | null) => void;
  clearShift: () => void;
  
  // Actions - Table
  selectTable: (table: SelectedTable | null) => void;
  clearTable: () => void;
  
  // Actions - Customer
  assignCustomer: (customer: Customer) => void;
  clearCustomer: () => void;
  
  // Actions - Order
  setActiveOrder: (order: ActiveOrder | null) => void;
  clearActiveOrder: () => void;
  
  // Actions - Cart
  addToCart: (item: Omit<OrderItem, "id" | "status">) => void;
  updateCartItemQuantity: (menuItemId: string, quantity: number) => void;
  removeFromCart: (menuItemId: string) => void;
  clearCart: () => void;
  
  // Actions - Discounts
  addDiscount: (discount: AppliedDiscount) => void;
  removeDiscount: (discountId: string) => void;
  clearDiscounts: () => void;
  
  // Actions - UI
  setCustomerDialogOpen: (open: boolean) => void;
  setPaymentDialogOpen: (open: boolean) => void;
  setDiscountDialogOpen: (open: boolean) => void;
  setVoidDialogOpen: (open: boolean) => void;
  
  // Actions - Reset
  resetTransaction: () => void;
  resetAll: () => void;
}

const initialState = {
  activeShift: null,
  selectedTable: null,
  customer: null,
  activeOrder: null,
  cartItems: [],
  appliedDiscounts: [],
  isCustomerDialogOpen: false,
  isPaymentDialogOpen: false,
  isDiscountDialogOpen: false,
  isVoidDialogOpen: false,
};

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Shift Actions
      setShift: (shift) => set({ activeShift: shift }),
      clearShift: () => set({ activeShift: null }),
      
      // Table Actions
      selectTable: (table) => set({ selectedTable: table }),
      clearTable: () => set({ selectedTable: null }),
      
      // Customer Actions
      assignCustomer: (customer) => set({ customer }),
      clearCustomer: () => set({ customer: null }),
      
      // Order Actions
      setActiveOrder: (order) => set({ activeOrder: order }),
      clearActiveOrder: () => set({ activeOrder: null }),
      
      // Cart Actions
      addToCart: (item) => {
        const { cartItems } = get();
        const existingIndex = cartItems.findIndex(
          (i) => i.menuItemId === item.menuItemId && i.modifiers === item.modifiers
        );
        
        if (existingIndex >= 0) {
          // Update quantity if same item
          const updated = [...cartItems];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + item.quantity,
          };
          set({ cartItems: updated });
        } else {
          // Add new item
          set({ cartItems: [...cartItems, item] });
        }
      },
      
      updateCartItemQuantity: (menuItemId, quantity) => {
        const { cartItems } = get();
        if (quantity <= 0) {
          set({ cartItems: cartItems.filter((i) => i.menuItemId !== menuItemId) });
        } else {
          set({
            cartItems: cartItems.map((i) =>
              i.menuItemId === menuItemId ? { ...i, quantity } : i
            ),
          });
        }
      },
      
      removeFromCart: (menuItemId) => {
        const { cartItems } = get();
        set({ cartItems: cartItems.filter((i) => i.menuItemId !== menuItemId) });
      },
      
      clearCart: () => set({ cartItems: [] }),
      
      // Discount Actions
      addDiscount: (discount) => {
        const { appliedDiscounts } = get();
        set({ appliedDiscounts: [...appliedDiscounts, discount] });
      },
      
      removeDiscount: (discountId) => {
        const { appliedDiscounts } = get();
        set({
          appliedDiscounts: appliedDiscounts.filter((d) => d.id !== discountId),
        });
      },
      
      clearDiscounts: () => set({ appliedDiscounts: [] }),
      
      // UI Actions
      setCustomerDialogOpen: (open) => set({ isCustomerDialogOpen: open }),
      setPaymentDialogOpen: (open) => set({ isPaymentDialogOpen: open }),
      setDiscountDialogOpen: (open) => set({ isDiscountDialogOpen: open }),
      setVoidDialogOpen: (open) => set({ isVoidDialogOpen: open }),
      
      // Reset Actions
      resetTransaction: () =>
        set({
          selectedTable: null,
          customer: null,
          activeOrder: null,
          cartItems: [],
          appliedDiscounts: [],
          isCustomerDialogOpen: false,
          isPaymentDialogOpen: false,
          isDiscountDialogOpen: false,
          isVoidDialogOpen: false,
        }),
      
      resetAll: () => set(initialState),
    }),
    {
      name: "pos-store",
      // Only persist shift info (not transaction data)
      partialize: (state) => ({ activeShift: state.activeShift }),
    }
  )
);

// Computed selectors
export const useCartTotal = () => {
  const cartItems = usePOSStore((state) => state.cartItems);
  return cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
};

export const useCartItemCount = () => {
  const cartItems = usePOSStore((state) => state.cartItems);
  return cartItems.reduce((count, item) => count + item.quantity, 0);
};

export const useHasActiveShift = () => {
  const activeShift = usePOSStore((state) => state.activeShift);
  return activeShift !== null;
};
