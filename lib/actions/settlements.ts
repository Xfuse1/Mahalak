"use server"

// تسوية كاش COD بين السائق والمتجر. عند التسليم يجمع السائق cash_collected (= الإجمالي = قيمة
// المنتجات + أجرة التوصيل). السائق يحتفظ بأجرة التوصيل (delivery_price)، ويظلّ مدينًا للمتجر بقيمة
// منتجاته حتى يسلّمها. هنا يرى المتجر الكاش "المحتجَز عند السائقين" ويؤكّد استلامه.
// كل الوصول عبر Admin SDK والملكية محميّة سيرفر-سايد: store_id (أو محطة المتجر) == uid المالك.
//
// الاستعلام يعتمد مصفوفة `unsettled_cod_store_ids` المفهرسة تلقائيًّا: تُملأ عند التسليم بمعرّفات
// المتاجر المستحِقّة، ويُزال معرّف المتجر منها عند التسوية. فالاستعلام يرجع مجموعة صغيرة مكتملة دائمًا
// (بلا مسح تاريخ ضخم ولا خطر حدّ يُسقط مستحقات قديمة).

import { getAdminDb } from "../firebase/admin"
import { FieldValue } from "firebase-admin/firestore"
import { getCurrentUid } from "../auth/session"
import { revalidatePath } from "next/cache"
import { logError } from "../logger"
import type { PickupStop } from "./orders"

const SCAN_CAP = 500
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const round2 = (n: number) => Math.round(n * 100) / 100

export type CodHolding = {
  order_id: string
  driver_id: string
  driver_name: string
  order_type: string
  owed: number // المستحق لهذا المتجر (قيمة منتجاته)
  total: number // كامل الكاش الذي حصّله السائق للطلب
  delivered_at?: string
  created_at?: string
}
export type CodByDriver = {
  driver_id: string
  driver_name: string
  count: number
  owed: number
  orders: CodHolding[]
}

// كل الكاش الذي جمعه السائقون ولم يُسلَّم لهذا المتجر بعد، مُجمّعًا حسب السائق. للبائع الحالي فقط.
export async function getStoreCodHoldings(): Promise<{
  ok: boolean
  drivers?: CodByDriver[]
  total_owed?: number
  error?: string
}> {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false, error: "unauthenticated" }
  try {
    const db = getAdminDb()
    // مقيّد بالطلبات غير المسوّاة لهذا المتجر (array-contains على مصفوفة مفهرسة تلقائيًّا) — مجموعة
    // مكتملة صغيرة، فلا يُسقط الحدّ مستحقات قديمة كما كان مسح store_id بحدّ 500 يفعل.
    const snap = await db.collection("orders").where("unsettled_cod_store_ids", "array-contains", uid).limit(SCAN_CAP).get()
    const holdings: CodHolding[] = []
    for (const d of snap.docs) {
      const o = d.data() as Record<string, any>
      if (o.is_dispatch !== true || o.status !== "delivered") continue
      const driverId = String(o.driver_id || "")
      if (!driverId) continue
      let owed: number
      let orderType: string
      if (o.order_type === "multi_store") {
        const stops: PickupStop[] = Array.isArray(o.pickup_stops) ? o.pickup_stops : []
        const stop = stops.find((s) => s.store_id === uid) as (PickupStop & { cod_settled?: boolean }) | undefined
        if (!stop || stop.cod_settled === true) continue // دفاع: التسوية تُزيل المعرّف من المصفوفة أصلًا
        owed = round2(num(stop.subtotal))
        orderType = "multi_store"
      } else {
        if (o.cod_settled === true) continue
        // المستحق للمتجر = قيمة المنتجات = الإجمالي − أجرة التوصيل (subtotal لا يُخزَّن للأحادي).
        owed = round2(num(o.total) - num(o.delivery_price))
        orderType = "single"
      }
      holdings.push({
        order_id: d.id, driver_id: driverId, driver_name: String(o.driver_name || "سائق"),
        order_type: orderType, owed, total: num(o.total),
        delivered_at: typeof o.delivered_at === "string" ? o.delivered_at : undefined,
        created_at: typeof o.created_at === "string" ? o.created_at : undefined,
      })
    }

    const byDriver = new Map<string, CodByDriver>()
    for (const h of holdings) {
      const g = byDriver.get(h.driver_id) || { driver_id: h.driver_id, driver_name: h.driver_name, count: 0, owed: 0, orders: [] }
      g.count++
      g.owed += h.owed
      g.orders.push(h)
      byDriver.set(h.driver_id, g)
    }
    const drivers = Array.from(byDriver.values())
      .map((g) => ({ ...g, owed: round2(g.owed), orders: g.orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))) }))
      .sort((a, b) => b.owed - a.owed)
    const total_owed = round2(drivers.reduce((s, g) => s + g.owed, 0))
    return { ok: true, drivers, total_owed }
  } catch (e) {
    logError("[settlements] getStoreCodHoldings", e)
    return { ok: false, error: "server_error" }
  }
}

// المتجر يؤكّد استلام كاش طلبٍ من السائق. أحادي → علم cod_settled على الطلب؛ متعدد → علم على محطة
// هذا المتجر فقط. الحالتان تُزيلان معرّف المتجر من unsettled_cod_store_ids. معاملة ذرّية + تحقّق
// ملكية + إيدمبوتنت (تأكيد مكرَّر لا يضرّ).
export async function markCodSettled(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false, error: "unauthenticated" }
  if (typeof orderId !== "string" || !orderId) return { ok: false, error: "bad_request" }
  const db = getAdminDb()
  const ref = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()
  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { ok: false as const, error: "order_not_found" }
      const o = snap.data() as Record<string, any>
      if (o.is_dispatch !== true) return { ok: false as const, error: "not_dispatch_order" }
      if (o.status !== "delivered") return { ok: false as const, error: "not_delivered" }
      if (o.order_type === "multi_store") {
        const stops: Array<Record<string, any>> = Array.isArray(o.pickup_stops) ? o.pickup_stops : []
        const idx = stops.findIndex((s) => s.store_id === uid)
        if (idx < 0) return { ok: false as const, error: "forbidden" }
        if (stops[idx].cod_settled === true) return { ok: true as const } // إيدمبوتنت
        const next = stops.map((s, i) => (i === idx ? { ...s, cod_settled: true, cod_settled_at: now } : s))
        tx.update(ref, { pickup_stops: next, unsettled_cod_store_ids: FieldValue.arrayRemove(uid), updated_at: now })
        return { ok: true as const }
      }
      if (o.store_id !== uid) return { ok: false as const, error: "forbidden" }
      if (o.cod_settled === true) return { ok: true as const } // إيدمبوتنت
      tx.update(ref, { cod_settled: true, cod_settled_at: now, unsettled_cod_store_ids: FieldValue.arrayRemove(uid), updated_at: now })
      return { ok: true as const }
    })
    if (out.ok) revalidatePath("/seller/settlements")
    return out.ok ? { ok: true } : { ok: false, error: out.error }
  } catch (e) {
    logError("[settlements] markCodSettled", e)
    return { ok: false, error: "server_error" }
  }
}
