import { getAdminAuth } from "@/lib/firebase/admin"
import { findDriverIdByPhone } from "@/lib/drivers/driver-repo"
import { logError } from "@/lib/logger"

// جسر دخول السائق عبر Firebase Phone Auth (تصميم B): تطبيق Flutter يتحقق من الهاتف عبر Firebase
// (Play Integrity على أندرويد) ويرسل ID token هنا. نتحقق منه سيرفر-سايد، نستخرج الهاتف المُثبَت،
// نطابقه بمستند السائق، ثم نُصدر جلسة driver_session بتاعتنا — فتبقى الجلسة نظامنا لا Firebase.
// النموذج API-only يبقى محفوظًا: التطبيق لا يلمس Firestore، والهوية المستمرة = كوكي/توكن جلستنا.
export async function verifyFirebaseDriver(
  idToken: string,
): Promise<{ ok: boolean; driverId?: string; error?: string }> {
  if (!idToken) return { ok: false, error: "missing_token" }
  try {
    // checkRevoked=true: يرفض التوكن لو أُبطل أو عُطّل الحساب في Firebase Auth.
    const decoded = await getAdminAuth().verifyIdToken(idToken, true)
    const phone = decoded.phone_number
    // نقبل فقط توكن مصادقة الهاتف (فيه phone_number مُثبَت من Firebase) — لا email/anon.
    if (!phone) return { ok: false, error: "no_phone" }
    // findDriverIdByPhone يطبّع ويجرّب صيغ الهاتف؛ phone هنا E.164 (+20…) فيطابق المخزَّن (01…) عبر المرشّحات.
    const driver = await findDriverIdByPhone(phone)
    if (!driver) return { ok: false, error: "not_a_driver" }
    return { ok: true, driverId: driver.id }
  } catch (e) {
    logError("[driver-firebase] verifyIdToken", e)
    return { ok: false, error: "invalid_token" }
  }
}
