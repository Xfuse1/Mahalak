"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { createStore } from "@/lib/actions/stores"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

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
  supabaseUser: SupabaseUser | null
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
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const loadingProfile = useRef(false)
  const router = useRouter()
  const { t } = useTranslation()
  const [role, setRole] = useState<"customer" | "seller">("customer") // Declare the role variable

  const supabase = createClient()

  const loadUserProfile = useCallback(async (userId: string) => {
    if (loadingProfile.current) return
    loadingProfile.current = true

    try {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single()

      if (profile) {
        setUser({
          id: profile.id,
          email: profile.email,
          name: profile.full_name || profile.email.split("@")[0],
          role: profile.role,
          phone: profile.phone,
          // normalize possible DB column names into the user object
          street: profile.street ?? profile.address_street ?? profile.address ?? undefined,
          city: profile.city ?? profile.address_city ?? undefined,
          state: profile.state ?? profile.address_state ?? undefined,
          country: profile.country ?? undefined,
          address: profile.address ?? undefined,
        })
      }
    } catch (error) {
      console.error("[v0] Error loading user profile:", error)
    } finally {
      setIsLoading(false)
      loadingProfile.current = false
    }
  }, [supabase])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseUser(session.user)
        loadUserProfile(session.user.id)
      } else {
        setIsLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user)
        if (!loadingProfile.current) {
          loadUserProfile(session.user.id)
        }
      } else {
        setSupabaseUser(null)
        setUser(null)
        setIsLoading(false)
        loadingProfile.current = false
      }
    })

    return () => subscription.unsubscribe()
  }, [loadUserProfile, supabase.auth])

  const login = useCallback(async (email: string, password: string, role: "customer" | "seller"): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data.user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single()

        if (profile?.role !== role) {
          await supabase.auth.signOut()
          throw new Error("Invalid role for this account type")
        }

        return true
      }

      return false
    } catch (error: any) {
      throw error
    }
  }, [supabase])

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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role,
            phone: sellerData?.phone,
            street,
            city,
            country,

          },
        },
      })

      if (error) {
        console.error("[v0] Supabase signUp error:", error)
        const message = (error as any)?.message ?? String(error)
        if (message.includes("already registered") || message.includes("User already registered")) {
          setError(t("البريد الإلكتروني مسجل بالفعل", "Email already registered"))
        } else {
          setError(t("فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.", "Account creation failed. Please try again."))
        }
        return false
      }

      if (role === "seller" && data.user && sellerData?.storeName) {
        console.log("[v0] Creating store for seller:", data.user.id)

        const result = await createStore({
          seller_id: data.user.id,
          name: sellerData.storeName,
          description: sellerData.storeDescription || "",
          address: sellerData.address || "",
          phone: sellerData.phone || "",
          category: sellerData.storeType || "خدمات أخرى",
        })

        if (!result.success) {
          console.error("[v0] Error creating store:", result.error)
          throw new Error("Failed to create store: " + result.error)
        }

        console.log("[v0] Store created successfully:", result.data)
      }

      if (data.user) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          console.log("[v0] Auto sign-in after registration failed:", signInError.message)
        }
      }

      return true
    } catch (error: any) {
      console.error("[v0] Registration error:", error)
      const message = error?.message ?? String(error)
      if (message.includes("already registered") || message.includes("User already registered")) {
        setError(t("البريد الإلكتروني مسجل بالفعل", "Email already registered"))
      } else {
        setError(t("فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.", "Account creation failed. Please try again."))
      }
      return false
    }
  }, [supabase, t])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSupabaseUser(null)
  }, [supabase])

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string
    const street = formData.get("street") as string
    const city = formData.get("city") as string
    const country = formData.get("country") as string

    let sellerData
    if (role === "seller") {
      const phone = formData.get("phone") as string
      const storeName = formData.get("storeName") as string
      const storeDescription = formData.get("storeDescription") as string
      const address = formData.get("address") as string
      const storeType = formData.get("storeType") as string

      if (!phone || !storeName || !address || !storeType) {
        setError(t("يرجى ملء جميع الحقول المطلوبة", "Please fill all required fields"))
        setIsLoading(false)
        return
      }

      sellerData = { phone, storeName, storeDescription, address, storeType }
    }

    if (password !== confirmPassword) {
      setError(t("كلمات المرور غير متطابقة", "Passwords do not match"))
      setIsLoading(false)
      return
    }

    try {
      const success = await register(email, password, name, role, sellerData, street, city, country)

      if (success) {
        router.push(role === "seller" ? "/seller/dashboard" : "/")
      }
    } catch (error: any) {
      if (error.message?.includes("already registered")) {
        setError(t("البريد الإلكتروني مسجل بالفعل", "Email already registered"))
      } else {
        setError(t("فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.", "Account creation failed. Please try again."))
      }
    }

    setIsLoading(false)
  }

  const contextValue = useMemo(
    () => ({ user, supabaseUser, login, register, logout, isLoading, error }),
    [user, supabaseUser, login, register, logout, isLoading, error]
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
