"use server"

// UX-01: دفتر ديون البائع (Credit Ledger) — رقمنة "البيع بالأجل" التقليدي.
// كل الوصول عبر Admin SDK (يتجاوز قواعد Firestore)، والملكية محميّة سيرفر-سايد:
// store_id لحساب الدين == uid مالك المتجر (نفس نمط offers/products).

import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { getCurrentUid } from "../auth/session"
import { cleanUndefined } from "../firebase/firestore-helpers"

export type DebtAccount = {
  id: string
  store_id: string
  customer_name: string
  customer_phone?: string
  balance: number
  note?: string
  created_at: string
  updated_at: string
}

export type DebtTransaction = {
  id: string
  debt_id: string
  store_id: string
  type: "debt" | "payment"
  amount: number
  note?: string
  created_at: string
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message
  }
  return undefined
}

// قراءة كل حسابات ديون المتجر الحالي (الأعلى رصيدًا أولًا).
export async function getStoreDebts(): Promise<DebtAccount[]> {
  const uid = await getCurrentUid()
  if (!uid) return []
  const db = getAdminDb()
  const snap = await db.collection("debts").where("store_id", "==", uid).get()
  const debts = snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as DebtAccount,
  )
  debts.sort((a, b) => (b.balance || 0) - (a.balance || 0))
  return debts
}

// حركات حساب دين واحد (الأحدث أولًا) — محميّة بالملكية.
export async function getDebtTransactions(debtId: string): Promise<DebtTransaction[]> {
  const uid = await getCurrentUid()
  if (!uid) return []
  const db = getAdminDb()
  const debtDoc = await db.collection("debts").doc(debtId).get()
  if (!debtDoc.exists || debtDoc.data()?.store_id !== uid) return []
  const snap = await db.collection("debt_transactions").where("debt_id", "==", debtId).get()
  const txs = snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as DebtTransaction,
  )
  txs.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
  return txs
}

// إنشاء حساب عميل جديد، مع رصيد افتتاحي اختياري (يُسجَّل كحركة دين).
export async function createDebt(input: {
  customer_name: string
  customer_phone?: string
  initial_amount?: number
  note?: string
}) {
  const uid = await getCurrentUid()
  if (!uid) return { success: false, error: "غير مصرّح" }

  const name = (input.customer_name || "").trim()
  if (!name) return { success: false, error: "اسم العميل مطلوب" }
  const initial = Number(input.initial_amount) || 0
  if (!Number.isFinite(initial) || initial < 0) {
    return { success: false, error: "المبلغ غير صالح" }
  }

  const db = getAdminDb()
  const now = new Date().toISOString()
  const docRef = db.collection("debts").doc()
  const account = cleanUndefined({
    store_id: uid,
    customer_name: name,
    customer_phone: input.customer_phone?.trim() || undefined,
    balance: initial,
    note: input.note?.trim() || undefined,
    created_at: now,
    updated_at: now,
  })

  try {
    // دفعة ذرّية: الحساب وحركة الرصيد الافتتاحي يُكتبان معًا، فلا يبقى حساب بلا تاريخ
    // (وبالتالي لا حسابات مكرّرة عند إعادة المحاولة بعد فشل الحركة الثانية).
    const batch = db.batch()
    batch.set(docRef, account)
    if (initial > 0) {
      batch.set(db.collection("debt_transactions").doc(), {
        debt_id: docRef.id,
        store_id: uid,
        type: "debt",
        amount: initial,
        note: "رصيد افتتاحي",
        created_at: now,
      })
    }
    await batch.commit()
  } catch (error) {
    return { success: false, error: getErrorMessage(error) || "تعذّر إنشاء الحساب" }
  }

  revalidatePath("/seller/ledger")
  return { success: true, data: { id: docRef.id, ...account } as DebtAccount }
}

