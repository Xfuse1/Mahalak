import { Product, Shelf, SectionInfo, SectionType } from "../types/product-management";

export const sections: SectionInfo[] = [
    { id: 'BAKERY', nameAR: 'المخبز', nameEN: 'Bakery', icon: '🥖', color: '#FFB74D' },
    { id: 'PRODUCE', nameAR: 'الخضروات والفواكه', nameEN: 'Fresh Produce', icon: '🥬', color: '#7EC850' },
    { id: 'DAIRY', nameAR: 'الألبان والأجبان', nameEN: 'Dairy & Cheese', icon: '🥛', color: '#81D4FA' },
    { id: 'MEAT', nameAR: 'اللحوم والأسماك', nameEN: 'Meat & Seafood', icon: '🥩', color: '#E85D75' },
    { id: 'BEAUTY', nameAR: 'الصحة والجمال', nameEN: 'Health & Beauty', icon: '💄', color: '#F06292' },
    { id: 'GROCERY', nameAR: 'البقالة', nameEN: 'Grocery', icon: '🛒', color: '#FFCC80' },
    { id: 'DRINKS', nameAR: 'المشروبات والوجبات الخفيفة', nameEN: 'Drinks & Snacks', icon: '🥤', color: '#4A90E2' },
    { id: 'CLEANING', nameAR: 'المنظفات والورقيات', nameEN: 'Cleaning', icon: '🧹', color: '#4CAF50' },
    { id: 'CHECKOUT', nameAR: 'منطقة المحاسبة', nameEN: 'Checkout', icon: '💳', color: '#FFD54F' },
];

export const initialProducts: Product[] = [
    // Produce
    { id: 'apple_red', nameAR: 'تفاح أحمر', nameEN: 'Red Apple', category: 'PRODUCE', shape: 'sphere', dimensions: [0.18], color: '#d32f2f', price: 4.5, pattern: 'circle' },
    { id: 'banana', nameAR: 'موز طازج', nameEN: 'Fresh Banana', category: 'PRODUCE', shape: 'capsule', dimensions: [0.08, 0.4], color: '#ffeb3b', price: 3.0, pattern: 'curve' },
    { id: 'orange', nameAR: 'برتقال', nameEN: 'Orange', category: 'PRODUCE', shape: 'sphere', dimensions: [0.18], color: '#ff9800', price: 5.5, pattern: 'circle' },
    { id: 'cucumber', nameAR: 'خيار', nameEN: 'Cucumber', category: 'PRODUCE', shape: 'cylinder', dimensions: [0.06, 0.6], color: '#2e7d32', price: 2.5, pattern: 'stripe' },
    { id: 'tomato', nameAR: 'طماطم', nameEN: 'Tomato', category: 'PRODUCE', shape: 'sphere', dimensions: [0.18], color: '#e53935', price: 3.5, pattern: 'circle' },

    // Bakery
    { id: 'bread_samoon', nameAR: 'خبز صمون', nameEN: 'Samoon Bread', category: 'BAKERY', shape: 'box', dimensions: [0.32, 0.48, 0.22], color: '#ffcc80', price: 2.0, pattern: 'stripe' },
    { id: 'croissant', nameAR: 'كرواسون', nameEN: 'Croissant', category: 'BAKERY', shape: 'box', dimensions: [0.32, 0.48, 0.22], color: '#e6a15c', price: 4.0, pattern: 'curve' },
    { id: 'chocolate_cake', nameAR: 'كيكة شوكولاتة', nameEN: 'Chocolate Cake', category: 'BAKERY', shape: 'cylinder', dimensions: [0.35, 0.25], color: '#4e342e', price: 25.0, pattern: 'block' },

    // Dairy
    { id: 'milk_almarai', nameAR: 'حليب المراعي', nameEN: 'Almarai Milk', category: 'DAIRY', shape: 'box', dimensions: [0.25, 0.6, 0.25], color: '#1e88e5', price: 6.5, pattern: 'stripe' },
    { id: 'yogurt', nameAR: 'زبادي طازج', nameEN: 'Fresh Yogurt', category: 'DAIRY', shape: 'box', dimensions: [0.32, 0.48, 0.22], color: '#ffffff', price: 2.0, pattern: 'circle' },

    // Meat
    { id: 'beef', nameAR: 'لحم بقري', nameEN: 'Beef', category: 'MEAT', shape: 'box', dimensions: [0.32, 0.48, 0.22], color: '#b71c1c', price: 45.0, pattern: 'block' },
    { id: 'chicken', nameAR: 'دجاج طازج', nameEN: 'Fresh Chicken', category: 'MEAT', shape: 'box', dimensions: [0.32, 0.48, 0.22], color: '#fff9c4', price: 18.0, pattern: 'curve' },

    // Groceries
    { id: 'rice_basmati', nameAR: 'أرز بسمتي', nameEN: 'Basmati Rice', category: 'GROCERY', shape: 'box', dimensions: [0.32, 0.48, 0.22], color: '#fff9c4', price: 40.0, pattern: 'grain' },
    { id: 'olive_oil', nameAR: 'زيت زيتون', nameEN: 'Olive Oil', category: 'GROCERY', shape: 'cylinder', dimensions: [0.18, 0.55], color: '#afb42b', price: 22.0, pattern: 'drop' },

    // Drinks
    { id: 'pepsi', nameAR: 'بيبسي', nameEN: 'Pepsi', category: 'DRINKS', shape: 'cylinder', dimensions: [0.18, 0.55], color: '#1565c0', price: 3.0, pattern: 'circle' },
    { id: 'cola', nameAR: 'كوكاكولا', nameEN: 'Coca Cola', category: 'DRINKS', shape: 'cylinder', dimensions: [0.18, 0.55], color: '#b71c1c', price: 3.0, pattern: 'curve' },
];

export const initialShelves: Shelf[] = [
    { shelfId: 'BAKERY_COUNTER_01', sectionEN: 'BAKERY', sectionAR: 'قسم المخبز', type: 'glass_counter', position: { x: -20, y: 0.6, z: 42 }, rotation: { x: 0, y: 0, z: 0 }, capacity: 10 },
    { shelfId: 'PRODUCE_TABLE_01', sectionEN: 'PRODUCE', sectionAR: 'الخضروات والفواكه', type: 'slanted_table', position: { x: -15, y: 0.4, z: 20 }, rotation: { x: -0.2, y: 0, z: 0 }, capacity: 15 },
    { shelfId: 'DAIRY_FRIDGE_01', sectionEN: 'DAIRY', sectionAR: 'الألبان والأجبان', type: 'open_fridge', position: { x: -28, y: 1.5, z: 0 }, rotation: { x: 0, y: Math.PI / 2, z: 0 }, capacity: 20 },
    { shelfId: 'MEAT_COUNTER_01', sectionEN: 'MEAT', sectionAR: 'اللحوم والأسماك', type: 'glass_counter', position: { x: 0, y: 0.55, z: -45 }, rotation: { x: 0, y: 0, z: 0 }, capacity: 12 },
    { shelfId: 'GROCERY_SHELF_01', sectionEN: 'GROCERY', sectionAR: 'البقالة', type: 'traditional_shelf', position: { x: -10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, capacity: 30 },
];
