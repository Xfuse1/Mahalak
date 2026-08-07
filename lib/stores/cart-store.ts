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
  /** من أين أُضيف هذا الصنف. يعيش في السلة لأن الطلب يُنشأ بعد الإضافة بخطوات، ولا سبيل لمعرفة
   *  المصدر عند الدفع إن لم يُحمَل معه. للقياس فقط — لا يمسّ سعرًا ولا كمية. */
  source?: string
}

type CartItemInput = Omit<CartItem, "quantity">

/** مُدخَل الإضافة الجماعية: نفس مُدخَل `addItem` مع كمية اختيارية (الافتراضي 1). */
export type CartBulkInput = CartItemInput & { quantity?: number }

/**
 * حصيلة الإضافة الجماعية. الفصل بين «لم يُضَف شيء» و«أُضيف أقلّ من المطلوب» مقصود: الواجهة تقول
 * «تعذّر إضافة صنفين» في الأولى و«أضفنا 2 من 4» في الثانية، والخلط بينهما يكذب على المستخدم.
 */
export type CartBulkResult = {
  /** أصناف لم تُضَف إطلاقًا (نفد مخزونها أو مخزونها غير معروف). بلا تكرار. */
  rejected: string[]
  /** أصناف أُضيفت بكمية أقلّ من المطلوبة لأن المخزون لم يتّسع. بلا تكرار. */
  partial: string[]
}

type CartState = {
  items: CartItem[]
  addItem: (item: CartItemInput) => void
  /** يضيف عدة أصناف بكمياتها دفعةً واحدة (انظر CartBulkResult). */
  addItems: (entries: CartBulkInput[]) => CartBulkResult
  decrementItem: (id: string) => void
  removeItem: (id: string) => void
  clear: () => void
  syncPrices: (pricing: Record<string, { price: number; discount_percentage: number }>) => void
}

// كمية صالحة: عدد صحيح موجب. أي شيء آخر (نص، كسر، سالب، NaN) يصير 1 — الإضافة الجماعية تأتي من
// مصدر مولَّد (سلة وصفة) لا من زرّ يضغطه المستخدم، فقيمة فاسدة يجب ألّا تُفسد السلة ولا تُفشل الطلب.
function safeQuantity(value: unknown): number {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n > 0 ? n : 1
}

// مخزون صالح: عدد صحيح ≥ 0. `null` تعني **غير معروف**، لا صفرًا.
//
// التمييز ليس تجميلًا: `Number(undefined)` تساوي NaN، و`quantity >= NaN` كاذبة دائمًا و
// `Math.min(x, NaN)` تساوي NaN — فكمية NaN كانت تُحفَظ في localStorage (وتصير null في JSON)
// فتُفسِد كل إجماليات السلة. ومعاملة الغائب كصفر أسوأ: دفعةٌ ينقصها الحقل كانت تُثبِّت
// `stock = 0` على صنف موجود في سلة المستخدم، فيصير غير قابل للزيادة أبدًا بعدها.
function safeStock(value: unknown): number | null {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n >= 0 ? n : null
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
      // إضافة جماعية بمرور واحد على الحالة.
      //
      // استدعاء `addItem` في حلقة كان يعطي سلوكًا خاطئًا لا بطيئًا فقط: هي تضيف قطعة واحدة مهما
      // كانت الكمية المطلوبة، فسلة وصفة فيها «٣ عبوات» كانت تصير عبوة. والتجميع هنا يمنع أيضًا
      // تجاوز المخزون حين يتكرّر الصنف الواحد في أكثر من مكوّن.
      addItems: (entries) => {
        const rejected = new Set<string>()
        const partial = new Set<string>()
        set((state) => {
          rejected.clear()
          partial.clear()
          const next = new Map(state.items.map((item) => [item.id, { ...item }]))

          for (const entry of entries) {
            if (!entry?.id) continue
            const stock = safeStock(entry.stock)
            const wanted = safeQuantity(entry.quantity)
            const existing = next.get(entry.id)

            if (existing) {
              // المخزون يُحدَّث من الحمولة الجديدة كما يفعل addItem (لقطة السلة قد تتقادم) — إلا
              // إن كان غير معروف، فلا نستبدل رقمًا صحيحًا في السلة بمجهول.
              if (stock !== null) existing.stock = stock
              const cap = existing.stock
              if (!Number.isFinite(cap) || existing.quantity >= cap) {
                rejected.add(entry.id)
                continue
              }
              const target = Math.min(existing.quantity + wanted, cap)
              if (target < existing.quantity + wanted) partial.add(entry.id)
              existing.quantity = target
              continue
            }

            // صنف جديد بمخزون مجهول: نرفض بدل أن نضيف. الإضافة الجماعية مصدرها مولَّد (سلة وصفة)
            // لا نقرة مستخدم، ومسار المخزون يفشل **مقفولًا** في هذا الريبو.
            if (stock === null || stock <= 0) {
              rejected.add(entry.id)
              continue
            }
            const { quantity: _ignored, ...rest } = entry
            if (wanted > stock) partial.add(entry.id)
            next.set(entry.id, { ...rest, stock, quantity: Math.min(wanted, stock) })
          }

          return { items: Array.from(next.values()) }
        })
        return { rejected: Array.from(rejected), partial: Array.from(partial) }
      },
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
