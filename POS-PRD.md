# Mahalak POS System - Product Requirements Document

## Overview
Mahalak POS (Point of Sale) is a web-based cashier system built for multi-type retail stores. It runs at `/pos/qpos` and provides a full-featured checkout experience with store-type-specific features.

## Authentication & Access
- Login via email/password (Firebase Auth)
- Only store owners (sellers) can access POS
- Test credentials: `cveeez1@OUTLOOK.COM` / `CV20259`
- After login, navigate to `/pos/qpos`

## Core POS Features

### 1. Product Management & Cart
- Products loaded from store's Firestore inventory
- Grid display with product image, name, price
- Click product to add to cart (quantity increments on repeat click)
- Cart shows: item name, quantity, unit price, line total
- Quantity adjustment (+/-) in cart
- Remove individual items from cart
- Clear entire cart
- Real-time cart total calculation

### 2. Barcode Scanner
- Camera-based barcode scanning
- Scans EAN-13, UPC-A, Code128 barcodes
- Auto-adds scanned product to cart
- Manual barcode entry fallback

### 3. Search & Filter
- Real-time product search by name
- Category-based filtering
- Voice search (Arabic speech recognition)

### 4. Payment & Checkout
- Cash payment with change calculation
- Card payment option
- Split payment (cash + card combination)
- Custom split amounts
- Receipt generation after sale
- WhatsApp receipt sharing
- Sale saved to Firestore with full details

### 5. Hold Cart (تعليق الفاتورة)
- Hold current cart for later retrieval
- Add note/reason when holding
- View list of all held carts
- Resume any held cart
- Delete held carts
- Held carts stored in Firestore under `stores/{storeId}/held_carts`

### 6. Customer Management (إدارة العملاء)
- Search customers by phone number
- Create new customer with: name, phone, email, notes
- Link customer to current sale
- Customer purchase history tracking
- Total purchases and visit count auto-updated after each sale
- Customer data stored in `stores/{storeId}/pos_customers`

### 7. Returns & Refunds (المرتجعات)
- Search previous sales by sale ID
- View sale details for return
- Select specific items to return (partial return)
- Choose return type: refund or exchange
- Refund methods: cash or card
- Return reason required
- Inventory auto-restocked on return
- Return record stored in `stores/{storeId}/pos_returns`

### 8. Shift Management (إدارة الورديات)
- Open shift with starting cash amount
- Track sales count and total during shift
- Close shift with ending cash amount
- Cash difference calculation (expected vs actual)
- Close notes for discrepancies
- Shift data stored in `stores/{storeId}/pos_shifts`
- Only one active shift at a time

### 9. Coupons & Discounts (الكوبونات)
- Create coupons: percentage or fixed amount
- Set coupon code, discount value, expiry date
- Optional usage limit per coupon
- Apply coupon at checkout by entering code
- Validate coupon (expired, used up, etc.)
- Toggle coupon active/inactive status
- View all coupons with status
- Coupon usage tracked per sale
- Data stored in `stores/{storeId}/pos_coupons`

## Pharmacy-Specific Features (مميزات الصيدلية)
These features appear only when store category contains "صحة", "صيدل", "pharmacy", or "health".

### 10. Expiry Date Tracking (تتبع الصلاحية)
- Header button "الصلاحية" shows expiry alerts
- Products with expiry < 30 days marked CRITICAL (red)
- Products with expiry < 90 days marked WARNING (orange)
- Expired products BLOCKED from sale (cannot checkout)
- Near-expiry products show warning before sale
- Batch expiry checking during checkout
- Expiry badge shown on product cards

### 11. Prescription Management (إدارة الروشتات)
- Mark products as prescription-required (Rx)
- Rx badge shown on product cards
- When Rx product is in cart, prescription modal opens before sale
- Record prescription: doctor name, patient name, phone, diagnosis
- Link prescription items to sale
- Search prescriptions by patient name or phone
- View prescription history
- Data stored in `stores/{storeId}/prescriptions`

### 12. Insurance Claims (التأمين الصحي)
- Manage insurance companies (add, toggle active/inactive)
- Select insurance company at checkout
- Enter policy number and coverage percentage
- Auto-calculate copay amount (customer pays)
- Insurance claim auto-created after successful sale
- View insurance claims with status
- Update claim status (pending → approved → paid / rejected)
- Data stored in `stores/{storeId}/insurance_claims`

### 13. Drug Alternatives (البدائل الدوائية)
- "بدائل" button on pharmacy product cards
- Search alternatives by active ingredient
- View alternative drugs with: name, manufacturer, price, availability
- Quick-add alternative to cart

### 14. Pharmacy Product Editing
- "دوائي" button on product cards for pharmacy data
- Edit fields: active ingredient, manufacturer, requires prescription, expiry date
- Save pharmacy-specific fields to product record

## UI Layout
- **Header bar**: Store name, shift info, action buttons (held carts, customers, returns, shifts, coupons + pharmacy buttons)
- **Left panel (70%)**: Product grid with search/filter bar
- **Right panel (30%)**: Cart with totals and payment buttons
- **Modals**: Each feature opens in a dialog/modal overlay
- **RTL support**: Full Arabic right-to-left layout
- **Responsive**: Works on tablet and desktop screens

## Data Model
All POS data is stored under `stores/{storeId}/` in Firestore:
- `held_carts` - Held cart documents
- `pos_customers` - Customer records
- `pos_returns` - Return/refund records
- `pos_shifts` - Shift records
- `pos_coupons` - Coupon definitions
- `prescriptions` - Prescription records (pharmacy)
- `insurance_companies` - Insurance company list (pharmacy)
- `insurance_claims` - Insurance claim records (pharmacy)

## Tech Stack
- Next.js 16 + React 19 + TypeScript
- Firebase Auth + Firestore
- Tailwind CSS + shadcn/ui components
- Lucide React icons
