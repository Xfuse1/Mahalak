import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type CartItem = {
  id: string
  name: string
  price: number
  category?: string
  image_url?: string | null
  store_id?: string
  store_name?: string
  description?: string
  quantity: number
}

type CartItemInput = Omit<CartItem, "quantity">

type CartState = {
  items: CartItem[]
  addItem: (item: CartItemInput) => void
  decrementItem: (id: string) => void
  removeItem: (id: string) => void
  clear: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((entry) => entry.id === item.id)
          if (existing) {
            return {
              items: state.items.map((entry) =>
                entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
              ),
            }
          }
          return { items: [...state.items, { ...item, quantity: 1 }] }
        }),
      decrementItem: (id) =>
        set((state) => {
          const existing = state.items.find((entry) => entry.id === id)
          if (!existing) return state
          if (existing.quantity <= 1) {
            return { items: state.items.filter((entry) => entry.id !== id) }
          }
          return {
            items: state.items.map((entry) =>
              entry.id === id ? { ...entry, quantity: entry.quantity - 1 } : entry,
            ),
          }
        }),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((entry) => entry.id !== id),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "mahalak-cart",
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
