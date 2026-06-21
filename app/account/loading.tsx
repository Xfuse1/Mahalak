import { Spinner } from "@/components/ui/spinner"

export default function Loading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Spinner size="lg" label="جاري التحميل…" className="flex-col" />
    </div>
  )
}
