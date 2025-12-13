import { useState } from "react";
import styles from "./App.module.css";

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
      </nav>
    </main>
  );
}

export default App;
