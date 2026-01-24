"use client";

import React from 'react';
import { useProductStore } from '@/lib/stores/product-store';
import { sections } from '@/lib/mock/supermarket-data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Layers, Settings2, PlusCircle } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';

export default function ShelfManager() {
    const { selectedSectionId, shelves, setSelectedShelf, toggleModal, placements } = useProductStore();
    const { t } = useLanguage();

    const currentSection = sections.find(s => s.id === selectedSectionId);
    const sectionShelves = shelves.filter(s => s.sectionEN === selectedSectionId);

    const getProductCount = (shelfId: string) => {
        return placements.filter(p => p.shelfId === shelfId).length;
    };

    if (!currentSection) return null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <span className="text-4xl">{currentSection.icon}</span>
                        {currentSection.nameAR}
                    </h2>
                    <p className="text-gray-500 mt-1 font-medium italic">{currentSection.nameEN} SECTION • {sectionShelves.length} {t("رفوف", "Shelves")}</p>
                </div>

                <Button className="bg-[#1F478B] hover:bg-[#1a3a70] text-white gap-2 px-6 shadow-md transition-all active:scale-95">
                    <PlusCircle className="w-5 h-5" />
                    {t("إضافة رف جديد", "Add New Shelf")}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sectionShelves.map((shelf) => (
                    <Card key={shelf.shelfId} className="bg-white border-gray-200 hover:border-[#1F478B]/50 transition-all group shadow-sm hover:shadow-md">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-blue-50 transition-colors border border-gray-100">
                                    <Layers className="w-6 h-6 text-[#1F478B]" />
                                </div>
                                <div className="text-[10px] font-mono font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                    {shelf.shelfId}
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-800 mb-2">
                                {getShelfTypeName(shelf.type)}
                            </h3>

                            <div className="flex items-center gap-6 mt-6 pb-6 border-b border-gray-50 text-sm">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t("السعة", "Capacity")}</span>
                                    <span className="font-bold text-gray-700">{shelf.capacity} {t("منتج", "Units")}</span>
                                </div>
                                <div className="h-8 w-px bg-gray-100" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t("المنتجات الحالية", "Current")}</span>
                                    <span className="font-bold text-[#1F478B]">{getProductCount(shelf.shelfId)}</span>
                                </div>
                            </div>

                            <div className="mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedShelf(shelf.shelfId);
                                        toggleModal(true);
                                    }}
                                    className="w-full border-gray-200 text-gray-600 hover:bg-[#1F478B] hover:text-white hover:border-[#1F478B] transition-all gap-2 font-semibold h-11 shadow-sm"
                                >
                                    <Settings2 className="w-4 h-4" />
                                    {t("إدارة المنتجات", "Manage Products")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function getShelfTypeName(type: string) {
    const types: Record<string, string> = {
        'wooden_table': 'طاولة خشبية',
        'slanted_table': 'طاولة مائلة',
        'open_fridge': 'ثلاجة عرض مفتوحة',
        'glass_counter': 'كاونتر زجاجي',
        'traditional_shelf': 'رف تقليدي',
        'glass_shelf': 'رف زجاجي فاخر'
    };
    return types[type] || type;
}
