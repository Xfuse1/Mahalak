"use client"

import { useState } from "react"
import Image from "next/image"
import { MapPin, Navigation, ShoppingCart, Store, Utensils } from "lucide-react"
import { MapPicker } from "./map-picker"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
import { imgSrc } from "../lib/storage/public-url"
import { useUserLocation } from "../lib/location/user-location"
import { shoppingRequest, type ShoppingPreferences, type ShoppingLocation, type FoodMode, type Protein } from "../lib/ai/shopping-request"
import type { AiBasket, AiSearchSuccess } from "../lib/actions/ai-search"

export function ShoppingControls({ query, result, pending, onApply }: { query: string; result: AiSearchSuccess | null; pending: boolean; onApply: (preferences: ShoppingPreferences) => void }) {
  const local = shoppingRequest(query)
  const req = result?.shopping?.request ?? local
  const { coords, requestLocation, status } = useUserLocation()
  const [location, setLocation] = useState<ShoppingLocation | null>(null)
  const [useGps, setUseGps] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [people, setPeople] = useState<string | null>(null)
  const [budget, setBudget] = useState<string | null>(null)
  const [mode, setMode] = useState<FoodMode | null>(null)
  const [protein, setProtein] = useState<Protein | null>(null)
  const [radius, setRadius] = useState(10)
  const [pantry, setPantry] = useState(false)
  const [driver, setDriver] = useState("")
  const selectedLocation = useGps ? coords : location ?? req.location ?? coords
  const peopleText = people ?? String(req.people ?? "")
  const budgetText = budget ?? String(req.budget ?? "")
  return <Card className="mb-5 border-border"><CardContent className="space-y-4 p-5">
    <h2 className="font-bold">نظبط الاختيارات على طلبك</h2>
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onApply({ people: peopleText ? Number(peopleText) : undefined, budget: budgetText ? Number(budgetText) : undefined,
      foodMode: mode ?? req.foodMode, protein: protein ?? req.protein, radiusKm: radius, pantryBasics: pantry, location: selectedLocation, driverId: driver || undefined }) }}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Label className="space-y-1">العدد الإجمالي<Input type="number" min={1} max={50} step={1} value={peopleText} onChange={(e) => setPeople(e.target.value)} placeholder="شامل أصحاب البيت" /></Label>
        <Label className="space-y-1">الميزانية شاملة التوصيل<Input type="number" min={1} max={100000} step="any" value={budgetText} onChange={(e) => setBudget(e.target.value)} placeholder="جنيه مصري" /></Label>
        <Label className="space-y-1">نوع الاختيارات<select className="h-10 w-full rounded-lg border border-border bg-background px-2" value={mode ?? req.foodMode} onChange={(e) => setMode(e.target.value as FoodMode)}><option value="both">جاهز ومكونات طبخ</option><option value="ready">وجبات جاهزة</option><option value="cook">مكونات للطبخ</option></select></Label>
        <Label className="space-y-1">البروتين<select className="h-10 w-full rounded-lg border border-border bg-background px-2" value={protein ?? req.protein} onChange={(e) => setProtein(e.target.value as Protein)}><option value="any">أي نوع</option><option value="animal">أي بروتين حيواني</option><option value="chicken">فراخ</option><option value="meat">لحوم</option><option value="fish">سمك</option><option value="egg">بيض</option><option value="vegetarian">نباتي</option></select></Label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => { setUseGps(true); requestLocation() }} disabled={status === "loading"} className="gap-2"><Navigation className="h-4 w-4" />{status === "loading" ? "بنحدد موقعك…" : "استخدم موقعي"}</Button>
        <Button type="button" variant="outline" onClick={() => setMapOpen(true)} className="gap-2"><MapPin className="h-4 w-4" />اختار عنوان التوصيل</Button>
        <span className="text-sm text-muted-foreground">{selectedLocation ? "عنوان التوصيل محدد" : "حدّد الموقع لحساب القرب والتوصيل"}</span>
        <Label className="flex items-center gap-2">في نطاق<select className="h-10 rounded-lg border border-border bg-background px-2" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>{[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n} كم</option>)}</select></Label>
      </div>
      {status === "denied" && <p className="text-sm text-destructive">تعذّر تحديد موقعك. تقدر تختار عنوان التوصيل على الخريطة.</p>}
      {(mode ?? req.foodMode) !== "ready" && <Label className="flex items-center gap-2"><input type="checkbox" checked={pantry} onChange={(e) => setPantry(e.target.checked)} />عندي زيت وملح وفلفل أسود، ما تضيفهمش للشراء</Label>}
      {!!result?.shopping?.drivers.length && <Label className="block space-y-1">سائق التوصيل<select className="h-10 w-full rounded-lg border border-border bg-background px-3" value={driver} onChange={(e) => setDriver(e.target.value)}><option value="">اختار السائق لحساب الإجمالي</option>{result.shopping.drivers.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.price.toFixed(2)} ج توصيل</option>)}</select></Label>}
      <Button type="submit" disabled={pending}>{pending ? "بندور في المتاح…" : "حدّث الاختيارات"}</Button>
    </form>
    <MapPicker open={mapOpen} onClose={() => setMapOpen(false)} onLocationSelect={(lat, lng) => { setLocation({ lat, lng }); setUseGps(false) }} initialLat={selectedLocation?.lat} initialLng={selectedLocation?.lng} />
  </CardContent></Card>
}

