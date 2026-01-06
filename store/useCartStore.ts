import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from "sonner";

// Cart item now stores all necessary details to avoid database lookups
export interface CartItem {
  id: string; // Unique cart item ID
  propertySlug: string;
  propertyName: string;
  propertyImage: string;
  roomId: string;
  roomName: string;
  roomImage: string;
  roomPrice: number;
  checkIn: Date | string; // Date or ISO string for persistence
  checkOut: Date | string;
  guests: number;
}

// Simplified types for cart item creation
export interface AddToCartPayload {
  propertySlug: string;
  propertyName: string;
  propertyImage: string;
  roomId: string;
  roomName: string;
  roomImage: string;
  roomPrice: number;
  checkIn: Date;
  checkOut: Date;
  guests: number;
}

interface CartStore {
  items: CartItem[];
  addToCart: (item: AddToCartPayload) => void;
  removeFromCart: (id: string) => void;
  updateItem: (id: string, updates: Partial<Pick<CartItem, 'checkIn' | 'checkOut' | 'guests'>>) => void;
  clearCart: () => void;
  getCartSubtotal: () => number;
  itemCount: number;
  isDrawerOpen: boolean;
  setDrawerOpen: (isOpen: boolean) => void;
  toggleDrawer: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,
      
      addToCart: (item) => {
        const { items } = get();
        const existingItem = items.find(
          (i) =>
            i.propertySlug === item.propertySlug &&
            i.roomId === item.roomId &&
            new Date(i.checkIn).getTime() === new Date(item.checkIn).getTime() &&
            new Date(i.checkOut).getTime() === new Date(item.checkOut).getTime()
        );

        if (existingItem) {
          toast.info("This room is already in your reservation.", {
            description: "Opening reservation drawer...",
          });
          set({ isDrawerOpen: true });
          return;
        }

        const newItem: CartItem = {
          ...item,
          id: `${item.propertySlug}-${item.roomId}-${Date.now()}`,
        };
        set((state) => ({ items: [...state.items, newItem] }));
        toast.success("Room added to reservation.", {
           description: "View your stay in the drawer.",
           action: {
             label: "View",
             onClick: () => set({ isDrawerOpen: true }),
           },
        });
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

      getCartSubtotal: () => {
        const { items } = get();
        return items.reduce((total, item) => {
          const start = typeof item.checkIn === 'string' ? new Date(item.checkIn) : new Date(item.checkIn);
          const end = typeof item.checkOut === 'string' ? new Date(item.checkOut) : new Date(item.checkOut);
          // Normalize dates to midnight for consistent nights calculation
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
          return total + item.roomPrice * nights;
        }, 0);
      },

      setDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

      get itemCount() {
        return get().items.length;
      }
    }),
    {
      name: 'twc-cart-storage',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ items: state.items }), // Only persist items, not UI state
    }
  )
);

