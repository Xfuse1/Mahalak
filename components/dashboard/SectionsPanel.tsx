"use client";

import React from 'react';
import { useProductStore } from '@/lib/stores/product-store';
import { sections } from '@/lib/mock/supermarket-data';
import { cn } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react';

export default function SectionsPanel() {
    const { selectedSectionId, setSelectedSection } = useProductStore();

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">الأقسام الرئيسية</h2>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {sections.map((section) => (
                    <button
                        key={section.id}
                        onClick={() => setSelectedSection(section.id)}
                        className={cn(
                            "w-full flex items-center justify-between p-4 transition-all border-b border-gray-50",
                            "hover:bg-gray-50 active:bg-gray-100 text-right group",
                            selectedSectionId === section.id
                                ? "bg-blue-50/50 border-r-4 border-[#1F478B]"
                                : "bg-transparent"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm border border-gray-100 bg-white"
                                style={{ color: section.color }}
                            >
                                {section.icon}
                            </div>
                            <div>
                                <div className={cn(
                                    "font-bold text-sm",
                                    selectedSectionId === section.id ? "text-[#1F478B]" : "text-gray-700"
                                )}>
                                    {section.nameAR}
                                </div>
                                <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                                    {section.nameEN}
                                </div>
                            </div>
                        </div>

                        <ChevronLeft className={cn(
                            "w-4 h-4 transition-transform",
                            selectedSectionId === section.id ? "text-[#1F478B] translate-x-1" : "text-gray-300 group-hover:text-gray-400"
                        )} />
                    </button>
                ))}
            </div>
        </div>
    );
}
