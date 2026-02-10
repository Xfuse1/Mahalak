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
  is_online?: boolean
  is_approved: boolean // تم التأكيد من الأدمن
  price: number
  areas?: string[] // المناطق التي يغطيها
  created_at?: string
  updated_at?: string
}

// Get all approved drivers sorted by rating (available first, then by rating)
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
        is_online: data.isOnline ?? data.is_online ?? false,
        is_approved: data.isApproved ?? data.is_approved ?? false,
        price: data.price || 0,
        areas: data.areas,
        // Convert Timestamps to strings
        created_at: data.createdAt?.toDate?.()?.toISOString?.() || data.created_at,
        updated_at: data.updatedAt?.toDate?.()?.toISOString?.() || data.updated_at,
      }
    }) as Driver[]

    // Filter only approved drivers
    const approvedDrivers = drivers.filter(d => d.is_approved)

    // Sort: available first, then by rating descending
    approvedDrivers.sort((a, b) => {
      // First, sort by availability (available first)
      if (a.is_available !== b.is_available) {
        return a.is_available ? -1 : 1
      }
      // Then by rating descending
      return (b.rating || 0) - (a.rating || 0)
    })

    return approvedDrivers
  } catch (error) {
    console.error("[v0] Error fetching drivers:", error)
    return []
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

// Get driver commission rate from settings
export async function getDriverCommission(): Promise<number> {
  try {
    const db = getAdminDb()
    const doc = await db.collection("settings").doc("driverCommission").get()
    
    if (!doc.exists) {
      return 0
    }

    const data = doc.data()
    return data?.rate || 0
  } catch (error) {
    console.error("[v0] Error fetching driver commission:", error)
    return 0
  }
}

// Check if simulator is enabled from settings
export async function isSimulatorEnabled(): Promise<boolean> {
  try {
    const db = getAdminDb()
    const doc = await db.collection("settings").doc("simulator").get()
    
    if (!doc.exists) {
      return false
    }

    const data = doc.data()
    return data?.enabled === true
  } catch (error) {
    console.error("[v0] Error fetching simulator settings:", error)
    return false
  }
}
