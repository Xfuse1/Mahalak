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
import { createStore, uploadStoreImage, updateStore } from "./actions/stores"
import { getFirebaseAuth, getFirestoreClient } from "./firebase/client"

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
      storeLogo?: File | null
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
    // Force reload if requested or if loading is not in progress
    loadingProfile.current = true
    setIsLoading(true)

    try {
      const profileRef = doc(db, "users", currentUser.uid)
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
          street: profile.street ?? profile.address_street ?? profile.address ?? undefined,
          city: profile.city ?? profile.address_city ?? undefined,
          state: profile.state ?? profile.address_state ?? undefined,
          country: profile.country ?? undefined,
          address: profile.address ?? undefined,
        })
      } else {
        console.warn("[v0] No profile found for user:", currentUser.uid)
        setUser(null)
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
      const profileRef = doc(db, "users", credential.user.uid)
      const profileSnap = await getDoc(profileRef)
      const profileData = profileSnap.exists() ? profileSnap.data() : null

      if (profileSnap.exists()) {
        const profileRole = (profileData?.role as "customer" | "seller") || "customer"
        if (profileRole !== role) {
          await signOut(auth)
          throw new Error("Invalid role for this account type")
        }
      } else {
        // Create profile if it doesn't exist
        const now = new Date().toISOString()
        await setDoc(profileRef, {
          email,
          full_name: credential.user.displayName || email.split("@")[0],
          role: role,
          created_at: now,
          updated_at: now,
        })
      }

      // Manually trigger profile load to ensure state is updated immediately
      await loadUserProfile(credential.user)
      return true
    } catch (error: any) {
      const code = error?.code as string | undefined
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        throw new Error("Invalid login credentials")
      }
      throw error
    }
  }, [auth, db, loadUserProfile])

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

      await setDoc(doc(db, "users", credential.user.uid), profileData)

      if (role === "seller" && credential.user && sellerData?.storeName) {
        const result = await createStore({
          seller_id: credential.user.uid,
          name: sellerData.storeName,
          description: sellerData.storeDescription || "",
          address: sellerData.address || "",
          phone: sellerData.phone || "",
          category: sellerData.storeType || "خدمات أخرى",
        })

        if (result.success && sellerData.storeLogo) {
          const storeId = result.data.id
          const formData = new FormData()
          formData.append("file", sellerData.storeLogo)
          formData.append("storeId", storeId)

          const uploadRes = await uploadStoreImage(formData)
          if (uploadRes.success && uploadRes.url) {
            await updateStore(storeId, { image_url: uploadRes.url })
          }
        }
        if (!result.success) {
          await signOut(auth)
          throw new Error("Failed to create store: " + result.error)
        }
      }

      // Manually trigger profile load to ensure state is updated immediately
      await loadUserProfile(credential.user)
      return true
    } catch (error: any) {
      const code = error?.code as string | undefined
      if (code === "auth/email-already-in-use") {
        setError(t("البريد الإلكتروني مسجل بالفعل", "Email already registered"))
        throw new Error("already registered")
      }

      console.error("[v0] Registration error:", error)
      setError(t("فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.", "Account creation failed. Please try again."))
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
