// سياسة موحّدة لكلمة المرور: 6 أحرف على الأقل + حرف ورقم. تُستخدم في التسجيل ومساري الاسترجاع
// (نسيت كلمة المرور / إعادة التعيين) وتُفرَض سيرفر-سايد في resetUserPassword كمصدر الحقيقة —
// كانت مسارات الاسترجاع تسمح بكلمة أضعف مما يقبله التسجيل.
export function isPasswordValid(password: unknown): boolean {
  return (
    typeof password === "string" &&
    password.length >= 6 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  )
}

export const PASSWORD_POLICY_AR = "كلمة المرور يجب أن تكون 6 أحرف على الأقل وتحتوي على حرف ورقم"
export const PASSWORD_POLICY_EN = "Password must be at least 6 characters and include a letter and a number"
