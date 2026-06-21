"use client";

import React from 'react';
import { useProductStore } from '../../lib/stores/product-store';
import { sections } from '../../lib/mock/supermarket-data';
import { useLanguage } from '../../lib/language-context';
import { cn } from '../../lib/utils';
import { Shelf, Placement, SectionInfo } from '../../lib/types/product-management';

export default function SectionsPanel() {
    const { shelves, placements, selectedSectionId, setSelectedSection } = useProductStore();
    const { t, language } = useLanguage();

    const getProductCountForSection = (sectionId: string) => {
        return placements.filter((p: Placement) => {
            const shelf = shelves.find((s: Shelf) => s.shelfId === p.shelfId);
            return shelf?.sectionEN === sectionId;
        }).length;
    };

    return (
        <div className="flex flex-col space-y-2">
            {sections.map((section: SectionInfo) => {
                const isActive = selectedSectionId === section.id;
                const productCount = getProductCountForSection(section.id);
                const sectionShelves = shelves.filter((s: Shelf) => s.sectionEN === section.id);

                return (
                    <button
                        key={section.id}
                        onClick={() => setSelectedSection(section.id)}
                        className={cn(
                            "w-full flex items-center gap-3 p-4 rounded-xl transition-all text-right",
                            isActive
                                ? "bg-primary text-white shadow-lg"
                                : "hover:bg-gray-50 text-gray-600"
                        )}
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center text-xl",
                            isActive ? "bg-white/20" : "bg-gray-100"
                        )}>
                            {section.icon}
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-sm">
                                {language === 'en' ? section.nameEN : section.nameAR}
                            </div>
                            <div className={cn(
                                "text-[10px]",
                                isActive ? "text-primary-foreground/80" : "text-gray-400"
                            )}>
                                {sectionShelves.length} {t("رف", "shelves")} | {productCount} {t("منتج", "products")}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
