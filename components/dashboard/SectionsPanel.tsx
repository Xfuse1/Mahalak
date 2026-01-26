"use client";

import React from 'react';
import { useProductStore } from '../../lib/stores/product-store';
import { sections } from '../../lib/mock/supermarket-data';
import { cn } from '../../lib/utils';
import { Shelf, Placement, SectionInfo } from '../../lib/types/product-management';

export default function SectionsPanel() {
    const { shelves, placements, selectedSectionId, setSelectedSection } = useProductStore();

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
                                ? "bg-[#1F478B] text-white shadow-lg"
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
                            <div className="font-bold text-sm">{section.nameAR}</div>
                            <div className={cn(
                                "text-[10px]",
                                isActive ? "text-blue-100" : "text-gray-400"
                            )}>
                                {sectionShelves.length} رف | {productCount} منتج
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
