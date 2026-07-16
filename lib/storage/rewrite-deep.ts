import { legacyUrlToKey } from "./legacy-url"

/**
 * يمشي داخل قيمة مستند Firestore بأي عمق ويستبدل كل رابط Supabase عام مطلق بمساره.
 *
 * لماذا المشي العميق بدل قائمة حقول ثابتة؟ لأن القيم المستهدفة متداخلة داخل مصفوفات
 * (`pos_sales.items[].image_url`، `orders.pickup_stops[].items[].image_url`)، وقائمة حقول
 * ثابتة تفوّتها **بصمت** — وهو أسوأ فشل ممكن في ترحيل. الحارس ليس معرفتنا بالبنية بل
 * صرامة legacyUrlToKey: ما لا يطابق شكل الرابط بالضبط لا يُلمس.
 *
 * ضمانتان تمنعان إفساد البيانات:
 *  1. **حفظ المرجع**: أي فرع بلا إصابات يُعاد **كما هو** (نفس المرجع) لا كنسخة. هذا يُبقي
 *     أنواع Firestore الخاصة سليمة ويجعل "لا تغيير" تعني حرفيًا لا تغيير.
 *  2. **تجاهل الأنواع الخاصة**: Timestamp/GeoPoint/DocumentReference ليست كائنات عادية —
 *     تفكيكها إلى `{...}` يُتلف المستند عند إعادة كتابته.
 */

// أنواع firebase-admin التي يجب ألا نغوص فيها أبدًا.
const OPAQUE = /^(Timestamp|GeoPoint|DocumentReference|FieldValue|Bytes|Buffer|Uint8Array|Date)$/

export type RewriteHit = (field: string, url: string) => void

export function rewriteDeep(value: unknown, onHit?: RewriteHit, path = ""): { value: unknown; hits: number } {
  if (typeof value === "string") {
    const key = legacyUrlToKey(value)
    if (!key) return { value, hits: 0 }
    onHit?.(path, value)
    return { value: key, hits: 1 }
  }

  if (value === null || typeof value !== "object") return { value, hits: 0 }

  const ctor = (value as { constructor?: { name?: string } })?.constructor?.name || ""
  if (OPAQUE.test(ctor)) return { value, hits: 0 }

  if (Array.isArray(value)) {
    let hits = 0
    const next = value.map((v) => {
      const r = rewriteDeep(v, onHit, `${path}[]`)
      hits += r.hits
      return r.value
    })
    // بلا إصابات ⇒ نعيد المصفوفة الأصلية بمرجعها (لا نسخة).
    return hits ? { value: next, hits } : { value, hits: 0 }
  }

  let hits = 0
  const next: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const r = rewriteDeep(v, onHit, path ? `${path}.${k}` : k)
    hits += r.hits
    next[k] = r.value
  }
  return hits ? { value: next, hits } : { value, hits: 0 }
}
