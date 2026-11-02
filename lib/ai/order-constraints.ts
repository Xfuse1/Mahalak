/** Called inside order transactions, after server prices and shipping, before commit. */
export function validateShoppingTotal(total: number, constraints: { max_total?: number; expected_total?: number }): void {
  if ((constraints.max_total !== undefined || constraints.expected_total !== undefined) && (!Number.isFinite(total) || total < 0)) throw new Error("INVALID_SHOPPING_TOTAL")
  if (constraints.max_total !== undefined && (!Number.isFinite(constraints.max_total) || constraints.max_total <= 0 || constraints.max_total > 100000)) throw new Error("INVALID_SHOPPING_BUDGET")
  if (constraints.expected_total !== undefined && (!Number.isFinite(constraints.expected_total) || constraints.expected_total < 0)) throw new Error("INVALID_SHOPPING_TOTAL")
  const cents = Math.round(total * 100)
  if (constraints.max_total !== undefined && cents > Math.round(constraints.max_total * 100)) throw new Error("SHOPPING_BUDGET_EXCEEDED")
  if (constraints.expected_total !== undefined && cents !== Math.round(constraints.expected_total * 100)) throw new Error("SHOPPING_PRICE_CHANGED")
}
