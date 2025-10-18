import Image from "next/image"

export function Logo({ className = "" }: { className?: string }) {
  return <Image src="/logo.svg" alt="Mahalak Logo" width={200} height={80} className={className} priority />
}
