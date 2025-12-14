import { useState } from "react";
import styles from "./App.module.css";
import Dashboard from "./components/dashboard/Dashboard";
import TransactionForm from "./components/transactions/TransactionForm";
import TransactionsTable from "./components/transactions/TransactionsTable";

type View = "dashboard" | "transactions" | "add";

function App() {
  const [currentView, setCurrentView] = useState<View>("dashboard");

  return (
    <main className={styles.app}>
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <span className={styles.navLogo}>💰</span>
          <h1 className={styles.navTitle}>Finance Tracker</h1>
        </div>
        <div className={styles.navLinks}>
          <button
            className={`${styles.navLink} ${currentView === "dashboard" ? styles.navLinkActive : ""}`}
            onClick={() => setCurrentView("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`${styles.navLink} ${currentView === "transactions" ? styles.navLinkActive : ""}`}
            onClick={() => setCurrentView("transactions")}
          >
            Transactions
          </button>
          <button
            className={`${styles.navLink} ${currentView === "add" ? styles.navLinkActive : ""}`}
            onClick={() => {
              setCurrentView("add");
            }}
          >
            + Add Transaction
          </button>
        </div>
      </nav>

      <section className={styles.main}>
        {currentView === "dashboard" && <Dashboard />}
        {currentView === "transactions" && <TransactionsTable />}
        {currentView === "add" && (
          <TransactionForm
            onSuccess={() => {
              alert("Transaction added successfully!");
            }}
          />
        )}
      </section>
    </main>
  );
}

export default App;
