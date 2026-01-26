import { create } from 'zustand';
import { Product, Shelf, Placement, SectionType } from '../types/product-management';
import { initialProducts, initialShelves } from '../mock/supermarket-data';

interface ProductState {
    products: Product[];
    shelves: Shelf[];
    placements: Placement[];
    selectedSectionId: SectionType | null;
    selectedShelfId: string | null;
    isDashboardOpen: boolean;
    isModalOpen: boolean;
    isAddShelfModalOpen: boolean;
    searchQuery: string;
    storeId: string | null;

    // Actions
    setStoreId: (id: string) => void;
    setProducts: (products: Product[]) => void;
    setShelves: (shelves: Shelf[]) => void;
    setPlacements: (placements: Placement[]) => void;
    setSelectedSection: (sectionId: SectionType | null) => void;
    setSelectedShelf: (shelfId: string | null) => void;
    setSearchQuery: (query: string) => void;
    toggleDashboard: (isOpen?: boolean) => void;
    toggleModal: (isOpen?: boolean) => void;
    toggleAddShelfModal: (isOpen?: boolean) => void;

    addProductToShelf: (shelfId: string, productId: string) => void;
    addShelf: (shelf: Omit<Shelf, 'shelfId' | 'position' | 'rotation'>) => void;
    removeProductFromShelf: (placementId: string) => void;
    updateProduct: (product: Product) => void;
}

export const useProductStore = create<ProductState>((set) => ({
    products: [],
    shelves: [],
    placements: [],
    selectedSectionId: null,
    selectedShelfId: null,
    isDashboardOpen: false,
    isModalOpen: false,
    isAddShelfModalOpen: false,
    searchQuery: '',
    storeId: null,

    setStoreId: (storeId) => set({ storeId }),
    setProducts: (products) => set({ products }),
    setShelves: (shelves) => set({ shelves }),
    setPlacements: (placements) => set({ placements }),
    setSelectedSection: (selectedSectionId) => set({ selectedSectionId, selectedShelfId: null }),
    setSelectedShelf: (selectedShelfId) => set({ selectedShelfId }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    toggleDashboard: (isOpen) => set((state) => ({
        isDashboardOpen: isOpen !== undefined ? isOpen : !state.isDashboardOpen
    })),
    toggleModal: (isOpen) => set((state) => ({
        isModalOpen: isOpen !== undefined ? isOpen : !state.isModalOpen
    })),
    toggleAddShelfModal: (isOpen) => set((state) => ({
        isAddShelfModalOpen: isOpen !== undefined ? isOpen : !state.isAddShelfModalOpen
    })),

    addProductToShelf: (shelfId, productId) => set((state) => {
        const newPlacement: Placement = {
            placementId: `placement_${Date.now()}`,
            shelfId,
            productId,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            quantity: 1,
        };
        return { placements: [...state.placements, newPlacement] };
    }),

    addShelf: (shelfData) => set((state) => {
        const newShelf: Shelf = {
            ...shelfData,
            shelfId: `${shelfData.type.toUpperCase()}_${Date.now()}`,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
        };
        return { shelves: [...state.shelves, newShelf] };
    }),

    removeProductFromShelf: (placementId) => set((state) => ({
        placements: state.placements.filter((p) => p.placementId !== placementId)
    })),

    updateProduct: (updatedProduct) => set((state) => ({
        products: state.products.map((p) => p.id === updatedProduct.id ? updatedProduct : p)
    })),
}));
