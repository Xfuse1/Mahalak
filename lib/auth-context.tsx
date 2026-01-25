"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from "react"
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
  type User as FirebaseUser,
} from "firebase/auth"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { useTranslation } from "react-i18next"
import { createStore } from "@/lib/actions/stores"
import { getFirebaseAuth, getFirestoreClient } from "@/lib/firebase/client"

interface User {
  id: string
  email: string
  name: string
  role: "customer" | "seller"
  phone?: string
  // optional address fields (some rows use different column names)
  address?: string
  street?: string
  city?: string
  country?: string
  state?: string
}

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  login: (email: string, password: string, role: "customer" | "seller") => Promise<boolean>
  register: (
    email: string,
    password: string,
    name: string,
    role: "customer" | "seller",
    sellerData?: {
      phone?: string
      storeName?: string
      storeDescription?: string
      address?: string
      storeType?: string
    },
    street?: string,
    city?: string,
    country?: string,
  ) => Promise<boolean>
  logout: () => void
  isLoading: boolean
  error: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const loadingProfile = useRef(false)
  const { t } = useTranslation()

  const auth = getFirebaseAuth()
  const db = getFirestoreClient()

  const loadUserProfile = useCallback(async (currentUser: FirebaseUser) => {
    if (loadingProfile.current) return
    loadingProfile.current = true

    try {
      const profileRef = doc(db, "profiles", currentUser.uid)
      const profileSnap = await getDoc(profileRef)

      if (profileSnap.exists()) {
        const profile = profileSnap.data()

        setUser({
          id: profileSnap.id,
          email: profile.email || currentUser.email || "",
          name:
            profile.full_name ||
            profile.email?.split("@")[0] ||
            currentUser.email?.split("@")[0] ||
            "",
          role: profile.role || "customer",
          phone: profile.phone,
          // normalize possible DB column names into the user object
          street: profile.street ?? profile.address_street ?? profile.address ?? undefined,
          city: profile.city ?? profile.address_city ?? undefined,
          state: profile.state ?? profile.address_state ?? undefined,
          country: profile.country ?? undefined,
          address: profile.address ?? undefined,
        })
      } else {
        const fallbackEmail = currentUser.email || ""
        const fallbackName = currentUser.displayName || (fallbackEmail ? fallbackEmail.split("@")[0] : "")
        const now = new Date().toISOString()

        const profileData = {
          email: fallbackEmail,
          full_name: fallbackName,
          role: "customer",
          phone: null,
          street: null,
          city: null,
          state: null,
          country: null,
          address: null,
          created_at: now,
          updated_at: now,
        }

        await setDoc(profileRef, profileData)

        setUser({
          id: currentUser.uid,
          email: profileData.email,
          name: profileData.full_name || profileData.email.split("@")[0],
          role: "customer",
        })
      }
    } catch (error) {
      console.error("[v0] Error loading user profile:", error)
    } finally {
      setIsLoading(false)
      loadingProfile.current = false
    }
  }, [db])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setFirebaseUser(currentUser)
        await loadUserProfile(currentUser)
      } else {
        setFirebaseUser(null)
        setUser(null)
        setIsLoading(false)
        loadingProfile.current = false
      }
    })

    return () => unsubscribe()
  }, [auth, loadUserProfile])

  const login = useCallback(async (email: string, password: string, role: "customer" | "seller"): Promise<boolean> => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const profileRef = doc(db, "profiles", credential.user.uid)
      const profileSnap = await getDoc(profileRef)
      const profileData = profileSnap.exists() ? profileSnap.data() : null
      const profileRole = (profileData?.role as "customer" | "seller") || "customer"

      if (profileRole !== role) {
        await signOut(auth)
        throw new Error("Invalid role for this account type")
      }

      if (!profileSnap.exists()) {
        const now = new Date().toISOString()
        await setDoc(profileRef, {
          email,
          full_name: credential.user.displayName || email.split("@")[0],
          role: profileRole,
          created_at: now,
          updated_at: now,
        })
      }

      return true
    } catch (error: any) {
      const code = error?.code as string | undefined
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        throw new Error("Invalid login credentials")
      }
      throw error
    }
  }, [auth, db])

  const register = useCallback(async (
    email: string,
    password: string,
    name: string,
    role: "customer" | "seller",
    sellerData?: {
      phone?: string
      storeName?: string
      storeDescription?: string
      address?: string
      storeType?: string
    },
    street?: string,
    city?: string,
    country?: string,
  ): Promise<boolean> => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)

      try {
        await updateFirebaseProfile(credential.user, { displayName: name })
      } catch {
        // ignore profile update errors
      }

      const now = new Date().toISOString()
      const profileData = {
        email,
        full_name: name,
        role,
        phone: sellerData?.phone ?? null,
        street: street ?? null,
        city: city ?? null,
        country: country ?? null,
        created_at: now,
        updated_at: now,
      }

      await setDoc(doc(db, "profiles", credential.user.uid), profileData)

      if (role === "seller" && credential.user && sellerData?.storeName) {
        const result = await createStore({
          seller_id: credential.user.uid,
          name: sellerData.storeName,
          description: sellerData.storeDescription || "",
          address: sellerData.address || "",
          phone: sellerData.phone || "",
          category: sellerData.storeType || "Ø®Ø¯Ù…Ø§Øª Ø£Ø®Ø±Ù‰",
        })

        if (!result.success) {
          await signOut(auth)
          throw new Error("Failed to create store: " + result.error)
        }
      }

      return true
    } catch (error: any) {
      const code = error?.code as string | undefined
      if (code === "auth/email-already-in-use") {
        setError(t("Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ù…Ø³Ø¬Ù„ Ø¨Ø§Ù„ÙØ¹Ù„", "Email already registered"))
        throw new Error("already registered")
      }

      console.error("[v0] Registration error:", error)
      setError(t("ÙØ´Ù„ Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ø­Ø³Ø§Ø¨. ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© Ø£Ø®Ø±Ù‰.", "Account creation failed. Please try again."))
      throw error
    }
  }, [auth, db, t])

  const logout = useCallback(async () => {
    await signOut(auth)
    setUser(null)
    setFirebaseUser(null)
  }, [auth])

  const contextValue = useMemo(
    () => ({ user, firebaseUser, login, register, logout, isLoading, error }),
    [user, firebaseUser, login, register, logout, isLoading, error],
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
