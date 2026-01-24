"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "@/components/seller-header"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Box, Layers, Package, LayoutGrid, Eye } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

// Import our new dashboard components
import SectionsPanel from "@/components/dashboard/SectionsPanel"
import ShelfManager from "@/components/dashboard/ShelfManager"
import ProductLibrary from "@/components/dashboard/ProductLibrary"
import ProductModal from "@/components/dashboard/ProductModal"
import { useProductStore } from "@/lib/stores/product-store"

export default function Supermarket3DPage() {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const { t } = useLanguage()
    const { setSelectedSection, selectedSectionId, toggleDashboard } = useProductStore()

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/auth?role=seller")
        }
        if (user?.role !== "seller") {
            router.push("/")
        }
        // Set initial dashboard state to "open" conceptually for this page
        toggleDashboard(true)
    }, [user, isLoading, router, toggleDashboard])

    if (isLoading || !user || user.role !== "seller") {
        return null
    }

    return (
        <div className="flex min-h-screen bg-secondary">
            <SellerHeader />

            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Header Section */}
                <header className="p-6 border-b border-gray-200 flex items-center justify-between bg-white shadow-sm">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3 text-[#1F478B]">
                            <Box className="text-[#1F478B]" />
                            {t("إدارة السوبرماركت 3D", "3D Supermarket Management")}
                        </h1>
                        <p className="text-gray-600 text-sm mt-1">تحكم في الرفوف والمنتجات وتوزيعها في المحاكي</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button asChild className="bg-[#1F478B] hover:bg-[#1a3a70]">
                            <Link href="/supermarket" target="_blank">
                                <Eye className="ml-2 h-4 w-4" />
                                {t("عرض السوبرماركت 3D", "View 3D Supermarket")}
                            </Link>
                        </Button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Side Navigation (Sections) */}
                    <aside className="w-80 border-l border-gray-200 bg-white flex flex-col">
                        <SectionsPanel />
                    </aside>

                    {/* Main Workspace */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-secondary">
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {selectedSectionId ? (
                                <ShelfManager />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center space-y-6 text-center text-gray-400">
                                    <div className="p-8 rounded-full bg-white border border-gray-200 mb-4 shadow-sm scale-125">
                                        <LayoutGrid className="w-16 h-16 text-gray-300" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-700">مرحباً بك في مدير السوبرماركت</h2>
                                        <p className="text-gray-500 max-w-md mx-auto mt-2 text-sm">
                                            اختر قسماً من القائمة الجانبية لإدارة محتوياته وتوزيع المنتجات على الرفوف
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel (Product Library) */}
                    <aside className="w-96 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
                        <ProductLibrary />
                    </aside>
                </div>
                <ProductModal />
            </main>
        </div>
    )
}
