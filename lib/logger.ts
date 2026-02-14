const isProduction = process.env.NODE_ENV === "production"

function getSafeMessage(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value
  }

  return "[error] An unexpected error occurred"
}

export function logError(...args: unknown[]) {
  if (isProduction && typeof window !== "undefined") {
    return
  }

  if (isProduction) {
    console.error(getSafeMessage(args[0]))
    return
  }

  console.error(...args)
}