export function MealCard({ basket, busy, onChoose }: { basket: AiBasket; busy: boolean; onChoose: (basket: AiBasket, checkout: boolean) => void }) {
  const money = (n: number) => `${n.toFixed(2)} ج`
  return <Card className="border-border"><CardContent className="space-y-4 p-5">
    <div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold"><Utensils className="h-5 w-5 text-primary" />{basket.title}</h2><p className="mt-1 text-sm text-muted-foreground">{basket.meal_type === "ready" ? "وجبة جاهزة" : "مكونات للطبخ"} · لـ{basket.people} أفراد</p></div><p className="text-xl font-extrabold text-primary">{money(basket.total ?? basket.subtotal)}</p></div>
    <p className="flex items-center gap-2 text-sm text-muted-foreground"><Store className="h-4 w-4" />{basket.store_names.join("، ")} · {basket.distance_km?.toFixed(1)} كم {basket.store_ids.length > 1 ? "لأبعد متجر" : "عن العنوان"}</p>
    <div className="space-y-2">{basket.groups.flatMap((g) => g.matches).map((line) => line.product && <div key={line.product.id} className="flex items-center gap-3 rounded-lg bg-secondary/30 p-2">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg"><Image src={imgSrc(line.product.image_url)} alt={line.product.name} fill sizes="48px" className="object-cover" /></div><div className="min-w-0 flex-1"><p className="font-medium">{line.product.name} × {line.quantity ?? 1}</p><p className="text-xs text-muted-foreground">{line.concept}</p></div><span className="shrink-0 text-sm">{money(line.product.unit_price * (line.quantity ?? 1))}</span>
    </div>)}</div>
    <div className="flex flex-wrap justify-between gap-2 text-sm"><span>المنتجات: {money(basket.subtotal)}</span><span>التوصيل: {basket.delivery_fee == null ? "لم يتحدد" : money(basket.delivery_fee)}</span></div>
    <p className="text-xs text-muted-foreground">{basket.note}</p>
    {!!basket.recipe_steps?.length && <details className="rounded-lg border border-border p-3 text-sm"><summary className="cursor-pointer font-medium">طريقة تحضير بسيطة</summary><ol className="mt-2 list-inside list-decimal space-y-2">{basket.recipe_steps.map((step) => <li key={step}>{step}</li>)}</ol></details>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => onChoose(basket, false)} className="gap-2"><ShoppingCart className="h-4 w-4" />أضف للسلة</Button><Button disabled={busy || basket.total == null} onClick={() => onChoose(basket, true)}>اطلب الآن</Button></div>
  </CardContent></Card>
}
