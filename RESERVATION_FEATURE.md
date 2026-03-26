# ميزة الحجز المسبق للمنتجات

## ملخص التغييرات
تمت إضافة ميزة **الحجز المسبق** التي تسمح لأصحاب المتاجر بإضافة منتجات للحجز حتى لو لم يكن لديهم مخزون حالياً.

---

## 📋 التغييرات التقنية

### 1. **Database Schema**
- **Field جديد**: `reservation_enabled` (boolean)
  - Default: `false`
  - مكان التخزين: Collection `products`

### 2. **Backend Changes** (`lib/actions/products.ts`)

#### أ) ProductRecord Type
```typescript
type ProductRecord = {
  // ... existing fields
  reservation_enabled?: boolean
}
```

#### ب) createProduct Function
- **Updated validation**: يسمح بـ `stock = 0` عند تفعيل `reservation_enabled = true`
- **New parameter**: `reservation_enabled?: boolean`
- **Default value**: `false` (عدم التفعيل)

**قبل:**
```typescript
if (!stock || stock <= 0) {
  return { success: false, error: PRODUCT_ERROR_CODES.STOCK_MUST_BE_POSITIVE }
}
```

**بعد:**
```typescript
if (!Number.isFinite(stock) || stock < 0) {
  return { success: false, error: PRODUCT_ERROR_CODES.STOCK_MUST_BE_POSITIVE }
}
if (stock === 0 && !reservation_enabled) {
  return { success: false, error: PRODUCT_ERROR_CODES.STOCK_MUST_BE_POSITIVE }
}
```

#### ج) updateProduct Function
- نفس التحديثات الخاصة بـ validation
- يدعم تحديث `reservation_enabled`

### 3. **Frontend Changes**

#### أ) صفحة إنشاء المنتج (`app/seller/products/new/page.tsx`)
- **State بجديد**: `isReservationEnabled` 
- **UI Toggle**: Checkbox مع رسالة توضيحية
  - Label: "متاح للحجز المسبق"
  - Description: "فعّل هذا الخيار للسماح بالحجز حتى لو لم يكن لديك مخزون حالياً"
- **Validation update**: يسمح بـ `stock = 0` عند تفعيل التوجل
- **Min attribute change**: من `min="1"` إلى `min="0"`

**التوجل:**
```tsx
<div className="flex items-center gap-3 p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50">
  <input
    type="checkbox"
    checked={isReservationEnabled}
    onChange={(e) => setIsReservationEnabled(e.target.checked)}
  />
  <span>{t("متاح للحجز المسبق", "Available for Pre-Reservation")}</span>
</div>
```

#### ب) صفحة تعديل المنتج (`app/seller/products/edit/[id]/page.tsx`)
- نفس التحديثات كما في صفحة الإنشاء
- تحميل قيمة `reservation_enabled` من المنتج الموجود
- السماح بتعديل التوجل

---

## 🎯 السلوك المتوقع

### عند تفعيل الحجز المسبق:
1. ✅ النظام يقبل `stock = 0` بدون error
2. ✅ يتم حفظ `reservation_enabled = true` في الداتابيز
3. ✅ يظهر رسالة تأكيد على الفورم: "✓ الحجز المسبق مفعّل"

### عند عدم تفعيل الحجز:
1. ✅ السلوك الأصلي محفوظ
2. ✅ الكمية يجب أن تكون `> 0`
3. ✅ `reservation_enabled = false`

---

## 📝 ملاحظات متوافقية

### No Breaking Changes ✅
- جميع المنتجات القديمة ستحصل على `reservation_enabled: false` تلقائياً
- لا يوجد تأثير على الطلبات أو التقارير الموجودة
- الـ field جديد وليس إلزامي

### الدعم الكامل لجميع أنواع المتاجر
- صيدليات
- ملابس
- بقالات
- إلكترونيات
- متاجر عامة

---

## 🔄 الخطوات التالية (المقترحة)

### لتكامل كامل مع الواجهة الأمامية:
1. **عرض حالة الحجز على صفحة المنتج العامة**
   - قراءة `reservation_enabled` من الداتابيز
   - عرض رمز/شارة على المنتج
   - تغيير نص الزر: 
     - "أضف للسلة" (stock > 0)
     - "احجز الآن" (reservation_enabled && stock = 0)

2. **نموذج الحجز**
   - إنشاء صفحة لمعالجة طلبات الحجز
   - حفظ بيانات الزبون والمنتج والكمية
   - تنبيهات لصاحب المتجر عند وصول حجز

3. **إدارة الحجوزات في لوحة المتجر**
   - عرض قائمة الحجوزات المعلقة
   - خيارات التأكيد أو الإلغاء
   - إشعارات الزبائن

---

## 📂 الملفات المعدلة

1. **lib/actions/products.ts**
   - تحديث ProductRecord type
   - تحديث createProduct validation
   - تحديث updateProduct validation

2. **app/seller/products/new/page.tsx**
   - إضافة useState للحجز
   - إضافة toggle UI
   - تحديث validation
   - تحديث createProduct call

3. **app/seller/products/edit/[id]/page.tsx**
   - تحديث EditableProduct type
   - إضافة useState للحجز
   - تحديث form UI
   - تحديث updateProduct call

---

## ✅ قائمة التحقق

- [x] تحديث ProductRecord type
- [x] تحديث validation logic في createProduct
- [x] تحديث validation logic في updateProduct
- [x] إضافة toggle في صفحة الإنشاء
- [x] إضافة toggle في صفحة التعديل
- [x] تحديث UI مع رسائل واضحة (عربي + إنجليزي)
- [x] عدم وجود breaking changes
- [x] دعم جميع أنواع المتاجر
- [x] No lint/compile errors

---

**تم الإنجاز:** 26 مارس 2026
