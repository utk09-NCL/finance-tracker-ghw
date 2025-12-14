import { useMemo, useState } from "react";
import { useTransactionsStore } from "../../store/transactionsStore";
import { useAccountsStore } from "../../store/accountsStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import type { AnyTransaction } from "../../types/models";
import styles from "./TransactionsTable.module.css";

type Props = {
  onEdit?: (transaction: AnyTransaction) => void;
};

type SortDirection = "asc" | "desc";

const TransactionsTable = ({ onEdit }: Props) => {
  const getFilteredTransactions = useTransactionsStore((s) => s.getFilteredTransactions);
  const deleteTransaction = useTransactionsStore((s) => s.deleteTransaction);
  const filters = useTransactionsStore((s) => s.filters);
  const setFilters = useTransactionsStore((s) => s.setFilters);
  const clearFilters = useTransactionsStore((s) => s.clearFilters);
  useTransactionsStore((s) => s.transactions); // Subscribe to transactions changes

  const transactions = getFilteredTransactions();

  const accounts = useAccountsStore((s) => s.accounts);
  const currencies = useAccountsStore((s) => s.currencies);
  const getInstitutionById = useAccountsStore((s) => s.getInstitutionById);
  const getCategoryById = useCategoriesStore((s) => s.getCategoryById);
  const getRootCategories = useCategoriesStore((s) => s.getRootCategories);
  const getSubcategories = useCategoriesStore((s) => s.getSubcategories);

  const [showFilters, setShowFilters] = useState(false);
  const [parentCategoryId, setParentCategoryId] = useState<string>("");
  const [subCategoryId, setSubCategoryId] = useState<string>("");
  const [accountSubType, setAccountSubType] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const parentCategoryOptions = useMemo(() => {
    if (filters.type === undefined) {
      const incomeRoots = getRootCategories("income");
      const expenseRoots = getRootCategories("expense");
      return [...incomeRoots, ...expenseRoots];
    }
    return getRootCategories(filters.type);
  }, [filters.type, getRootCategories]);

  const subCategoryOptions = useMemo(() => {
    if (parentCategoryId === "") return [] as ReturnType<typeof getSubcategories>;
    return getSubcategories(parentCategoryId);
  }, [parentCategoryId, getSubcategories]);

  const accountSubTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of accounts) set.add(a.subType);
    return Array.from(set).sort();
  }, [accounts]);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      deleteTransaction(id);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatAmount = (amount: number, currencyId: string) => {
    const currency = currencies.find((c) => c.id === currencyId);
    const symbol = currency?.symbol ?? "";
    return `${symbol}${amount.toFixed(2)}`;
  };

  const getAccountName = (accountId: string) => {
    return accounts.find((a) => a.id === accountId)?.name ?? "Unknown";
  };

  const getCategoryParts = (categoryId: string): { category: string; subcategory: string } => {
    const cat = getCategoryById(categoryId);
    if (!cat) return { category: "Unknown", subcategory: "" };
    if (cat.parentId !== undefined && cat.parentId !== "") {
      const parent = getCategoryById(cat.parentId);
      return { category: parent?.name ?? "", subcategory: cat.name };
    }
    return { category: cat.name, subcategory: "" };
  };

  const getInstitutionName = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return "Unknown";
    const inst = getInstitutionById(acc.institutionId);
    return inst?.name ?? "Unknown";
  };

  const getAccountSubType = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (acc?.subType === undefined) return "Unknown";
    return acc.subType.replaceAll("_", " ");
  };

  const shortId = (id: string) => id.slice(0, 8);

  const handleSort = () => {
    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
  };

  const getSortedTransactions = (txns: AnyTransaction[]) => {
    const sorted = [...txns].sort((a, b) => {
      const compareValue = a.date.localeCompare(b.date);
      return sortDirection === "asc" ? compareValue : -compareValue;
    });
    return sorted;
  };

  const getSortIndicator = () => {
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Transactions</h2>
        <button
          className={styles.filterToggle}
          onClick={() => setShowFilters(!showFilters)}
          type="button"
        >
          {showFilters ? "Hide" : "Show"} Filters
        </button>
      </div>

      {showFilters && (
        <div className={styles.filters}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label htmlFor="startDate" className={styles.filterLabel}>
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={filters.startDate ?? ""}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className={styles.filterInput}
              />
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="endDate" className={styles.filterLabel}>
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={filters.endDate ?? ""}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className={styles.filterInput}
              />
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="typeFilter" className={styles.filterLabel}>
                Type
              </label>
              <select
                id="typeFilter"
                value={filters.type ?? ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    type:
                      e.target.value === "" ? undefined : (e.target.value as "income" | "expense"),
                  })
                }
                className={styles.filterSelect}
              >
                <option value="">All</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="parentCategoryFilter" className={styles.filterLabel}>
                Category
              </label>
              <select
                id="parentCategoryFilter"
                value={parentCategoryId}
                onChange={(e) => {
                  const val = e.target.value;
                  setParentCategoryId(val);
                  setSubCategoryId("");
                }}
                className={styles.filterSelect}
              >
                <option value="">All</option>
                {parentCategoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="subCategoryFilter" className={styles.filterLabel}>
                Subcategory
              </label>
              <select
                id="subCategoryFilter"
                value={subCategoryId}
                onChange={(e) => setSubCategoryId(e.target.value)}
                className={styles.filterSelect}
                disabled={parentCategoryId === ""}
              >
                <option value="">All</option>
                {subCategoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="accountFilter" className={styles.filterLabel}>
                Account
              </label>
              <select
                id="accountFilter"
                value={filters.accountId ?? ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    accountId: e.target.value === "" ? undefined : e.target.value,
                  })
                }
                className={styles.filterSelect}
              >
                <option value="">All</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="accountSubTypeFilter" className={styles.filterLabel}>
                Account Subtype
              </label>
              <select
                id="accountSubTypeFilter"
                value={accountSubType}
                onChange={(e) => setAccountSubType(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">All</option>
                {accountSubTypeOptions.map((st) => (
                  <option key={st} value={st}>
                    {st.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            className={styles.clearFiltersButton}
            onClick={() => {
              clearFilters();
              setParentCategoryId("");
              setSubCategoryId("");
              setAccountSubType("");
            }}
            type="button"
          >
            Clear Filters
          </button>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className={styles.empty}>
          <p>No transactions found. Add your first transaction to get started!</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th style={{ cursor: "pointer" }} onClick={handleSort}>
                  Date{getSortIndicator()}
                </th>
                <th>Description</th>
                <th>Category</th>
                <th>Subcategory</th>
                <th>Account</th>
                <th>Subtype</th>
                <th>Institution</th>
                <th className={styles.alignRight}>Amount</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getSortedTransactions(
                transactions
                  .filter((transaction) => {
                    if (subCategoryId !== "") {
                      return transaction.category === subCategoryId;
                    }
                    if (parentCategoryId !== "") {
                      const cat = getCategoryById(transaction.category);
                      return cat?.parentId === parentCategoryId || cat?.id === parentCategoryId;
                    }
                    return true;
                  })
                  .filter((transaction) => {
                    if (accountSubType === "") return true;
                    const acc = accounts.find((a) => a.id === transaction.accountId);
                    return acc?.subType === accountSubType;
                  }),
              ).map((transaction) => (
                <tr
                  key={transaction.id}
                  className={transaction.isProjected ? styles.projectedRow : ""}
                >
                  <td>{shortId(transaction.id)}</td>
                  <td>{formatDate(transaction.date)}</td>
                  <td className={styles.description}>{transaction.description}</td>
                  {(() => {
                    const parts = getCategoryParts(transaction.category);
                    return (
                      <>
                        <td>{parts.category}</td>
                        <td>{parts.subcategory !== "" ? parts.subcategory : "—"}</td>
                      </>
                    );
                  })()}
                  <td>{getAccountName(transaction.accountId)}</td>
                  <td>{getAccountSubType(transaction.accountId)}</td>
                  <td>{getInstitutionName(transaction.accountId)}</td>
                  <td className={styles.alignRight}>
                    <span
                      className={
                        transaction.type === "income" ? styles.incomeAmount : styles.expenseAmount
                      }
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {formatAmount(transaction.amount, transaction.currencyId)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        transaction.type === "income" ? styles.incomeBadge : styles.expenseBadge
                      }
                    >
                      {transaction.type === "income" ? "Income" : "Expense"}
                    </span>
                  </td>
                  <td>
                    {transaction.isProjected ? (
                      <span className={styles.projectedBadge}>
                        Projected
                        {transaction.frequency !== "once" ? ` (${transaction.frequency})` : ""}
                      </span>
                    ) : (
                      <span className={styles.actualBadge}>Actual</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {onEdit !== undefined && (
                        <button
                          className={styles.editButton}
                          onClick={() => onEdit(transaction)}
                          type="button"
                          title="Edit transaction"
                        >
                          ✏️
                        </button>
                      )}
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDelete(transaction.id)}
                        type="button"
                        title="Delete transaction"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.summary}>
        <p>
          Showing <strong>{transactions.length}</strong> transaction
          {transactions.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
};

export default TransactionsTable;
