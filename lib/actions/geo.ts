"use server"

export async function reverseGeocode(lat: number, lon: number) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ar`,
            {
                headers: {
                    "User-Agent": "Mahalak-App/1.0 (https://mahalak.com)",
                },
            }
        )

        if (!response.ok) {
            throw new Error(`Nominatim API returned ${response.status}`)
        }

        const data = await response.json()
        return { success: true, data }
    } catch (error: any) {
        console.error("[v0] Reverse geocoding error:", error)
        return { success: false, error: error.message }
    }
}
