import { describe, it, expect } from "vitest"
import { computeDeliveryFee, computeDeliveryFeeFromCoords } from "./fee"

describe("computeDeliveryFee (metered fare = base + per_km × km)", () => {
  const s = { base_fare: 10, per_km_rate: 1 }

  it("base fare only at zero distance", () => {
    expect(computeDeliveryFee(0, s)).toBe(10)
  })

  it("base + per_km × distance, rounded to whole EGP", () => {
    expect(computeDeliveryFee(3, s)).toBe(13)
    expect(computeDeliveryFee(2.4, s)).toBe(12) // 12.4 -> 12
    expect(computeDeliveryFee(2.6, s)).toBe(13) // 12.6 -> 13
  })

  it("respects a higher per-km rate", () => {
    expect(computeDeliveryFee(5, { base_fare: 10, per_km_rate: 5 })).toBe(35)
  })

  it("never negative; guards bad distance input", () => {
    expect(computeDeliveryFee(-5, s)).toBe(10) // negative -> 0 km -> base only
    expect(computeDeliveryFee(Number.NaN, s)).toBe(10)
  })

  it("falls back to defaults on invalid settings", () => {
    // @ts-expect-error intentionally bad settings
    expect(computeDeliveryFee(2, { base_fare: "x", per_km_rate: -1 })).toBe(12) // defaults 10 + 1×2
  })
})

describe("computeDeliveryFeeFromCoords", () => {
  const s = { base_fare: 10, per_km_rate: 1 }

  it("returns null when any coordinate is missing", () => {
    expect(computeDeliveryFeeFromCoords({ lat: 26.3 }, { lat: 26.4, lng: 31.9 }, s)).toBeNull()
    expect(computeDeliveryFeeFromCoords(null, { lat: 26.4, lng: 31.9 }, s)).toBeNull()
    expect(computeDeliveryFeeFromCoords({ lat: 26.4, lng: 31.9 }, undefined, s)).toBeNull()
  })

  it("computes a plausible fare for a short intra-city hop (Girga)", () => {
    const fee = computeDeliveryFeeFromCoords({ lat: 26.34, lng: 31.89 }, { lat: 26.35, lng: 31.9 }, s)
    expect(fee).not.toBeNull()
    expect(fee!).toBeGreaterThanOrEqual(10) // at least the base fare
    expect(fee!).toBeLessThan(20) // short trip
  })
})
