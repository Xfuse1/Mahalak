"use client"

import { Input } from "./ui/input"
import { Label } from "./ui/label"
import type { FoodDetails } from "../lib/ai/food-details"

export function FoodDetailsFields({ value, onChange }: { value: FoodDetails | null; onChange: (value: FoodDetails | null) => void }) {
  return <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4" dir="rtl">
    <legend className="px-2 font-bold">بيانات الأكل للبحث الذكي</legend>
    <Label className="flex items-center gap-2"><input type="checkbox" checked={value !== null} onChange={(e) => onChange(e.target.checked ? { kind: "ingredient", protein: "none", pack_unit: "g" } : null)} />المنتج غذائي وأقدر أحدّد كميته</Label>
    {value && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="space-y-1">نوع المنتج<select className="h-10 w-full rounded-lg border border-border bg-background px-3" value={value.kind} onChange={(e) => onChange(e.target.value === "meal" ? { kind: "meal", protein: "vegetarian", servings: 1 } : { kind: "ingredient", protein: "none", pack_unit: "g" })}><option value="ingredient">مكوّن للطبخ / عبوة غذائية</option><option value="meal">وجبة جاهزة كاملة</option></select></Label>
        <Label className="space-y-1">البروتين<select className="h-10 w-full rounded-lg border border-border bg-background px-3" value={value.protein} onChange={(e) => onChange({ ...value, protein: e.target.value as FoodDetails["protein"] })}>
          {value.kind === "ingredient" && <option value="none">بدون بروتين رئيسي</option>}<option value="chicken">فراخ</option><option value="meat">لحوم</option><option value="fish">سمك</option><option value="egg">بيض</option><option value="vegetarian">نباتي</option>
        </select></Label>
      </div>
      {value.kind === "meal" ? <Label className="block space-y-1">الوجبة الكاملة تكفي كام فرد؟<Input type="number" min={1} max={50} step={1} required value={value.servings ?? ""} onChange={(e) => onChange({ ...value, servings: Number(e.target.value) })} /><span className="text-xs text-muted-foreground">عدد حصص وجبة كاملة للأفراد البالغين، مش عدد قطع الأكل. سجّل محتوياتها في وصف المنتج.</span></Label> : <div className="grid grid-cols-2 gap-3">
        <Label className="space-y-1">كمية العبوة المباعة<Input type="number" min={0.01} max={100000} step="any" required value={value.pack_quantity ?? ""} onChange={(e) => onChange({ ...value, pack_quantity: Number(e.target.value) })} /></Label>
        <Label className="space-y-1">الوحدة<select className="h-10 w-full rounded-lg border border-border bg-background px-3" value={value.pack_unit} onChange={(e) => onChange({ ...value, pack_unit: e.target.value as FoodDetails["pack_unit"] })}><option value="g">جرام</option><option value="ml">ملليلتر</option><option value="piece">قطعة</option></select></Label>
      </div>}
      <p className="text-xs text-muted-foreground">اكتب حجم العبوة اللي سعرها ظاهر للعميل؛ مثل 1000 جرام للكيلو أو 30 قطعة لكرتونة البيض. البيانات دي بتحدد كميات وسعر السلة.</p>
    </>}
  </fieldset>
}
