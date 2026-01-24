"use client";

import React from 'react';
import { useProductStore } from '@/lib/stores/product-store';
import { initialProducts } from '@/lib/mock/supermarket-data';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Package, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ProductModal() {
    const {
        isModalOpen,
        toggleModal,
        selectedShelfId,
        placements,
        removeProductFromShelf,
        addProductToShelf,
        products
    } = useProductStore();

    const shelfPlacements = placements.filter(p => p.shelfId === selectedShelfId);

    // Get details for products currently on shelf
    const currentShelfProducts = shelfPlacements.map(p => ({
        ...p,
        product: products.find(prod => prod.id === p.productId)
    }));

    if (!isModalOpen) return null;

    return (
        <Dialog open={isModalOpen} onOpenChange={(open) => toggleModal(open)}>
            <DialogContent className="max-w-2xl bg-white border-gray-200 text-gray-900 shadow-2xl" dir="rtl">
                <DialogHeader className="border-b border-gray-100 pb-4 mb-4">
                    <DialogTitle className="text-xl flex items-center gap-3 text-[#1F478B]">
                        <Package className="text-[#1F478B] w-6 h-6" />
                        إدارة منتجات الرف: {selectedShelfId}
                    </DialogTitle>
                    <DialogDescription className="text-gray-500 font-medium">
                        أضف أو احذف المنتجات المعروضة على هذا الرف
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4 h-[450px]">
                    {/* Current Products on Shelf */}
                    <div className="flex flex-col border-l border-gray-100 pr-2">
                        <h3 className="text-xs font-bold mb-4 text-gray-400 uppercase tracking-wider">المنتجات المعروضة حالياً</h3>
                        <ScrollArea className="flex-1 pr-4">
                            <div className="space-y-3">
                                {currentShelfProducts.map((item) => (
                                    <div key={item.placementId} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl hover:bg-gray-100 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-10 h-10 rounded-lg border border-gray-200 shadow-inner flex items-center justify-center bg-white"
                                                style={{ backgroundColor: `${item.product?.color}10` }}
                                            >
                                                <Package className="w-5 h-5" style={{ color: item.product?.color }} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-700">{item.product?.nameAR}</span>
                                                <span className="text-[10px] text-gray-400 font-mono italic">{item.product?.price} EGP</span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeProductFromShelf(item.placementId)}
                                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full w-8 h-8 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                                {currentShelfProducts.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2 opacity-50">
                                        <Package className="w-12 h-12 stroke-[1px]" />
                                        <span className="text-sm">الرف فارغ حالياً</span>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Quick Add from Category */}
                    <div className="flex flex-col pl-2">
                        <h3 className="text-xs font-bold mb-4 text-gray-400 uppercase tracking-wider">إضافة منتجات للمتجر</h3>
                        <ScrollArea className="flex-1 pr-4">
                            <div className="space-y-3">
                                {products.map((product) => (
                                    <button
                                        key={product.id}
                                        onClick={() => addProductToShelf(selectedShelfId!, product.id)}
                                        className="w-full flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:bg-blue-50/50 hover:border-[#1F478B]/30 transition-all group shadow-sm active:scale-95"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-10 h-10 rounded-lg border border-gray-200 shadow-inner flex items-center justify-center bg-gray-50 group-hover:bg-white"
                                                style={{ backgroundColor: `${product.color}15` }}
                                            >
                                                <Package className="w-5 h-5" style={{ color: product.color }} />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="text-sm font-bold text-gray-700">{product.nameAR}</span>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{product.category}</span>
                                            </div>
                                        </div>
                                        <Plus className="w-5 h-5 text-gray-300 group-hover:text-[#1F478B] transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                    <Button variant="ghost" onClick={() => toggleModal(false)} className="text-gray-500 hover:bg-gray-100 font-semibold px-6">
                        إلغاء
                    </Button>
                    <Button className="bg-[#1F478B] hover:bg-[#1a3a70] text-white px-8 font-bold shadow-lg shadow-blue-900/10">
                        حفظ ومزامنة
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
