import Dexie from "dexie";

type AppStateItem = {
  key: string; // store name
  value: string; // JSON.stringify of the state
};

const db = new Dexie("FinanceTrackerDB");

db.version(1).stores({
  appState: "key",
});

const appStateTable = db.table<AppStateItem>("appState");

export const indexeddbStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const item = await appStateTable.get(key);
      return item ? item.value : null; // Return the value if found, otherwise null
    } catch (error) {
      console.error("Error getting item from IndexedDB:", error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await appStateTable.put({ key, value });
    } catch (error) {
      console.error("Error setting item in IndexedDB:", error);
      throw error;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await appStateTable.delete(key);
    } catch (error) {
      console.error("Error removing item from IndexedDB:", error);
      throw error;
    }
  },
};
