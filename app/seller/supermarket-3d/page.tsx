"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { useAuth } from "../../../lib/auth-context"
import { useLanguage } from "../../../lib/language-context"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Box, LayoutGrid, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "../../../components/ui/button"
import { getStoreByUserId } from "../../../lib/actions/stores"
import { initialProducts, initialShelves, sections } from "../../../lib/mock/supermarket-data"

// Dashboard components
import SectionsPanel from "../../../components/dashboard/SectionsPanel"
import ShelfManager from "../../../components/dashboard/ShelfManager"
import ProductModal from "../../../components/dashboard/ProductModal"
import AddShelfModal from "../../../components/dashboard/AddShelfModal"
import { useProductStore } from "../../../lib/stores/product-store"
import { getProductsByStoreId } from "../../../lib/actions/products"
import { getSupermarketLayout } from "../../../lib/actions/layout"
import { Product, SectionType } from "../../../lib/types/product-management"

export default function Supermarket3DPage() {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const { t } = useLanguage()
    const {
        setSelectedSection,
        selectedSectionId,
        setProducts,
        setShelves,
        setPlacements,
        setStoreId
    } = useProductStore()
    const [isCheckingStore, setIsCheckingStore] = useState(true)
    const [accessDenied, setAccessDenied] = useState(false)

    useEffect(() => {
        if (isLoading) return;

        if (!user) {
            router.push("/auth?role=seller")
            return;
        }

        async function verifyAccess() {
            if (user?.role === "seller") return;

            const store = await getStoreByUserId(user!.id);
            if (!store) {
                router.push("/")
            }
        }

        verifyAccess();

        async function checkStoreAndLoadProducts() {
            if (user?.id) {
                try {
                    const store = await getStoreByUserId(user.id) as any;
                    if (store) {
                        setStoreId(store.id);

                        const category = store.category?.toLowerCase();
                        const isSupermarket = category === 'supermarket' || category === 'grocery' || category === 'بقالة' || category === 'أغذية';

                        if (!isSupermarket) {
                            setAccessDenied(true)
                        } else {
                            // Fetch real products from database
                            console.log("Fetching products for store:", store.id);
                            const realProducts = await getProductsByStoreId(store.id);
                            console.log("Real products fetched:", realProducts.length);

                            // Map real products to 3D layout format
                            const mappedProducts: Product[] = realProducts.map((p: any) => ({
                                id: p.id,
                                nameAR: p.name || "",
                                nameEN: p.name_en || p.name || "",
                                category: (p.category?.toUpperCase() as SectionType) || 'GROCERY',
                                shape: 'box',
                                dimensions: [0.2, 0.3, 0.2],
                                color: '#ffffff',
                                textureURL: p.image_url,
                                price: p.price || 0,
                            }));

                            setProducts(mappedProducts);

                            // Load saved layout
                            console.log("Loading layout for store:", store.id);
                            const layoutResult = await getSupermarketLayout(store.id);

                            if (layoutResult.success && layoutResult.data) {
                                console.log("Found saved layout");
                                if (layoutResult.data.shelves && layoutResult.data.shelves.length > 0) {
                                    setShelves(layoutResult.data.shelves);
                                } else {
                                    setShelves(initialShelves);
                                }

                                if (layoutResult.data.placements) {
                                    setPlacements(layoutResult.data.placements);
                                }
                            } else {
                                console.log("No saved layout found, using defaults");
                                setShelves(initialShelves);
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error checking store and loading products:", error)
                } finally {
                    setIsCheckingStore(false)
                }
            }
        }

        if (user?.id) {
            checkStoreAndLoadProducts()
        }
    }, [user, isLoading, router, setProducts, setShelves, setPlacements, setStoreId])

    if (isLoading || isCheckingStore) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1F478B]"></div>
            </div>
        )
    }

    if (accessDenied) {
        return (
            <div className="flex min-h-screen bg-[#F1F5F9]">
                <SellerHeader />
                <main className="flex-1 p-8 flex items-center justify-center">
                    <Card className="max-w-md w-full border-none shadow-2xl">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                                <Box className="w-10 h-10 text-amber-500" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-gray-900">
                                {t("المحاكي غير متاح", "Simulator Not Available")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-center space-y-6">
                            <p className="text-gray-600">
                                {t(
                                    "عذراً، المحاكي ثلاثي الأبعاد مصمم حالياً ليناسب تجربة السوبر ماركت وبقالة المواد الغذائية فقط.",
                                    "Sorry, the 3D simulator is currently designed specifically for Supermarkets and Grocery stores."
                                )}
                            </p>
                            <Button asChild className="w-full bg-[#1F478B] hover:bg-[#1a3a70]">
                                <Link href="/seller/dashboard">
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                    {t("العودة للوحة التحكم", "Back to Dashboard")}
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </main>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-[#F8FAFC]">
            <SellerHeader />

            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                            <LayoutGrid className="w-5 h-5 text-[#1F478B]" />
                        </div>
                        <h1 className="text-lg font-bold text-gray-900">
                            {t("تخطيط السوبر ماركت", "Supermarket Layout")}
                        </h1>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Sidebar: Sections */}
                    <div className="w-80 border-l border-gray-100 bg-white flex flex-col shrink-0">
                        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                            <h2 className="font-bold text-gray-900">{t("أقسام المتجر", "Store Sections")}</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <SectionsPanel />
                        </div>
                    </div>

                    {/* Main Content Area: Shelf Manager */}
                    <div className="flex-1 bg-[#F8FAFC] overflow-y-auto p-8 pb-20">
                        {selectedSectionId ? (
                            <ShelfManager />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center">
                                    <LayoutGrid className="w-10 h-10 text-blue-200" />
                                </div>
                                <div className="max-w-xs">
                                    <h2 className="text-xl font-bold text-gray-900 mb-2">ابدأ التنظيم</h2>
                                    <p className="text-gray-500">اختر أحد أقسام المتجر من القائمة الجانبية لبدء إدارة وتوزيع المنتجات على الرفوف.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <ProductModal />
                <AddShelfModal />
            </main>
        </div>
    )
}
