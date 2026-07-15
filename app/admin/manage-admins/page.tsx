import { getCurrentUser } from "@/lib/auth/session"
import { ShieldAlert } from "lucide-react"
import { ManageAdminsClient } from "./manage-admins-client"

// إدارة المسؤولين — سطح رفع صلاحيات (privilege escalation) لـ superAdmin فقط.
// البوابة الحقيقية هي حراس الأفعال (ensureSuperAdmin) في lib/actions/admin.ts؛ هذه الصفحة
// تعرض رسالة تقييد لغير الـsuperAdmin كطبقة عرض فقط (اللوحة نفسها محمية بحارس التخطيط للأدمن).
export default async function ManageAdminsPage() {
  const user = await getCurrentUser()

  if (!user?.isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-extrabold text-foreground mb-1">صلاحية مقيّدة</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          إدارة المسؤولين متاحة لحسابات المدير العام (superAdmin) فقط. تواصل مع مالك النظام إن كنت
          تحتاج هذه الصلاحية.
        </p>
      </div>
    )
  }

  return <ManageAdminsClient />
}
