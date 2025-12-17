import { useEffect, useState } from "react";
import { useTransactionsStore } from "../../store/transactionsStore";
import { useAccountsStore } from "../../store/accountsStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import CategoryChart, { type CategoryPoint } from "../charts/CategoryChart";
import { groupByMonth, groupByCategory } from "../../utils/aggregations";
import styles from "./Dashboard.module.css";
import TimeSeriesChart, { type TimePoint } from "../charts/TimeSeriesChart";
import YearlyTrendsChart, { type YearPoint } from "../charts/YearlyTrendsChart";
import {
  generateAndSaveProjections,
  loadHistoricalYearlyData,
  type HistoricalYearlyData,
  type ProjectionResult,
} from "../../ml/projectedData";

const Dashboard = () => {
  const [isHydrated, setIsHydrated] = useState(() => {
    return (
      useTransactionsStore.persist.hasHydrated() &&
      useAccountsStore.persist.hasHydrated() &&
      useCategoriesStore.persist.hasHydrated()
    );
  });
  const [projections, setProjections] = useState<ProjectionResult | null>(null);
  const [isGeneratingProjections, setIsGeneratingProjections] = useState(false);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [historicalYearlyData, setHistoricalYearlyData] = useState<HistoricalYearlyData[]>([]);

  useEffect(() => {
    const unsubTransactions = useTransactionsStore.persist.onFinishHydration(() => {
      if (
        useTransactionsStore.persist.hasHydrated() &&
        useAccountsStore.persist.hasHydrated() &&
        useCategoriesStore.persist.hasHydrated()
      ) {
        setIsHydrated(true);
      }
    });
    const unsubAccounts = useAccountsStore.persist.onFinishHydration(() => {
      if (
        useTransactionsStore.persist.hasHydrated() &&
        useAccountsStore.persist.hasHydrated() &&
        useCategoriesStore.persist.hasHydrated()
      ) {
        setIsHydrated(true);
      }
    });
    const unsubCategories = useCategoriesStore.persist.onFinishHydration(() => {
      if (
        useTransactionsStore.persist.hasHydrated() &&
        useAccountsStore.persist.hasHydrated() &&
        useCategoriesStore.persist.hasHydrated()
      ) {
        setIsHydrated(true);
      }
    });
    return () => {
      unsubTransactions();
      unsubAccounts();
      unsubCategories();
    };
  }, []);

  const transactions = useTransactionsStore((s) => s.transactions);
  const getActualTransactions = useTransactionsStore((s) => s.getActualTransactions);
  const getProjectedTransactions = useTransactionsStore((s) => s.getProjectedTransactions);
  const currencies = useAccountsStore((s) => s.currencies);
  const getCategoryById = useCategoriesStore((s) => s.getCategoryById);

  const [selectedCurrency, setSelectedCurrency] = useState<string>(() => {
    const actual = getActualTransactions();
    if (actual.length > 0) return actual[0].currencyId;
    const projected = getProjectedTransactions();
    if (projected.length > 0) return projected[0].currencyId;
    if (currencies.length > 0 && currencies[0].id !== "") return currencies[0].id;
    return "gbp";
  });

  useEffect(() => {
    if (selectedCurrency === "" && currencies.length > 0) {
      const id = currencies[0].id;
      void Promise.resolve().then(() => setSelectedCurrency(id));
    }
  }, [currencies, selectedCurrency]);

  const activeCurrencyId = selectedCurrency !== "" ? selectedCurrency : "gbp";
  const actualTxs = getActualTransactions().filter((t) => t.currencyId === activeCurrencyId);
  const projectedTxs = getProjectedTransactions().filter((t) => t.currencyId === activeCurrencyId);

  const actualExpenses = actualTxs.filter((t) => t.type === "expense");
  const actualIncome = actualTxs.filter((t) => t.type === "income");
  const projectedExpenses = projectedTxs.filter((t) => t.type === "expense");
  const projectedIncome = projectedTxs.filter((t) => t.type === "income");

  const monthlyData = groupByMonth([
    ...actualExpenses,
    ...projectedExpenses,
    ...actualIncome,
    ...projectedIncome,
  ]);

  const expensesActualData: TimePoint[] = monthlyData.map((m) => ({
    time: m.month,
    value: m.actualExpense,
  }));
  const expensesProjectedData: TimePoint[] = monthlyData.map((m) => ({
    time: m.month,
    value: m.projectedExpense,
  }));
  const incomeActualData: TimePoint[] = monthlyData.map((m) => ({
    time: m.month,
    value: m.actualIncome,
  }));
  const incomeProjectedData: TimePoint[] = monthlyData.map((m) => ({
    time: m.month,
    value: m.projectedIncome,
  }));

  const categoryData = groupByCategory([...actualExpenses, ...projectedExpenses], {
    type: "expense",
  });

  const getCategoryName = (categoryId: string): string => {
    const category = getCategoryById(categoryId);
    if (!category) return categoryId;
    if (category.parentId) {
      const parent = getCategoryById(category.parentId);
      return parent ? `${parent.name} / ${category.name}` : category.name;
    }
    return category.name;
  };

  const expenseCategoryData: CategoryPoint[] = categoryData.map((c) => ({
    category: getCategoryName(c.category),
    value: c.actualAmount,
  }));

  const expenseCategoryProjectedData: CategoryPoint[] = categoryData.map((c) => ({
    category: getCategoryName(c.category),
    value: c.projectedAmount,
  }));

  const handleGenerateProjections = async () => {
    setIsGeneratingProjections(true);
    setProjectionError(null);

    try {
      const historical: HistoricalYearlyData[] = await loadHistoricalYearlyData(
        activeCurrencyId.toUpperCase(),
      );
      setHistoricalYearlyData(historical);

      const result = await generateAndSaveProjections(activeCurrencyId.toUpperCase());
      setProjections(result);
    } catch (error) {
      console.error("Failed to generate projections:", error);
      setProjectionError(error instanceof Error ? error.message : "Failed to generate projections");
    } finally {
      setIsGeneratingProjections(false);
    }
  };

  const getProjectedYearlyData = (): YearPoint[] => {
    if (!projections) return [];

    const yearMap = new Map<string, { income: number; expenses: number }>();

    for (const proj of projections.projections) {
      const year = proj.monthKey.split("-")[0];
      if (!yearMap.has(year)) {
        yearMap.set(year, { income: 0, expenses: 0 });
      }
      const data = yearMap.get(year)!;
      data.income += proj.projectedIncome;
      data.expenses += proj.projectedExpenses;
    }

    return Array.from(yearMap.entries())
      .map(([year, data]) => ({
        year,
        income: data.income,
        expenses: data.expenses,
      }))
      .sort((a, b) => a.year.localeCompare(b.year));
  };

  const actualYearlyData: YearPoint[] = historicalYearlyData.map((d) => ({
    year: d.year,
    income: d.income,
    expenses: d.expenses,
  }));
  const projectedYearlyData = getProjectedYearlyData();

  const totalIncome = actualIncome.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = actualExpenses.reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;

  const currency =
    currencies.find((c) => c.id === activeCurrencyId) || currencies.find((c) => c.id === "gbp");
  const currencySymbol = currency?.symbol ?? "£";
  const formatAmount = (amount: number) => `${currencySymbol}${amount.toFixed(2)}`;

  if (!isHydrated) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Loading your financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.headerRow}>
          <p className={styles.subtitle}>Overview of your financial data</p>
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className={styles.currencySelector}
          >
            {currencies.map((curr) => (
              <option key={curr.id} value={curr.id}>
                {curr.code} ({curr.symbol})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.summaryCards}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Total Income</div>
          <div className={`${styles.cardValue} ${styles.income}`}>{formatAmount(totalIncome)}</div>
          <div className={styles.cardSubtext}>{actualIncome.length} transactions</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Total Expenses</div>
          <div className={`${styles.cardValue} ${styles.expense}`}>
            {formatAmount(totalExpenses)}
          </div>
          <div className={styles.cardSubtext}>{actualExpenses.length} transactions</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Net Balance</div>
          <div
            className={`${styles.cardValue} ${netBalance >= 0 ? styles.income : styles.expense}`}
          >
            {formatAmount(netBalance)}
          </div>
          <div className={styles.cardSubtext}>{netBalance >= 0 ? "Surplus" : "Deficit"}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Total Transactions</div>
          <div className={styles.cardValue}>{transactions.length}</div>
          <div className={styles.cardSubtext}>
            {actualTxs.length} actual, {projectedTxs.length} projected
          </div>
        </div>
      </div>

      <div className={styles.projectionSection}>
        <button
          onClick={() => void handleGenerateProjections()}
          disabled={isGeneratingProjections}
          className={styles.projectionButton}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            fontWeight: 600,
            backgroundColor: isGeneratingProjections ? "#9ca3af" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: isGeneratingProjections ? "not-allowed" : "pointer",
            marginBottom: "16px",
          }}
        >
          {isGeneratingProjections ? "Generating Projections..." : "Generate Projected Earnings"}
        </button>

        {projectionError && (
          <div style={{ color: "#ef4444", marginBottom: "16px" }}>Error: {projectionError}</div>
        )}

        {projections && !isGeneratingProjections && (
          <div style={{ marginBottom: "16px", color: "#6b7280" }}>
            Last updated: {new Date(projections.trainingDate).toLocaleString()} • Based on{" "}
            {projections.historicalMonths} months of data
          </div>
        )}
      </div>

      {actualYearlyData.length > 0 && (
        <div className={styles.chartCard} style={{ marginBottom: "24px" }}>
          <h3 className={styles.chartTitle}>Yearly Trends</h3>
          <p className={styles.chartSubtitle}>
            Total income and expenses per year (historical + projected)
          </p>
          <div className={styles.chartContainer}>
            <YearlyTrendsChart
              height={300}
              actualData={actualYearlyData}
              projectedData={projectedYearlyData}
            />
          </div>
        </div>
      )}

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Monthly Trends</h3>
          <p className={styles.chartSubtitle}>Income and expenses over time</p>
          <div className={styles.chartContainer}>
            <TimeSeriesChart
              height={300}
              expensesActual={expensesActualData}
              expensesProjected={expensesProjectedData}
              incomeActual={incomeActualData}
              incomeProjected={incomeProjectedData}
            />
          </div>
        </div>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Expense Categories</h3>
          <p className={styles.chartSubtitle}>Breakdown by category</p>
          <div className={styles.chartContainer}>
            <CategoryChart
              height={300}
              dataActual={expenseCategoryData}
              dataProjected={expenseCategoryProjectedData}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
