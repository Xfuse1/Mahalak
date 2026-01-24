"use client";

import React, { useState } from 'react';
import { useProductStore } from '@/lib/stores/product-store';
import { sections } from '@/lib/mock/supermarket-data';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Plus, Package } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';

export default function ProductLibrary() {
    const { products } = useProductStore();
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProducts = products.filter(p =>
        p.nameAR.includes(searchTerm) ||
        p.nameEN.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">مكتبة المنتجات المتاحة</h2>
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        placeholder="بحث عن منتج..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white border-gray-200 pr-10 focus:border-[#1F478B] h-9 text-sm shadow-sm"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-white">
                {filteredProducts.map((product) => (
                    <div
                        key={product.id}
                        className="p-3 bg-white border border-gray-100 rounded-xl hover:border-[#1F478B]/30 hover:shadow-sm transition-all flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center border border-gray-100 overflow-hidden shadow-inner bg-gray-50"
                                style={{ backgroundColor: `${product.color}15` }}
                            >
                                <Package className="w-5 h-5" style={{ color: product.color }} />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-gray-800">{product.nameAR}</div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{product.category}</span>
                                    <span className="text-[10px] text-[#2e7d32] font-mono font-bold">{product.price.toFixed(2)} EGP</span>
                                </div>
                            </div>
                        </div>

                        <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-50 hover:bg-[#1F478B] hover:text-white rounded-full w-8 h-8 shadow-sm">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                ))}

                {filteredProducts.length === 0 && (
                    <div className="py-12 text-center text-gray-400">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">لم يتم العثور على منتجات</p>
                    </div>
                )}
            </div>

            <div className="p-4 bg-gray-50/50 border-t border-gray-100">
                <Button className="w-full bg-white border border-gray-200 hover:bg-[#1F478B] hover:text-white text-gray-700 text-xs h-10 shadow-sm font-semibold transition-all">
                    إضافة منتج جديد للمكتبة
                </Button>
            </div>
        </div>
    );
}
