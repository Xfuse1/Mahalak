import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { legacyUrlToKey } from "@/lib/storage/legacy-url"

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
  stock: number
  discount_percentage?: number
}

type CartItemInput = Omit<CartItem, "quantity">

type CartState = {
  items: CartItem[]
  addItem: (item: CartItemInput) => void
  decrementItem: (id: string) => void
  removeItem: (id: string) => void
  clear: () => void
  syncPrices: (pricing: Record<string, { price: number; discount_percentage: number }>) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((entry) => entry.id === item.id)
          if (existing) {
            // لا تتجاوز الكمية المتاحة في المخزون
            if (existing.quantity >= existing.stock) {
              return state
            }
            return {
              items: state.items.map((entry) =>
                entry.id === item.id ? { ...entry, quantity: entry.quantity + 1, stock: item.stock } : entry,
              ),
            }
          }
          // لا تسمح بإضافة منتج غير متوفر
          if (item.stock <= 0) {
            return state
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
      // مواءمة أسعار/خصومات العربة مع القيم الحالية من الخادم (لقطة العربة قد تتقادم)
      syncPrices: (pricing) =>
        set((state) => ({
          items: state.items.map((item) => {
            const fresh = pricing[item.id]
            if (!fresh) return item
            return { ...item, price: fresh.price, discount_percentage: fresh.discount_percentage }
          }),
        })),
    }),
    {
      name: "mahalak-cart",
      storage: createJSONStorage(() => localStorage),
      // السلال المحفوظة تعيش في متصفح المستخدم — لا يصلها أي backfill سيرفر‑سايد. السلال
      // القديمة تحمل روابط Supabase مطلقة تتوقف يوم يختفي ذلك المشروع (وهو خارج سيطرتنا).
      // نحوّلها هنا إلى مسارات لتُقدَّم من التخزين الحالي. غير المطابق يُترك كما هو —
      // storageUrl يمرّره، فأسوأ حالة هي السلوك الحالي بالضبط، لا سلة مكسورة.
      version: 1,
      migrate: (persisted, fromVersion) => {
        const state = persisted as CartState | undefined
        if (fromVersion >= 1 || !state?.items) return state as CartState
        return {
          ...state,
          items: state.items.map((item) => {
            const key = legacyUrlToKey(item.image_url)
            return key ? { ...item, image_url: key } : item
          }),
        }
      },
    },
  ),
)
