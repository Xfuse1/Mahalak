import { getAdminDb } from "@/lib/firebase/admin"
import { normalizeEgyptPhone } from "@/lib/utils/phone"

type Conflict = {
  normalizedPhone: string
  userIds: string[]
}

type UserPhoneRecord = {
  id: string
  phone: string
  normalizedPhone: string | null
  storePhone?: string
  storeWhatsapp?: string
}

function formatList(values: string[]) {
  return values.length ? values.join(", ") : "-"
}

async function main() {
  const applyChanges = process.argv.includes("--apply")
  const db = getAdminDb()
  const snapshot = await db.collection("users").get()

  const records: UserPhoneRecord[] = snapshot.docs
    .map((doc) => {
      const data = doc.data() as {
        phone?: unknown
        store?: {
          phone?: unknown
          whatsapp_number?: unknown
        }
      }

      const phone = typeof data.phone === "string" ? data.phone.trim() : ""
      const storePhone = typeof data.store?.phone === "string" ? data.store.phone.trim() : undefined
      const storeWhatsapp = typeof data.store?.whatsapp_number === "string" ? data.store.whatsapp_number.trim() : undefined

      return {
        id: doc.id,
        phone,
        normalizedPhone: phone ? normalizeEgyptPhone(phone) : null,
        storePhone,
        storeWhatsapp,
      }
    })
    .filter((record) => record.phone)

  const phoneOwners = new Map<string, string[]>()
  for (const record of records) {
    if (!record.normalizedPhone) {
      continue
    }

    const owners = phoneOwners.get(record.normalizedPhone) || []
    owners.push(record.id)
    phoneOwners.set(record.normalizedPhone, owners)
  }

  const conflicts: Conflict[] = []
  const invalidPhones: UserPhoneRecord[] = []
  const pendingUpdates: Array<{ id: string; updates: Record<string, unknown> }> = []

  for (const record of records) {
    if (!record.normalizedPhone) {
      invalidPhones.push(record)
      continue
    }

    const owners = phoneOwners.get(record.normalizedPhone) || []
    if (owners.length > 1) {
      conflicts.push({
        normalizedPhone: record.normalizedPhone,
        userIds: owners,
      })
      continue
    }

    const updates: Record<string, unknown> = {}
    if (record.phone !== record.normalizedPhone) {
      updates.phone = record.normalizedPhone
    }

    const normalizedStorePhone = record.storePhone ? normalizeEgyptPhone(record.storePhone) : null
    if (normalizedStorePhone && record.storePhone !== normalizedStorePhone) {
      updates["store.phone"] = normalizedStorePhone
    }

    const normalizedWhatsapp = record.storeWhatsapp ? normalizeEgyptPhone(record.storeWhatsapp) : null
    if (normalizedWhatsapp && record.storeWhatsapp !== normalizedWhatsapp) {
      updates["store.whatsapp_number"] = normalizedWhatsapp
    }

    if (Object.keys(updates).length) {
      pendingUpdates.push({ id: record.id, updates })
    }
  }

  const uniqueConflicts = Array.from(
    new Map(conflicts.map((conflict) => [conflict.normalizedPhone, conflict])).values(),
  )

  console.log(`[normalize-egypt-phones] Mode: ${applyChanges ? "apply" : "dry-run"}`)
  console.log(`[normalize-egypt-phones] Users scanned: ${snapshot.size}`)
  console.log(`[normalize-egypt-phones] Valid phone rows: ${records.length - invalidPhones.length}`)
  console.log(`[normalize-egypt-phones] Invalid phones: ${invalidPhones.length}`)
  console.log(`[normalize-egypt-phones] Conflicts skipped: ${uniqueConflicts.length}`)
  console.log(`[normalize-egypt-phones] Pending updates: ${pendingUpdates.length}`)

  if (invalidPhones.length) {
    console.log("[normalize-egypt-phones] Invalid phone rows:")
    for (const record of invalidPhones) {
      console.log(`  - ${record.id}: ${record.phone}`)
    }
  }

  if (uniqueConflicts.length) {
    console.log("[normalize-egypt-phones] Conflicts:")
    for (const conflict of uniqueConflicts) {
      console.log(`  - ${conflict.normalizedPhone}: ${formatList(conflict.userIds)}`)
    }
  }

  if (!pendingUpdates.length || !applyChanges) {
    if (pendingUpdates.length) {
      console.log("[normalize-egypt-phones] Pending updates preview:")
      for (const update of pendingUpdates) {
        console.log(`  - ${update.id}: ${JSON.stringify(update.updates)}`)
      }
    }
    return
  }

  for (const update of pendingUpdates) {
    await db.collection("users").doc(update.id).update(update.updates)
    console.log(`  applied ${update.id}: ${JSON.stringify(update.updates)}`)
  }
}

main().catch((error) => {
  console.error("[normalize-egypt-phones] Failed:", error)
  process.exit(1)
})
