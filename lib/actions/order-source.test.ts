import { describe, it, expect } from "vitest"

// `normalizeOrderSource` غير مُصدَّرة من [lib/actions/orders.ts] — الملف "use server" وكل مُصدَّر منه
// يصير نقطة نهاية على الشبكة، فتصديرُ مساعدٍ داخلي لأجل الاختبار يفتح سطحًا بلا مقابل.
// القاعدة نُسخت هنا حرفيًّا، والاختبار يحرس **العقد** (قائمة سماح لا نصّ حرّ) لا نسخةً من الكود.
const ORDER_SOURCES = new Set(["web", "ai_search", "pos"])
function normalizeOrderSource(value: unknown): string {
  const v = typeof value === "string" ? value.trim() : ""
  return ORDER_SOURCES.has(v) ? v : "web"
}

describe("normalizeOrderSource — مصدر الطلب من مدخل عام", () => {
  it("يمرّر المصادر المعروفة، والمسافات الزائدة تُقصّ لا تُرفَض", () => {
    expect(normalizeOrderSource("ai_search")).toBe("ai_search")
    expect(normalizeOrderSource("web")).toBe("web")
    expect(normalizeOrderSource("pos")).toBe("pos")
    expect(normalizeOrderSource(" ai_search ")).toBe("ai_search")
  })

  it("يردّ أي قيمة أخرى إلى web بدل تخزينها كما هي", () => {
    // مستند الطلب يُعرَض في لوحات الأدمن والبائع، فنصٌّ حرّ من العميل فيه سطحُ حقنٍ بلا داعٍ.
    // وحسّاسية حالة الأحرف مقصودة: «AI_SEARCH» ليست القيمة المتّفق عليها، فلا تُقبل تخمينًا.
    for (const bad of ["<img src=x onerror=alert(1)>", "AI_SEARCH", "'; DROP", "أي كلام", "ai_search;web"]) {
      expect(normalizeOrderSource(bad)).toBe("web")
    }
  })

  it("يتحمّل الغياب وأي نوع غير نصّي", () => {
    for (const bad of [undefined, null, 0, 1, {}, [], true]) {
      expect(normalizeOrderSource(bad)).toBe("web")
    }
  })
})

// اشتقاق مصدر الطلب من أصناف السلة — منطق [app/checkout/delivery/page.tsx].
function orderSourceOf(items: Array<{ source?: string }>): string {
  return items.length && items.every((i) => i.source === "ai_search") ? "ai_search" : "web"
}

describe("اشتقاق مصدر الطلب من السلة", () => {
  it("سلة كلها من البحث الذكي ⇒ ai_search", () => {
    expect(orderSourceOf([{ source: "ai_search" }, { source: "ai_search" }])).toBe("ai_search")
  })

  it("سلة مختلطة تُنسَب للعادي لا للذكي", () => {
    // نسبةُ طلبٍ نصفُه من البحث الذكي إليه كاملًا تضخّم مقياس التحويل الذي بُني الحقل لأجله.
    expect(orderSourceOf([{ source: "ai_search" }, {}])).toBe("web")
    expect(orderSourceOf([{ source: "ai_search" }, { source: "web" }])).toBe("web")
  })

  it("سلة فارغة ⇒ web (لا ai_search بحكم every على مصفوفة فارغة)", () => {
    expect(orderSourceOf([])).toBe("web")
  })
})
