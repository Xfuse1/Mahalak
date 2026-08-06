"use client"

// قائمة المتاجر المحظورة للمشاهد الحالي — تُقرأ في العميل عمدًا.
//
// لماذا لا نفلتر في مكوّن السيرفر: أي قراءة للكوكي (getCurrentUid) داخل صفحة مثل "/" أو "/store"
// تُخرج الصفحة من العرض الثابت وتجعلها ديناميكية **لكل زائر**، حتى غير المسجَّل الذي لا يملك
// قائمة حظر أصلًا. الحظر تفضيل شخصي لا حدّ أمني، فتكلفة إبطاء أكثر صفحتين ازدحامًا في الموقع
// لا تبرّره. والفلترة هنا تتم قبل الرسم الأول للقائمة المفلترة عبر useMemo.

import { useEffect, useState } from "react"
import { getBlockedStoreIds } from "../actions/blocks"

export function useBlockedStoreIds(): Set<string> {
  const [blocked, setBlocked] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let mounted = true
    getBlockedStoreIds()
      .then((ids) => {
        // لا نُحدّث الحالة بمجموعة فارغة (الحالة الشائعة) كي لا نُطلق رسمة ثانية بلا فائدة
        if (mounted && ids.length) setBlocked(new Set(ids))
      })
      .catch(() => {
        // الحظر تحسين عرض — فشل قراءته لا يمنع تصفّح الموقع
      })
    return () => {
      mounted = false
    }
  }, [])

  return blocked
}
