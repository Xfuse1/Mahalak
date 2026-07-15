# Mahalak (محلّك) — Product Requirements & E2E Test Spec

> Ready-to-upload PRD for TestSprite. Covers the **Customer** and **Seller** journeys.
> (You can delete this file after the test — it is not part of the app.)

## Overview
Mahalak is an Arabic, right-to-left (RTL) e-commerce marketplace for Egypt with
**Cash on Delivery (COD)**. Built with Next.js (App Router) + Firebase.
Two primary roles: **Customer (عميل)** and **Seller / Merchant (تاجر)**.
Authentication uses **Firebase Phone OTP**.

## Environment
- Base URL: `http://localhost:3000`
- UI language: Arabic (RTL)
- Payment: Cash on Delivery (الدفع عند الاستلام / COD)

## Test Credentials (Firebase test phone numbers — fixed OTP, no real SMS, reCAPTCHA bypassed)
- Customer phone: `01000000000` — OTP: `123456`
- Seller phone: `01000000001` — OTP: `123456`
- Password rule: at least 6 characters, must include a letter and a number.
- Email must be unique per registration (generate a fresh unique email each run).

## Roles & Key Pages
- Customer: `/`, `/auth/register`, `/auth/verify-phone`, store/product pages, `/checkout`, `/checkout/delivery`, `/account`
- Seller: `/auth/seller/register`, `/auth/seller/login`, `/seller/dashboard`, `/seller/products`, `/seller/products/new`

## User Journeys (each numbered step is an acceptance check)

### A. Customer journey
1. Open the home page (`/`) and see stores/products.
2. Go to `/auth/register`. Register a new customer: full name, unique email,
   strong password (≥6 chars incl. a letter and a number), phone `01000000000`. Submit.
3. Complete phone OTP verification (`/auth/verify-phone`) with code `123456`.
4. Browse stores/products and open a product detail page.
5. Click **Add to cart (أضف للسلة)**, then go to cart / checkout (`/checkout`).
6. Enter a delivery address, choose a driver, and confirm the order as **Cash on Delivery**.
   Expect an order-success message.
7. Open `/account` and confirm the order appears in the order history.

### B. Seller journey
8. Log out, then open seller registration (`/auth/seller/register`).
9. Create a new seller account with store info (store name, description,
   type/category, phone `01000000001`) and complete OTP `123456`.
10. Log in as the seller and open the seller dashboard (`/seller/dashboard`).
11. Add a new product (`/seller/products/new`): name, **selling price**,
    **cost/purchase price (lower than selling price)**, quantity, category, image if possible. Save.
12. Confirm the product appears in the seller's product list (`/seller/products`).

## Arabic UI labels the automation should target
- إنشاء حساب / تسجيل الدخول / تسجيل الخروج (Register / Login / Logout)
- رمز التحقق / تأكيد الكود (OTP / Verify code)
- أضف للسلة / السلة / إتمام الشراء / الدفع (Add to cart / Cart / Checkout)
- عنوان التوصيل / اختيار السائق (Delivery address / Choose driver)
- تأكيد الطلب / الدفع عند الاستلام (Confirm order / Cash on delivery)
- حسابي / طلباتي (My account / My orders)
- إضافة منتج / سعر البيع / سعر الشراء / الكمية / الفئة (Add product / Selling price / Cost price / Quantity / Category)

## Acceptance criteria
- Every journey step completes without a blocking error.
- The order confirmation is shown and the order is listed under `/account`.
- The new product is listed under `/seller/products`.

## Automation notes
- Phone auth uses Firebase test numbers that bypass reCAPTCHA and real SMS — just type the fixed OTP `123456`.
- The email/password test-account field is NOT used for login here; login is phone-OTP based.
