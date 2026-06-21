"use client";

import React, { useState } from 'react';
import { useProductStore } from '../../lib/stores/product-store';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Layers, X } from 'lucide-react';
import { useLanguage } from '../../lib/language-context';
import { saveSupermarketLayout } from '../../lib/actions/layout';
import { ShelfType } from '../../lib/types/product-management';
import { sections } from '../../lib/mock/supermarket-data';

export default function AddShelfModal() {
    const {
        isAddShelfModalOpen,
        toggleAddShelfModal,
        addShelf,
        selectedSectionId,
        storeId
    } = useProductStore();
    const { t } = useLanguage();

    const [capacity, setCapacity] = useState(10);

    const currentSection = sections.find(s => s.id === selectedSectionId);

    const getShelfTypeForSection = (sectionId: string): ShelfType => {
        switch (sectionId) {
            case 'BAKERY':
                return 'glass_counter';
            case 'PRODUCE':
                return 'slanted_table';
            case 'DAIRY':
                return 'open_fridge';
            case 'MEAT':
                return 'glass_counter';
            case 'BEAUTY':
                return 'glass_shelf';
            default:
                return 'traditional_shelf';
        }
    };

    const handleSubmit = () => {
        if (!selectedSectionId || !currentSection) return;

        addShelf({
            sectionEN: selectedSectionId,
            sectionAR: currentSection.nameAR,
            type: getShelfTypeForSection(selectedSectionId),
            capacity: capacity,
        });

        // Save layout to DB
        const { shelves, placements } = useProductStore.getState();
        if (storeId) {
            saveSupermarketLayout(storeId, shelves, placements, storeId);
        }

        toggleAddShelfModal(false);
    };

    return (
        <Dialog open={isAddShelfModalOpen} onOpenChange={toggleAddShelfModal}>
            <DialogContent className="max-w-md p-0 overflow-hidden" dir="rtl">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl font-bold text-gray-900 text-right">
                            {t("إضافة رف جديد", "Add New Shelf")}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-500 text-right">
                            {t("سيتم إضافة الرف المناسب للقسم الحالي تلقائياً", "Appropriate shelf for section will be added automatically")}
                        </DialogDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => toggleAddShelfModal(false)}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700 block text-right">
                            {t("السعة (عدد المنتجات)", "Capacity (Product Count)")}
                        </label>
                        <input
                            type="number"
                            value={capacity}
                            onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                            className="w-full p-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-right"
                            min="1"
                            max="100"
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => toggleAddShelfModal(false)}
                        className="text-gray-500 hover:bg-gray-100"
                    >
                        {t("إلغاء", "Cancel")}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-primary hover:bg-primary/90 text-white px-8"
                    >
                        {t("إضافة الرف", "Add Shelf")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
