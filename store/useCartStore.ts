import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PROPERTIES, Room, Property } from "@/lib/mock-data";
import { differenceInDays } from "date-fns";

export interface CartItem {
  id: string; // Unique cart item ID
  propertySlug: string;
  roomId: string;
  checkIn: Date | string; // Date or ISO string for persistence
  checkOut: Date | string;
  guests: number;
}

interface CartStore {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "id">) => void;
  removeFromCart: (id: string) => void;
  updateItem: (id: string, updates: Partial<Omit<CartItem, "id">>) => void;
  clearCart: () => void;
  getItemDetails: (item: CartItem) => { property: Property; room: Room } | null;
  getCartSubtotal: () => number;
  itemCount: number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      
      addToCart: (item) => {
        const newItem: CartItem = {
          ...item,
          id: `${item.propertySlug}-${item.roomId}-${Date.now()}`,
        };
        set((state) => ({ items: [...state.items, newItem] }));
      },

      removeFromCart: (id) => {
        set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
      },

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      getItemDetails: (item) => {
        const property = PROPERTIES.find((p) => p.slug === item.propertySlug);
        if (!property) return null;
        const room = property.rooms.find((r) => r.id === item.roomId);
        if (!room) return null;
        return { property, room };
      },

      getCartSubtotal: () => {
        const { items, getItemDetails } = get();
        return items.reduce((total, item) => {
          const details = getItemDetails(item);
          if (!details) return total;
          
          const start = typeof item.checkIn === 'string' ? new Date(item.checkIn) : item.checkIn;
          const end = typeof item.checkOut === 'string' ? new Date(item.checkOut) : item.checkOut;
          
          const nights = Math.max(1, differenceInDays(end, start));
          return total + details.room.price * nights;
        }, 0);
      },

      get itemCount() {
        return get().items.length;
      }
    }),
    {
      name: 'twc-cart-storage',
      storage: createJSONStorage(() => localStorage),
      // Handle date deserialization if needed, but strings work fine for simple recreation
      skipHydration: true, 
    }
  )
);
