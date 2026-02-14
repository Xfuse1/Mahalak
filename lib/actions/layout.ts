"use server"

import { getAdminDb } from "../firebase/admin"
import { revalidatePath } from "next/cache"
import { logError } from "../logger"
import type { Placement, Shelf } from "../types/product-management"

export async function saveSupermarketLayout(
    storeId: string,
    shelves: Shelf[],
    placements: Placement[],
    callerId?: string,
) {
    // Ownership check
    if (callerId && callerId !== storeId) {
        return { success: false, error: "ليس لديك صلاحية لتعديل هذا التخطيط" }
    }

    const db = getAdminDb();
    const docRef = db.collection("supermarket_layouts").doc(storeId);

    try {
        await docRef.set({
            shelves,
            placements,
            updated_at: new Date().toISOString()
        }, { merge: true });

        revalidatePath("/seller/supermarket-3d");
        return { success: true };
    } catch (error: unknown) {
        logError("[Layout Action] Error saving layout:", error);
        const message = error instanceof Error ? error.message : "Failed to save layout";
        return { success: false, error: message };
    }
}

export async function getSupermarketLayout(storeId: string, callerId?: string) {
    // Ownership check
    if (!callerId || callerId !== storeId) {
        return { success: false, error: "UNAUTHORIZED_LAYOUT_ACCESS", data: null };
    }

    const db = getAdminDb();
    const docSnap = await db.collection("supermarket_layouts").doc(storeId).get();

    if (!docSnap.exists) {
        return { success: true, data: null };
    }

    return {
        success: true,
        data: docSnap.data()
    };
}
