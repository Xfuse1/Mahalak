import { create } from "zustand"
import type { CartItem } from "./cart-store"

// عربة معزولة لمحاكي المتجر ثلاثي الأبعاد فقط — منفصلة تمامًا عن عربة التسوق الحقيقية
// (mahalak-cart في localStorage). بدونها كان اللعب في المحاكي يحقن منتجات حقيقية في عربة
// المستخدم أو يمسحها عند "الدفع/إعادة الضبط". غير مُخزَّنة: تبدأ فارغة كل جلسة.
type SimCartItemInput = Omit<CartItem, "quantity">

type SimCartState = {
  items: CartItem[]
  addItem: (item: SimCartItemInput) => boolean
  decrementItem: (id: string) => void
  removeItem: (id: string) => void
  clear: () => void
}

export const useSimCartStore = create<SimCartState>((set) => ({
  items: [],
  // يُرجع true إن أُضيف/زاد فعلًا، false إن رُفض (نفد المخزون/تجاوز الكمية) — لعرض تغذية صحيحة
  addItem: (item) => {
    let added = false
    set((state) => {
      const existing = state.items.find((entry) => entry.id === item.id)
      if (existing) {
        if (existing.quantity >= existing.stock) return state
        added = true
        return {
          items: state.items.map((entry) =>
            entry.id === item.id ? { ...entry, quantity: entry.quantity + 1, stock: item.stock } : entry,
          ),
        }
      }
      if (item.stock <= 0) return state
      added = true
      return { items: [...state.items, { ...item, quantity: 1 }] }
    })
    return added
  },
  decrementItem: (id) =>
    set((state) => {
      const existing = state.items.find((entry) => entry.id === id)
      if (!existing) return state
      if (existing.quantity <= 1) return { items: state.items.filter((entry) => entry.id !== id) }
      return {
        items: state.items.map((entry) =>
          entry.id === id ? { ...entry, quantity: entry.quantity - 1 } : entry,
        ),
      }
    }),
  removeItem: (id) => set((state) => ({ items: state.items.filter((entry) => entry.id !== id) })),
  clear: () => set({ items: [] }),
}))
