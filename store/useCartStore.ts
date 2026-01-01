import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PROPERTIES, Room, Property } from "@/lib/mock-data";
import { differenceInDays } from "date-fns";
import { toast } from "sonner";

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
