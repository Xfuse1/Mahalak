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
import { getStoreByUserId, type Store } from "../../../lib/actions/stores"
import { initialProducts, initialShelves, sections } from "../../../lib/mock/supermarket-data"

// Dashboard components - lazy loaded
import dynamic from "next/dynamic"
const SectionsPanel = dynamic(() => import("../../../components/dashboard/SectionsPanel"), {
  ssr: false, loading: () => <div className="animate-pulse bg-gray-100 rounded-lg h-64" />
})
const ShelfManager = dynamic(() => import("../../../components/dashboard/ShelfManager"), {
  ssr: false, loading: () => <div className="animate-pulse bg-gray-100 rounded-lg h-64" />
})
const ProductModal = dynamic(() => import("../../../components/dashboard/ProductModal"), { ssr: false })
const AddShelfModal = dynamic(() => import("../../../components/dashboard/AddShelfModal"), { ssr: false })
import { useProductStore } from "../../../lib/stores/product-store"
import { getProductsByStoreId } from "../../../lib/actions/products"
import { getSupermarketLayout } from "../../../lib/actions/layout"
import { Placement, Product, SectionType } from "../../../lib/types/product-management"
import { logError } from "../../../lib/logger"

type StoreCatalogProduct = {
    id: string
    name?: string
    name_en?: string
    category?: string
    simulator_section?: string
    image_url?: string
    price?: number
    stores?: {
        name?: string
    }
}

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

        async function checkStoreAndLoadProducts() {
            if (user?.id) {
                try {
                    const store: Store | null = await getStoreByUserId(user.id);
                    if (store) {
                        setStoreId(store.id);

                        const category = store.category?.toLowerCase();
                        const isSupermarket = category === 'supermarket' || category === 'grocery' || category === 'بقالة' || category === 'أغذية';

                        if (!isSupermarket) {
                            setAccessDenied(true)
                        } else {
                            const realProductsResponse = await getProductsByStoreId(store.id);
                            const realProducts: StoreCatalogProduct[] = Array.isArray(realProductsResponse)
                                ? (realProductsResponse as StoreCatalogProduct[])
                                : [];

                            // Map real products to 3D layout format
                            const mappedProducts: Product[] = realProducts.map((p: StoreCatalogProduct) => ({
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

                            // Use initial shelves
                            setShelves(initialShelves);

                            // Auto-generate placements based on product categories
                            const categoryToSectionMap: Record<string, string> = {
                                'بقالة': 'GROCERY',
                                'صحة': 'BEAUTY',
                                'ملابس': 'GROCERY', // fallback
                                'إلكترونيات': 'GROCERY', // fallback
                                'أغذية': 'GROCERY',
                                'أثاث': 'GROCERY', // fallback
                                'خدمات أخرى': 'GROCERY', // fallback
                                'grocery': 'GROCERY',
                                'health': 'BEAUTY',
                                'clothing': 'GROCERY',
                                'electronics': 'GROCERY',
                                'food': 'GROCERY',
                                'furniture': 'GROCERY',
                                'bakery': 'BAKERY',
                                'dairy': 'DAIRY',
                                'produce': 'PRODUCE',
                                'meat': 'MEAT',
                                'drinks': 'DRINKS',
                                'cleaning': 'CLEANING',
                                'beauty': 'BEAUTY',
                            };

                            // Group products by their simulator_section or mapped section
                            const productsBySection: Record<string, Product[]> = {};
                            mappedProducts.forEach((product) => {
                                const realProduct = realProducts.find((p: StoreCatalogProduct) => p.id === product.id);
                                // Prioritize simulator_section from database, then fall back to category mapping
                                const simulatorSection = realProduct?.simulator_section;
                                const dbCategory = (realProduct?.category || '').toLowerCase();
                                const section = simulatorSection || categoryToSectionMap[dbCategory] || product.category || 'GROCERY';
                                if (!productsBySection[section]) {
                                    productsBySection[section] = [];
                                }
                                productsBySection[section].push(product);
                            });

                            // Generate placements for each product on appropriate shelves
                            const autoPlacements: Placement[] = [];
                            const shelvesData = initialShelves;

                            Object.entries(productsBySection).forEach(([section, products]) => {
                                // Find shelves for this section
                                const sectionShelves = shelvesData.filter(s => s.sectionEN === section);
                                if (sectionShelves.length === 0) {
                                    // Use GROCERY shelf as fallback
                                    const fallbackShelf = shelvesData.find(s => s.sectionEN === 'GROCERY');
                                    if (fallbackShelf) sectionShelves.push(fallbackShelf);
                                }

                                products.forEach((product, idx) => {
                                    const shelf = sectionShelves[idx % sectionShelves.length];
                                    if (!shelf) return;

                                    // Calculate position on shelf (spread products across shelf)
                                    const positionIndex = autoPlacements.filter(p => p.shelfId === shelf.shelfId).length;
                                    const xOffset = (positionIndex % 5) * 0.5 - 1;
                                    const zOffset = Math.floor(positionIndex / 5) * 0.4;

                                    autoPlacements.push({
                                        placementId: `auto_${product.id}_${Date.now()}_${idx}`,
                                        shelfId: shelf.shelfId,
                                        productId: product.id,
                                        position: { x: xOffset, y: 0.15, z: zOffset },
                                        rotation: { x: 0, y: 0, z: 0 },
                                        quantity: 3,
                                    });
                                });
                            });

                            setPlacements(autoPlacements);
                        }
                    } else {
                        router.push("/")
                        return
                    }
                } catch (error) {
                    logError("Error checking store and loading products:", error)
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
                <main className="flex-1 pt-16 lg:pt-0 p-8 flex items-center justify-center">
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
                                    <ArrowRight className="ms-2 h-5 w-5" />
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

            <main className="flex-1 flex flex-col h-screen overflow-hidden pt-16 lg:pt-0">
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
                    <div className="w-80 border-s border-gray-100 bg-white flex flex-col shrink-0">
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
                                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                                        {t("\u0627\u0628\u062F\u0623 \u0627\u0644\u062A\u0646\u0638\u064A\u0645", "Start Organizing")}
                                    </h2>
                                    <p className="text-gray-500">
                                        {t(
                                            "\u0627\u062E\u062A\u0631 \u0623\u062D\u062F \u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0629 \u0644\u0628\u062F\u0621 \u0625\u062F\u0627\u0631\u0629 \u0648\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0631\u0641\u0648\u0641.",
                                            "Choose a store section from the sidebar to start managing and distributing products on shelves.",
                                        )}
                                    </p>
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
