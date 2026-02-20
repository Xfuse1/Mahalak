export function calculateProfitPerUnit(price: number, costPrice: number) {
  const normalizedPrice = Number(price)
  const normalizedCostPrice = Number(costPrice)
  const rawProfit = normalizedPrice - normalizedCostPrice

  // Keep a stable money-like numeric value with 2 decimal places.
  return Math.round(rawProfit * 100) / 100
}
