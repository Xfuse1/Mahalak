"use client"

// قائمة المتاجر المحظورة للمشاهد الحالي — تُقرأ في العميل عمدًا.
//
// لماذا لا نفلتر في مكوّن السيرفر: أي قراءة للكوكي (getCurrentUid) داخل صفحة مثل "/" أو "/store"
// تُخرج الصفحة من العرض الثابت وتجعلها ديناميكية **لكل زائر**، حتى غير المسجَّل الذي لا يملك
// قائمة حظر أصلًا. الحظر تفضيل شخصي لا حدّ أمني، فتكلفة إبطاء أكثر صفحتين ازدحامًا لا تبرّره.
//
// ثمن هذا القرار: الخادم يرسم القائمة كاملة، فلا مفرّ من إطار أول غير مفلتر. نُقلّصه إلى الحد
// الأدنى بنسخة محفوظة في localStorage تُقرأ لحظة الإماهة (بلا انتظار الشبكة)، ثم نُحدّثها من
// الخادم في الخلفية. نستخدم useSyncExternalStore بلقطة خادم فارغة كي لا يختلف رسم الخادم عن
// العميل (تحذير إماهة) — نفس نمط lib/location/user-location.tsx.

import { useEffect, useMemo, useSyncExternalStore } from "react"
import { getBlockedStoreIds } from "../actions/blocks"

const STORAGE_KEY = "mahalak_blocked_stores"
const EMPTY: string[] = []

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((l) => l())
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  if (typeof window !== "undefined") window.addEventListener("storage", cb)
  return () => {
    listeners.delete(cb)
    if (typeof window !== "undefined") window.removeEventListener("storage", cb)
  }
}
function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
function writeRaw(ids: string[]) {
  try {
    if (ids.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // التخزين المحلي قد يكون معطّلًا — الحظر يظل يعمل بعد رحلة الشبكة
  }
  notify()
}

/** يمسح النسخة المحفوظة — يُستدعى عند تسجيل الخروج كي لا ترث جلسة أخرى حظر غيرها. */
export function clearBlockedStoresCache() {
  writeRaw([])
}

export function useBlockedStoreIds(): Set<string> {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null)

  const cached = useMemo<string[]>(() => {
    if (!raw) return EMPTY
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : EMPTY
    } catch {
      return EMPTY
    }
  }, [raw])

  // تحديث في الخلفية: مصدر الحقيقة هو الخادم، والنسخة المحفوظة تسريع لا بديل.
  // نقارن بالمخزَّن وقت وصول الرد (لا بقيمة مُغلَّفة في الإغلاق) فلا يحتاج التأثير أي اعتمادية
  // ولا يعيد الجلب مع كل كتابة.
  useEffect(() => {
    let mounted = true
    getBlockedStoreIds()
      .then((ids) => {
        if (!mounted) return
        const next = JSON.stringify(ids.length ? ids : [])
        const current = readRaw() || "[]"
        if (next !== current) writeRaw(ids)
      })
      .catch(() => {
        // الحظر تحسين عرض — فشل قراءته لا يمنع تصفّح الموقع
      })
    return () => {
      mounted = false
    }
  }, [])

  return useMemo(() => new Set(cached), [cached])
}
