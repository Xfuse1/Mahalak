"use client";

import React from 'react';
import { useProductStore } from '../../lib/stores/product-store';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Layers, Settings, Plus, Package, Trash2 } from 'lucide-react';
import { useLanguage } from '../../lib/language-context';
import { cn } from '../../lib/utils';
import { Product, Shelf, Placement } from '../../lib/types/product-management';
import { sections } from '../../lib/mock/supermarket-data';
import { useConfirm } from '@/components/ui/confirm-dialog';

export default function ShelfManager() {
    const {
        selectedSectionId,
        shelves,
        setSelectedShelf,
        toggleModal,
        toggleAddShelfModal,
        placements,
        removeShelf
    } = useProductStore();
    const { t } = useLanguage();
    const confirmDialog = useConfirm();

    const currentSection = sections.find(s => s.id === selectedSectionId);
    const sectionShelves = shelves.filter((s: Shelf) => s.sectionEN === selectedSectionId);

    const getProductCount = (shelfId: string) => {
        return placements.filter((p: Placement) => p.shelfId === shelfId).length;
    };

    if (!currentSection) return null;

    const getShelfTypeName = (type: string) => {
        const names: Record<string, string> = {
            'glass_counter': t("طاولة عرض زجاجية", "Glass Display Counter"),
            'slanted_table': t("منصة عرض مائلة", "Slanted Produce Table"),
            'open_fridge': t("ثلاجة عرض مفتوحة", "Open Cooling Unit"),
            'traditional_shelf': t("رف جداري تقليدي", "Traditional Wall Shelf"),
            'checkout_counter': t("منصة المحاسبة", "Checkout Counter"),
            'glass_shelf': t("رف زجاجي", "Glass Shelf"),
            'wooden_table': t("طاولة خشبية", "Wooden Table")
        };
        return names[type] || t("منصة عرض", "Display Platform");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{currentSection.nameAR}</h2>
                    <p className="text-sm text-gray-500">{sectionShelves.length} {t("رف متوفر", "Shelves Available")}</p>
                </div>
                <Button
                    onClick={() => toggleAddShelfModal(true)}
                    className="bg-[#1F478B] hover:bg-[#1a3a70] text-white gap-2"
                >
                    <Plus className="w-4 h-4" />
                    {t("إضافة رف جديد", "Add New Shelf")}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sectionShelves.map((shelf: Shelf) => (
                    <Card key={shelf.shelfId} className="border-gray-100 hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-blue-50 rounded-xl">
                                    <Layers className="w-5 h-5 text-[#1F478B]" />
                                </div>
                                <span className="text-xs font-mono text-gray-400">{shelf.shelfId}</span>
                            </div>

                            <div className="mb-6">
                                <h3 className="font-bold text-lg text-gray-900">{getShelfTypeName(shelf.type)}</h3>
                                <p className="text-xs text-gray-400 capitalize">{shelf.type.replace('_', ' ')}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="text-center p-3 bg-gray-50 rounded-lg">
                                    <p className="text-[10px] text-gray-400 mb-1">{t("السعة", "Capacity")}</p>
                                    <p className="font-bold text-gray-900">{shelf.capacity}</p>
                                </div>
                                <div className="text-center p-3 bg-blue-50/50 rounded-lg">
                                    <p className="text-[10px] text-[#1F478B] mb-1">{t("المخزون", "In Stock")}</p>
                                    <p className="font-bold text-[#1F478B]">{getProductCount(shelf.shelfId)}</p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1 gap-2 border-gray-200 text-gray-600 hover:text-[#1F478B] hover:bg-blue-50"
                                    onClick={() => {
                                        setSelectedShelf(shelf.shelfId);
                                        toggleModal(true);
                                    }}
                                >
                                    <Settings className="w-4 h-4" />
                                    {t("إدارة المنتجات", "Manage Products")}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={async () => {
                                        const confirmed = await confirmDialog({
                                            title: t("حذف الرف", "Delete Shelf"),
                                            message: t("هل أنت متأكد من حذف هذا الرف؟", "Are you sure you want to delete this shelf?"),
                                            confirmText: t("حذف", "Delete"),
                                            cancelText: t("إلغاء", "Cancel"),
                                            variant: "danger",
                                        });
                                        if (confirmed) {
                                            removeShelf(shelf.shelfId);
                                        }
                                    }}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
