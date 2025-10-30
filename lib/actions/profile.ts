"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateProfile(userId: string, data: Partial<{ full_name: string; phone: string; address: string }>) {
  const supabase = await createServerClient()

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      full_name: data.full_name,
      phone: data.phone,
      /* address may not exist on profiles table; include if provided */
      ...(data.address ? { address: data.address } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .maybeSingle()

  if (error) {
    console.error("[v0] Error updating profile:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/account")
  return { success: true, data: updated }
}