// إضافة حركة (دين جديد أو دفعة) وتحديث الرصيد ذرّيًا.
export async function addDebtTransaction(
  debtId: string,
  input: { type: "debt" | "payment"; amount: number; note?: string },
) {
  const uid = await getCurrentUid()
  if (!uid) return { success: false, error: "غير مصرّح" }
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "المبلغ يجب أن يكون أكبر من صفر" }
  }
  if (input.type !== "debt" && input.type !== "payment") {
    return { success: false, error: "نوع غير صالح" }
  }

  const db = getAdminDb()
  const debtRef = db.collection("debts").doc(debtId)
  const now = new Date().toISOString()

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(debtRef)
      if (!snap.exists || snap.data()?.store_id !== uid) {
        throw new Error("FORBIDDEN")
      }
      const current = Number(snap.data()?.balance) || 0
      // منع الدفعة التي تتجاوز الرصيد المتبقّي — سابقًا كان الرصيد يُقصّ إلى 0 بينما تُسجَّل
      // الحركة بالمبلغ الكامل، فيختلّ الدفتر (مجموع الحركات ≠ الرصيد) ويُحتسب فائض للعميل خطأً.
      if (input.type === "payment" && amount > current) {
        throw new Error("PAYMENT_EXCEEDS_BALANCE")
      }
      const delta = input.type === "debt" ? amount : -amount
      const newBalance = current + delta
      tx.update(debtRef, { balance: newBalance, updated_at: now })
      const txRef = db.collection("debt_transactions").doc()
      tx.set(
        txRef,
        cleanUndefined({
          debt_id: debtId,
          store_id: uid,
          type: input.type,
          amount,
          note: input.note?.trim() || undefined,
          created_at: now,
        }),
      )
      return { newBalance, txId: txRef.id }
    })
    revalidatePath("/seller/ledger")
    return { success: true, data: result }
  } catch (error) {
    if (getErrorMessage(error) === "FORBIDDEN") {
      return { success: false, error: "ليس لديك صلاحية" }
    }
    if (getErrorMessage(error) === "PAYMENT_EXCEEDS_BALANCE") {
      return { success: false, error: "المبلغ أكبر من الرصيد المتبقّي" }
    }
    return { success: false, error: getErrorMessage(error) || "تعذّر تسجيل الحركة" }
  }
}

// تعديل بيانات العميل (لا يلمس الرصيد).
export async function updateDebt(
  debtId: string,
  input: { customer_name?: string; customer_phone?: string; note?: string },
) {
  const uid = await getCurrentUid()
  if (!uid) return { success: false, error: "غير مصرّح" }
  const db = getAdminDb()
  const debtRef = db.collection("debts").doc(debtId)
  const snap = await debtRef.get()
  if (!snap.exists || snap.data()?.store_id !== uid) {
    return { success: false, error: "ليس لديك صلاحية" }
  }
  const patch = cleanUndefined({
    customer_name: input.customer_name?.trim() || undefined,
    customer_phone: input.customer_phone?.trim() || undefined,
    note: input.note?.trim() || undefined,
    updated_at: new Date().toISOString(),
  })
  try {
    await debtRef.set(patch, { merge: true })
  } catch (error) {
    return { success: false, error: getErrorMessage(error) || "تعذّر التحديث" }
  }
  revalidatePath("/seller/ledger")
  return { success: true }
}

// حذف حساب دين وكل حركاته.
export async function deleteDebt(debtId: string) {
  const uid = await getCurrentUid()
  if (!uid) return { success: false, error: "غير مصرّح" }
  const db = getAdminDb()
  const debtRef = db.collection("debts").doc(debtId)
  const snap = await debtRef.get()
  if (!snap.exists || snap.data()?.store_id !== uid) {
    return { success: false, error: "ليس لديك صلاحية" }
  }
  try {
    const txSnap = await db.collection("debt_transactions").where("debt_id", "==", debtId).get()
    const docs = txSnap.docs
    // تقسيم على دفعات ≤450 — دفعة Firestore الواحدة محدودة بـ500 عملية، فعميل بكثير من
    // الحركات كان يجعل الحذف يفشل كليًّا (all-or-nothing) ويتعذّر حذف الحساب أبدًا.
    const CHUNK = 450
    for (let i = 0; i < docs.length; i += CHUNK) {
      const batch = db.batch()
      docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref))
      if (i + CHUNK >= docs.length) batch.delete(debtRef) // نحذف الحساب في آخر دفعة
      await batch.commit()
    }
    if (docs.length === 0) {
      await debtRef.delete()
    }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) || "تعذّر الحذف" }
  }
  revalidatePath("/seller/ledger")
  return { success: true }
}
