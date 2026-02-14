"use client";

import React from 'react';
import { useProductStore } from '../../lib/stores/product-store';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Trash2, Plus, Package, X } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useLanguage } from '../../lib/language-context';
import { Product, Shelf, Placement } from '../../lib/types/product-management';
import { saveSupermarketLayout } from '../../lib/actions/layout';

export default function ProductModal() {
    const {
        isModalOpen,
        toggleModal,
        selectedShelfId,
        products,
        shelves,
        placements,
        addProductToShelf,
        removeProductFromShelf,
        storeId
    } = useProductStore();
    const { t } = useLanguage();

    const currentShelf = shelves.find((s: Shelf) => s.shelfId === selectedShelfId);
    const shelfProducts = placements.filter((p: Placement) => p.shelfId === selectedShelfId);

    return (
        <Dialog open={isModalOpen} onOpenChange={toggleModal}>
            <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col">
                <div className="flex flex-col h-full" dir="rtl">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl font-bold text-gray-900 text-right">
                                {t("\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0631\u0641:", "Manage Shelf:")} {selectedShelfId}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-gray-500 text-right">
                                {t("تخصيص المنتجات المعروضة على هذا الرف", "Manage products displayed on this shelf")}
                            </DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => toggleModal(false)}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden min-h-0">
                        {/* Current Products */}
                        <div className="flex flex-col border-s border-gray-100 bg-gray-50/30">
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/50">
                                <span className="text-sm font-bold text-gray-700">{t("المنتجات الحالية", "Current Products")}</span>
                                <span className="text-xs text-gray-400">{shelfProducts.length} / {currentShelf?.capacity || 0}</span>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="p-4 space-y-3">
                                    {shelfProducts.map((item: Placement) => {
                                        const product = products.find((p: Product) => p.id === item.productId);
                                        return (
                                            <div key={item.placementId} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                                                        {product?.textureURL ? (
                                                            <img src={product.textureURL} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Package className="w-5 h-5 text-gray-400" />
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-gray-900 line-clamp-1">{product?.nameAR || product?.nameEN}</p>
                                                        <p className="text-[10px] text-gray-400">ID: {item.placementId.split('_').pop()}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeProductFromShelf(item.placementId)}
                                                    className="text-gray-400 hover:text-red-500 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                    {shelfProducts.length === 0 && (
                                        <div className="text-center py-10 text-gray-400 italic text-sm">
                                            {t("لا توجد منتجات بعد", "No products yet")}
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Inventory Browse */}
                        <div className="flex flex-col min-h-0">
                            {/* Inventory Explore Title Area */}
                            <div className="p-4 border-b border-gray-100 bg-white/50">
                                <span className="text-sm font-bold text-gray-700">{t("قائمة المنتجات", "Product List")}</span>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="p-4 space-y-3">
                                    {products.map((product: Product) => (
                                        <button
                                            key={product.id}
                                            onClick={() => addProductToShelf(selectedShelfId!, product.id)}
                                            disabled={shelfProducts.length >= (currentShelf?.capacity || 0)}
                                            className="w-full flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-[#1F478B] hover:shadow-md transition-all group disabled:opacity-50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden group-hover:bg-blue-50 transition-colors">
                                                    {product.textureURL ? (
                                                        <img src={product.textureURL} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Package className="w-5 h-5 text-gray-400 group-hover:text-[#1F478B]" />
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-gray-900 line-clamp-1">{product.nameAR || product.nameEN}</p>
                                                    <p className="text-[10px] text-gray-400 capitalize">{product.category}</p>
                                                </div>
                                            </div>
                                            <div className="p-1.5 bg-gray-50 rounded-lg text-gray-400 group-hover:bg-[#1F478B] group-hover:text-white transition-all">
                                                <Plus className="w-4 h-4" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3 rounded-b-lg">
                        <Button
                            variant="outline"
                            onClick={() => toggleModal(false)}
                            className="bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        >
                            {t("إلغاء", "Cancel")}
                        </Button>
                        <Button
                            onClick={() => {
                                if (storeId) {
                                    saveSupermarketLayout(storeId, shelves, placements, storeId);
                                }
                                toggleModal(false);
                            }}
                            className="bg-[#1F478B] hover:bg-[#1a3d75] text-white px-8"
                        >
                            {t("تأكيد", "Confirm")}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
