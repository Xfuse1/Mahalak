"use server"

import { getAdminDb } from "../firebase/admin"

export type Driver = {
  id: string
  name: string
  phone?: string
  photo_url?: string
  vehicle_type?: string // سيارة، موتوسيكل، إلخ
  rating: number
  total_deliveries: number
  is_available: boolean
  price: number
  areas?: string[] // المناطق التي يغطيها
  created_at?: string
  updated_at?: string
}

// Get all drivers sorted by rating (available first, then by rating)
export async function getDrivers(): Promise<Driver[]> {
  try {
    const db = getAdminDb()
    const snapshot = await db
      .collection("drivers")
      .get()

    const drivers: Driver[] = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name || "",
        phone: data.phone,
        photo_url: data.photoUrl || data.photo_url,
        vehicle_type: data.vehicleType || data.vehicle_type,
        rating: data.rating || 0,
        total_deliveries: data.totalDeliveries || data.total_deliveries || 0,
        is_available: data.isActive ?? data.is_available ?? true,
        price: data.price || 0,
        areas: data.areas,
        // Convert Timestamps to strings
        created_at: data.createdAt?.toDate?.()?.toISOString?.() || data.created_at,
        updated_at: data.updatedAt?.toDate?.()?.toISOString?.() || data.updated_at,
      }
    }) as Driver[]

    // Sort: available first, then by rating descending
    drivers.sort((a, b) => {
      // First, sort by availability (available first)
      if (a.is_available !== b.is_available) {
        return a.is_available ? -1 : 1
      }
      // Then by rating descending
      return (b.rating || 0) - (a.rating || 0)
    })

    return drivers
  } catch (error) {
    console.error("[v0] Error fetching drivers:", error)
    return []
  }
}

// Create a new driver (admin only)
export async function createDriver(data: Omit<Driver, "id">) {
  try {
    const db = getAdminDb()
    const now = new Date().toISOString()
    
    const docRef = await db.collection("drivers").add({
      ...data,
      created_at: now,
      updated_at: now,
    })

    return { success: true, id: docRef.id }
  } catch (error: any) {
    console.error("[v0] Error creating driver:", error)
    return { success: false, error: error?.message || "Failed to create driver" }
  }
}

// Update a driver
export async function updateDriver(id: string, data: Partial<Driver>) {
  try {
    const db = getAdminDb()
    const now = new Date().toISOString()
    
    await db.collection("drivers").doc(id).update({
      ...data,
      updated_at: now,
    })

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error updating driver:", error)
    return { success: false, error: error?.message || "Failed to update driver" }
  }
}

// Get a single driver by ID
export async function getDriverById(id: string): Promise<Driver | null> {
  try {
    const db = getAdminDb()
    const doc = await db.collection("drivers").doc(id).get()
    
    if (!doc.exists) {
      return null
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as Driver
  } catch (error) {
    console.error("[v0] Error fetching driver:", error)
    return null
  }
}
