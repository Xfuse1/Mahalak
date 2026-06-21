"use client"

// IA-01: زرّ «رتّب بالأقرب إليّ» — يطلب موقع المستخدم لترتيب المتاجر بالقرب.
import { MapPin, Loader2, Check } from "lucide-react"
import { Button } from "./ui/button"
import { useUserLocation } from "../lib/location/user-location"
import { useLanguage } from "../lib/language-context"

export function NearbyControl({ className = "" }: { className?: string }) {
  const { coords, status, requestLocation, clearLocation } = useUserLocation()
  const { t } = useLanguage()

  if (coords) {
    return (
      <div className={`flex items-center gap-2 flex-wrap ${className}`}>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full">
          <Check className="h-4 w-4" /> {t("مُرتّب بالأقرب إليك", "Sorted by nearest to you")}
        </span>
        <button onClick={clearLocation} className="text-xs text-muted-foreground hover:text-foreground underline">
          {t("إلغاء", "Clear")}
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <Button
        type="button"
        variant="outline"
        onClick={requestLocation}
        disabled={status === "loading"}
        className="rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/10"
      >
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {t("رتّب بالأقرب إليّ", "Sort by nearest")}
      </Button>
      {status === "denied" && (
        <span className="text-xs text-destructive">{t("تعذّر الوصول إلى موقعك", "Couldn't access your location")}</span>
      )}
    </div>
  )
}
