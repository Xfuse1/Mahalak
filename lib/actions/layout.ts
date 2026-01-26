"use server"

import { getAdminDb } from "../firebase/admin"
import { revalidatePath } from "next/cache"

export async function saveSupermarketLayout(storeId: string, shelves: any[], placements: any[]) {
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
    } catch (error: any) {
        console.error("[Layout Action] Error saving layout:", error);
        return { success: false, error: error.message };
    }
}

export async function getSupermarketLayout(storeId: string) {
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
