"use client"

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react"
import { createBrowserClient } from "@supabase/ssr"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface User {
  id: string
  email: string
  name: string
  role: "customer" | "seller"
  phone?: string
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
    sellerData?: { phone?: string; storeName?: string; address?: string; storeType?: string },
  ) => Promise<boolean>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const loadingProfile = useRef(false)

  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null)
  if (!supabaseRef.current) {
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  const supabase = supabaseRef.current

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
  }, [])

  const loadUserProfile = async (userId: string) => {
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
        })
      }
    } catch (error) {
      console.error("[v0] Error loading user profile:", error)
    } finally {
      setIsLoading(false)
      loadingProfile.current = false
    }
  }

  const login = async (email: string, password: string, role: "customer" | "seller"): Promise<boolean> => {
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
  }

  const register = async (
    email: string,
    password: string,
    name: string,
    role: "customer" | "seller",
    sellerData?: { phone?: string; storeName?: string; address?: string; storeType?: string },
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
          },
        },
      })

      if (error) throw error

      if (role === "seller" && data.user && sellerData?.storeName) {
        await supabase.from("stores").insert({
          seller_id: data.user.id,
          name: sellerData.storeName,
          address: sellerData.address,
          phone: sellerData.phone,
          category: sellerData.storeType || "خدمات أخرى",
        })
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
      throw error
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSupabaseUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, supabaseUser, login, register, logout, isLoading }}>
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
