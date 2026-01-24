"use client";

import React from 'react';
import { useProductStore } from '@/lib/stores/product-store';
import { sections } from '@/lib/mock/supermarket-data';
import SectionsPanel from './SectionsPanel';
import ShelfManager from './ShelfManager';
import ProductLibrary from './ProductLibrary';
import { Button } from '@/components/ui/button';
import { X, Search, Package, LayoutGrid } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function Dashboard() {
    const {
        selectedSectionId,
        isDashboardOpen,
        toggleDashboard
    } = useProductStore();

    if (!isDashboardOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-[#0a0a0a]/95 backdrop-blur-md flex flex-col font-sans" dir="rtl">
            {/* Header */}
            <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#111]">
                <div className="flex items-center gap-4">
                    <div className="bg-[#4A90E2] p-2 rounded-lg">
                        <LayoutGrid className="text-white w-6 h-6" />
                    </div>
                    <h1 className="text-xl font-bold text-white">لوحة التحكم في السوبرماركت</h1>
                </div>

                <div className="flex-1 max-w-md mx-8">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder="بحث عن منتج أو رف..."
                            className="bg-[#1a1a1a] border-white/10 text-white pr-10 focus:border-[#4A90E2]"
                        />
                    </div>
                </div>

                <Button
                    variant="ghost"
                    onClick={() => toggleDashboard(false)}
                    className="text-gray-400 hover:text-white"
                >
                    <X className="w-6 h-6" />
                </Button>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Sections */}
                <aside className="w-80 border-l border-white/10 bg-[#111] flex flex-col">
                    <SectionsPanel />
                </aside>

                {/* Center Area: Shelf or Product Details */}
                <main className="flex-1 overflow-y-auto p-8 bg-[#0a0a0a]">
                    {selectedSectionId ? (
                        <ShelfManager />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                            <Package className="w-16 h-16 opacity-20" />
                            <p className="text-lg">من فضلك اختر قسماً من القائمة الجانبية للبدء</p>
                        </div>
                    )}
                </main>

                {/* Right Area: Product Library (Optional side panel or alternate view) */}
                <aside className="w-96 border-r border-white/10 bg-[#111] overflow-y-auto">
                    <ProductLibrary />
                </aside>
            </div>

            {/* Footer */}
            <footer className="h-10 border-t border-white/10 bg-[#111] px-6 flex items-center justify-between text-xs text-gray-500">
                <div className="flex gap-4">
                    <span>عدد الأقسام: {sections.length}</span>
                    <span>إجمالي الرفوف: X</span>
                </div>
                <div>
                    <span>نظام إدارة المحاكي v1.0</span>
                </div>
            </footer>
        </div>
    );
}
