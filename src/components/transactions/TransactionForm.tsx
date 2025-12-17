import { useState, type FormEvent, type ChangeEvent } from "react";
import { useTransactionsStore } from "../../store/transactionsStore";
import { useAccountsStore } from "../../store/accountsStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import type { TransactionType, AnyTransaction, ProjectedTransaction } from "../../types/models";
import styles from "./TransactionForm.module.css";
import { generateAndSaveDemoModelToIndexedDB } from "../../ml/generateAndSaveDemoModelToIndexedDB";
import { suggestCategory } from "../../ml/categorizer";

type Props = {
  editingTransaction?: AnyTransaction;
  onCancel?: () => void;
  onSuccess?: () => void;
};

const TransactionForm = ({ editingTransaction, onCancel, onSuccess }: Props) => {
  const addTransaction = useTransactionsStore((s) => s.addTransaction);
  const updateTransaction = useTransactionsStore((s) => s.updateTransaction);
  const accounts = useAccountsStore((s) => s.accounts);
  const currencies = useAccountsStore((s) => s.currencies);
  const getCategoryById = useCategoriesStore((s) => s.getCategoryById);
  const getRootCategories = useCategoriesStore((s) => s.getRootCategories);
  const getSubcategories = useCategoriesStore((s) => s.getSubcategories);

  const isEditing = Boolean(editingTransaction);

  const [formData, setFormData] = useState({
    date: editingTransaction?.date ?? new Date().toISOString().slice(0, 10),
    description: editingTransaction?.description ?? "",
    amount: editingTransaction?.amount.toString() ?? "",
    categoryId: editingTransaction?.category ?? "",
    type: editingTransaction?.type ?? "expense",
    accountId: editingTransaction?.accountId ?? (accounts[0]?.id !== "" ? accounts[0].id : ""),
    currencyId:
      editingTransaction?.currencyId ?? (currencies[0]?.id !== "" ? currencies[0].id : ""),
    isProjected: editingTransaction?.isProjected ?? false,
    frequency:
      editingTransaction?.isProjected === true ? (editingTransaction.frequency ?? "once") : "once",
  });

  const [selectedParentCategory, setSelectedParentCategory] = useState<string>("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isGeneratingModel, setIsGeneratingModel] = useState(false);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleTypeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newType = e.target.value as TransactionType;
    setFormData((prev) => ({ ...prev, type: newType, categoryId: "" }));
    setSelectedParentCategory("");
  };

  const handleParentCategoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const parentId = e.target.value;
    setSelectedParentCategory(parentId);
    setFormData((prev) => ({ ...prev, categoryId: "" }));
  };

  const handleSuggestCategory = async () => {
    if (formData.description === "" || formData.description.trim() === "") return;

    try {
      setIsSuggesting(true);

      const catId = await suggestCategory(formData.description);

      if (catId === "") {
        alert("No suggestion available. Try a more descriptive text.");
        return;
      }

      const cat = getCategoryById(catId);
      if (!cat) {
        setFormData((prev) => ({ ...prev, categoryId: catId }));
        return;
      }

      if (cat.parentId && cat.parentId !== "") {
        setSelectedParentCategory(cat.parentId);
        setFormData((prev) => ({ ...prev, categoryId: cat.id }));
      } else {
        setSelectedParentCategory(cat.id);
        setFormData((prev) => ({ ...prev, categoryId: cat.id }));
      }
    } catch (e) {
      console.error(e);
      alert("AI suggestion failed. Falling back to manual selection.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleGenerateDemoModel = async () => {
    try {
      setIsGeneratingModel(true);
      await generateAndSaveDemoModelToIndexedDB();
      alert("Seed-trained AI model saved to IndexedDB. You can now use Suggest Category.");
    } catch (e) {
      console.error(e);
      alert("Failed to train model. See console for details.");
    } finally {
      setIsGeneratingModel(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (formData.categoryId === "") {
      alert("Please select a category");
      return;
    }

    const baseData = {
      date: formData.date,
      description: formData.description,
      amount,
      category: formData.categoryId,
      type: formData.type,
      accountId: formData.accountId,
      currencyId: formData.currencyId,
    };

    if (isEditing && editingTransaction) {
      updateTransaction(editingTransaction.id, baseData);
      if (onSuccess) {
        onSuccess();
      }
    } else {
      if (formData.isProjected) {
        const projectedTx: Omit<ProjectedTransaction, "id"> = {
          ...baseData,
          isProjected: true,
          frequency: formData.frequency,
        };
        addTransaction(projectedTx);
      } else {
        addTransaction({
          ...baseData,
          isProjected: false,
        });
      }
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        description: "",
        amount: "",
        categoryId: "",
        type: "expense",
        accountId: accounts[0]?.id ?? "",
        currencyId: currencies[0]?.id ?? "",
        isProjected: false,
        frequency: "once",
      });
      setSelectedParentCategory("");
      if (onSuccess) {
        onSuccess();
      }
    }
  };

  const rootCategories = getRootCategories(formData.type);
  const subcategories =
    selectedParentCategory !== "" ? getSubcategories(selectedParentCategory) : [];

  const currentCategory =
    formData.categoryId !== "" ? getCategoryById(formData.categoryId) : undefined;
  let effectiveParent = "";
  if (selectedParentCategory !== "") {
    effectiveParent = selectedParentCategory;
  } else if (currentCategory?.parentId !== undefined && currentCategory.parentId !== "") {
    effectiveParent = currentCategory.parentId;
  } else {
    effectiveParent = currentCategory?.id ?? "";
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>{isEditing ? "Edit Transaction" : "Add Transaction"}</h2>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Type</label>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="type"
              value="expense"
              checked={formData.type === "expense"}
              onChange={handleTypeChange}
            />
            <span>Expense</span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="type"
              value="income"
              checked={formData.type === "income"}
              onChange={handleTypeChange}
            />
            <span>Income</span>
          </label>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="date" className={styles.label}>
          Date
        </label>
        <input
          type="date"
          id="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          required
          className={styles.input}
        />
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="description" className={styles.label}>
          Description
        </label>
        <input
          type="text"
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
          placeholder="e.g., Grocery shopping"
          className={styles.input}
        />
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="amount" className={styles.label}>
          Amount
        </label>
        <input
          type="number"
          id="amount"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          required
          min="0"
          step="0.01"
          placeholder="0.00"
          className={styles.input}
        />
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="accountId" className={styles.label}>
          Account
        </label>
        <select
          id="accountId"
          name="accountId"
          value={formData.accountId}
          onChange={handleChange}
          required
          className={styles.select}
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="currencyId" className={styles.label}>
          Currency
        </label>
        <select
          id="currencyId"
          name="currencyId"
          value={formData.currencyId}
          onChange={handleChange}
          required
          className={styles.select}
        >
          {currencies.map((cur) => (
            <option key={cur.id} value={cur.id}>
              {cur.symbol} {cur.code} - {cur.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="parentCategory" className={styles.label}>
          Category
        </label>
        <select
          id="parentCategory"
          value={effectiveParent}
          onChange={handleParentCategoryChange}
          required
          className={styles.select}
        >
          <option value="">Select a category...</option>
          {rootCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon ? `${cat.icon} ` : ""}
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {subcategories.length > 0 && (
        <div className={styles.fieldGroup}>
          <label htmlFor="categoryId" className={styles.label}>
            Subcategory
          </label>
          <select
            id="categoryId"
            name="categoryId"
            value={formData.categoryId}
            onChange={handleChange}
            required
            className={styles.select}
          >
            <option value="">Select subcategory...</option>
            {subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.icon !== undefined && sub.icon !== "" ? `${sub.icon} ` : ""}
                {sub.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {subcategories.length === 0 && selectedParentCategory !== "" && (
        <input type="hidden" name="categoryId" value={selectedParentCategory} />
      )}

      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="isProjected"
            checked={formData.isProjected}
            onChange={handleChange}
          />
          <span>Projected Transaction</span>
        </label>
      </div>

      {formData.isProjected && (
        <div className={styles.fieldGroup}>
          <label htmlFor="frequency" className={styles.label}>
            Frequency
          </label>
          <select
            id="frequency"
            name="frequency"
            value={formData.frequency}
            onChange={handleChange}
            className={styles.select}
          >
            <option value="once">Once</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      )}

      <div className={styles.fieldGroup}>
        <button
          type="button"
          className={styles.suggestButton}
          onClick={() => {
            void handleSuggestCategory();
          }}
          disabled={isSuggesting || formData.description.trim() === ""}
          title={isSuggesting ? "Suggesting..." : "Use AI to suggest a category"}
        >
          {isSuggesting ? "🤖 Suggesting..." : "🤖 Suggest Category (AI)"}
        </button>
        <button
          type="button"
          className={styles.demoModelButton}
          disabled={isGeneratingModel}
          onClick={() => {
            void handleGenerateDemoModel();
          }}
          title="Generate a tiny demo model in your browser"
        >
          {isGeneratingModel ? "⚙️ Building demo model..." : "⚙️ Create Demo AI Model"}
        </button>
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.submitButton}>
          {isEditing ? "Update" : "Add"} Transaction
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={styles.cancelButton}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default TransactionForm;
