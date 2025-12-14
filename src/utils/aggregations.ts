import type {
  AnyTransaction,
  TransactionType,
  CategoryAggregate,
  MonthlyAggregate,
} from "../types/models";
import { toYearMonth } from "./dateUtils";

export function groupByCategory(
  transactions: AnyTransaction[],
  opts?: { type?: TransactionType; startDate?: string; endDate?: string },
): CategoryAggregate[] {
  // Map: category ID → { actual amount, projected amount }
  const map = new Map<string, { actual: number; projected: number }>();

  for (const t of transactions) {
    // Apply optional filters
    if (typeof opts?.type !== "undefined" && t.type !== opts.type) continue;
    if (typeof opts?.startDate !== "undefined" && t.date < opts.startDate) continue;
    if (typeof opts?.endDate !== "undefined" && t.date > opts.endDate) continue;

    // Get or create bucket for this category
    const key = t.category;
    const bucket = map.get(key) ?? { actual: 0, projected: 0 };

    // Add amount to the right sub-bucket
    if (t.isProjected) bucket.projected += t.amount;
    else bucket.actual += t.amount;

    map.set(key, bucket);
  }

  // Convert to array format
  const totals = Array.from(map.entries()).map(([category, vals]) => ({
    category,
    actualAmount: vals.actual,
    projectedAmount: vals.projected,
  }));

  // Calculate percentages relative to grand total
  const grandTotal = totals.reduce((sum, x) => sum + x.actualAmount + x.projectedAmount, 0);
  return (
    totals
      .map((x) => ({
        ...x,
        // Percentage of total spending (useful for pie charts)
        percentage: grandTotal > 0 ? ((x.actualAmount + x.projectedAmount) / grandTotal) * 100 : 0,
      }))
      // Sort alphabetically by category name
      .sort((a, b) => {
        if (a.category < b.category) return -1;
        if (a.category > b.category) return 1;
        return 0;
      })
  );
}

export function groupByMonth(transactions: AnyTransaction[]): MonthlyAggregate[] {
  // Use a Map to collect totals by month key (YYYY-MM)
  const map = new Map<string, MonthlyAggregate>();

  for (const t of transactions) {
    // Convert date to month key: "2025-12-14" → "2025-12"
    const key = toYearMonth(t.date);

    // Get existing bucket or create new one with zeros
    const existing = map.get(key) ?? {
      month: key,
      actualIncome: 0,
      projectedIncome: 0,
      actualExpense: 0,
      projectedExpense: 0,
    };

    // Add this transaction's amount to the right bucket
    if (t.type === "income") {
      if (t.isProjected) existing.projectedIncome += t.amount;
      else existing.actualIncome += t.amount;
    } else {
      // expense
      if (t.isProjected) existing.projectedExpense += t.amount;
      else existing.actualExpense += t.amount;
    }

    map.set(key, existing);
  }

  // Convert Map to array and sort by month (ascending)
  return Array.from(map.values()).sort((a, b) => {
    if (a.month < b.month) return -1;
    if (a.month > b.month) return 1;
    return 0;
  });
}
