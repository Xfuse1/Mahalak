import { getAdminDb } from "@/lib/firebase/admin"
import { chunkArray } from "@/lib/firebase/firestore-helpers"
import type { PickupStop } from "@/lib/actions/orders"

// تغذية طلبات السائق (طبقة محايدة، لا "use server") — يستدعيها route handler الخاص بـ/api/driver/orders.
// أمان: DTO بقائمة سماح صريحة — لا نُرجع أبدًا كود التسليم (delivery_code) ولا أي حقل غير مُدرَج.
// السائق يُدخل الكود من العميل عند الباب (إثبات تسليم)، فلا يجب أن يراه في القائمة.

export type DriverOrderItem = {
  product_id: string
  name?: string
  quantity: number
  price: number
  image_url?: string | null
}

export type DriverOrder = {
  id: string
  order_type: "single" | "multi_store"
  status: string
  total: number
  delivery_price: number
  created_at?: string
  updated_at?: string
  customer_name?: string
  customer_phone?: string
  delivery_address?: string
  delivery_city?: string
  delivery_notes?: string
  landmark?: string
  delivery_latitude?: number
  delivery_longitude?: number
  items?: DriverOrderItem[] // الطلب الأحادي
  pickup_stops?: PickupStop[] // المتعدد (كود التسليم ليس داخل المحطات — هو على مستوى الطلب فنُسقطه)
}

const DRIVER_ORDERS_LIMIT = 100

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined
}

// إعادة بناء محطات الاستلام بقائمة سماح صريحة (نفس ضمان الطلب الأحادي) — لا نمرّر أي حقل غير مُدرَج
// من مستند Firestore (دفاع عمق ضد تسريب حقول مستقبلية قد تُكتب داخل pickup_stops).
function mapPickupStops(raw: unknown): PickupStop[] {
  if (!Array.isArray(raw)) return []
  const STATUSES = ["pending", "confirmed", "rejected", "picked_up"]
  return raw.map((s: Record<string, any>) => ({
    store_id: str(s?.store_id) || "",
    store_name: str(s?.store_name) || "",
    items: Array.isArray(s?.items)
      ? s.items.map((it: Record<string, any>) => ({
          product_id: str(it?.product_id) || "",
          name: str(it?.name) || "",
          quantity: num(it?.quantity),
          price: num(it?.price),
          image_url: typeof it?.image_url === "string" ? it.image_url : null,
        }))
      : [],
    subtotal: num(s?.subtotal),
    status: (STATUSES.includes(s?.status) ? s.status : "pending") as PickupStop["status"],
    confirmed_at: str(s?.confirmed_at) ?? null,
    picked_up_at: str(s?.picked_up_at) ?? null,
    rejected_at: str(s?.rejected_at) ?? null,
    rejection_reason: str(s?.rejection_reason) ?? null,
  }))
}

export async function getDriverOrders(driverId: string): Promise<DriverOrder[]> {
  const db = getAdminDb()
  // مساواة بحقل واحد (driver_id) — يخدمها الفهرس المفرد التلقائي؛ نرتّب في JS لتفادي فهرس مركّب.
  const snap = await db.collection("orders").where("driver_id", "==", driverId).get()

  const raw = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Record<string, any>))
    // الاستفسارات ليست توصيلات — نستبعدها من قائمة السائق
    .filter((o) => o.order_type !== "inquiry" && o.status !== "inquiry")

  raw.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
  const orders = raw.slice(0, DRIVER_ORDERS_LIMIT)

  // عناصر الطلبات الأحادية + أسماء/صور منتجاتها (المتعدد يحمل عناصره داخل pickup_stops أصلًا)
  const singleIds = orders.filter((o) => o.order_type !== "multi_store").map((o) => o.id)
  const itemsByOrder = new Map<string, DriverOrderItem[]>()

  if (singleIds.length) {
    const rawItems: { order_id: string; product_id: string; quantity: number; price: number }[] = []
    for (const chunk of chunkArray(singleIds, 10)) {
      const isnap = await db.collection("order_items").where("order_id", "in", chunk).get()
      isnap.docs.forEach((doc) => {
        const it = doc.data()
        rawItems.push({
          order_id: str(it.order_id) || "",
          product_id: str(it.product_id) || "",
          quantity: num(it.quantity),
          price: num(it.price),
        })
      })
    }

    const productIds = Array.from(new Set(rawItems.map((i) => i.product_id).filter(Boolean)))
    const productMap = new Map<string, { name?: string; image_url: string | null }>()
    for (const chunk of chunkArray(productIds, 10)) {
      if (!chunk.length) continue
      const refs = chunk.map((id) => db.collection("products").doc(id))
      const pdocs = await db.getAll(...refs)
      pdocs.forEach((pd) => {
        if (pd.exists) {
          const p = pd.data() as Record<string, any>
          productMap.set(pd.id, { name: str(p.name), image_url: typeof p.image_url === "string" ? p.image_url : null })
        }
      })
    }

    for (const it of rawItems) {
      const prod = productMap.get(it.product_id)
      const entry: DriverOrderItem = {
        product_id: it.product_id,
        name: prod?.name,
        quantity: it.quantity,
        price: it.price,
        image_url: prod?.image_url ?? null,
      }
      if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, [])
      itemsByOrder.get(it.order_id)!.push(entry)
    }
  }

  return orders.map((o): DriverOrder => {
    const isMulti = o.order_type === "multi_store"
    return {
      id: o.id,
      order_type: isMulti ? "multi_store" : "single",
      status: str(o.status) || "pending",
      total: num(o.total),
      delivery_price: num(o.delivery_price),
      created_at: str(o.created_at?.toDate?.()?.toISOString?.() || o.created_at),
      updated_at: str(o.updated_at?.toDate?.()?.toISOString?.() || o.updated_at),
      customer_name: str(o.customer_name),
      customer_phone: str(o.customer_phone),
      delivery_address: str(o.delivery_address),
      delivery_city: str(o.delivery_city),
      delivery_notes: str(o.delivery_notes),
      landmark: str(o.landmark),
      delivery_latitude: o.delivery_latitude != null ? num(o.delivery_latitude) : undefined,
      delivery_longitude: o.delivery_longitude != null ? num(o.delivery_longitude) : undefined,
      ...(isMulti
        ? { pickup_stops: mapPickupStops(o.pickup_stops) }
        : { items: itemsByOrder.get(o.id) || [] }),
    }
  })
}
