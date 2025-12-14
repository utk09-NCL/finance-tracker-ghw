import type { Account, Currency, Institution } from "../types/models";

type AccountsStore = {
  accounts: Account[];
  institutions: Institution[];
  currencies: Currency[];

  addAccount: (account: Omit<Account, "id" | "createdAt">) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  addInstitution: (institution: Omit<Institution, "id">) => void;
  updateInstitution: (id: string, updates: Partial<Institution>) => void;
  deleteInstitution: (id: string) => void;

  addCurrency: (currency: Omit<Currency, "id">) => void;
  updateCurrency: (id: string, updates: Partial<Currency>) => void;
  deleteCurrency: (id: string) => void;
};
