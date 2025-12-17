import * as tf from "@tensorflow/tfjs";

type CSVTransaction = {
  id: string;
  date: string; // Format: YYYY-MM-DD
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  currency: string;
  merchantId: string;
  merchantName: string;
  mcc: string;
  isRecurring: string;
  essentiality: string;
  labelRecurring: string;
  labelEssential: string;
};

type MonthlyData = {
  year: number;
  month: number; // 1-12
  monthKey: string; // Format: YYYY-MM
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
};

export type ProjectedMonthlyData = {
  monthKey: string; // Format: YYYY-MM
  projectedIncome: number;
  projectedExpenses: number;
};

export type ProjectionResult = {
  projections: ProjectedMonthlyData[];
  modelAccuracy?: number;
  trainingDate: string;
  historicalMonths: number;
};

function parseCSV(csvText: string): CSVTransaction[] {
  const lines = csvText.trim().split("\n");

  // Extract headers from first line
  const headers = lines[0].split(",");

  // Parse each data line (skip header)
  const transactions: CSVTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");

    // Skip empty lines
    if (values.length !== headers.length) continue;

    // Create object mapping headers to values
    const transaction: Record<string, string> = {};
    headers.forEach((header, index) => {
      const val = values[index];
      transaction[header] = val !== "" ? val : "";
    });

    // Convert amount to number and create typed transaction
    const typedTxn: CSVTransaction = {
      id: transaction.id !== "" ? transaction.id : "",
      date: transaction.date !== "" ? transaction.date : "",
      type: (transaction.type !== "" ? transaction.type : "expense") as "income" | "expense",
      category: transaction.category !== "" ? transaction.category : "",
      description: transaction.description !== "" ? transaction.description : "",
      amount: parseFloat(transaction.amount !== "" ? transaction.amount : "0"),
      currency: transaction.currency !== "" ? transaction.currency : "",
      merchantId: transaction.merchantId !== "" ? transaction.merchantId : "",
      merchantName: transaction.merchantName !== "" ? transaction.merchantName : "",
      mcc: transaction.mcc !== "" ? transaction.mcc : "",
      isRecurring: transaction.isRecurring !== "" ? transaction.isRecurring : "",
      essentiality: transaction.essentiality !== "" ? transaction.essentiality : "",
      labelRecurring: transaction.labelRecurring !== "" ? transaction.labelRecurring : "",
      labelEssential: transaction.labelEssential !== "" ? transaction.labelEssential : "",
    };

    transactions.push(typedTxn);
  }

  return transactions;
}

async function loadCSVFile(fileName: string): Promise<CSVTransaction[]> {
  try {
    // Fetch the CSV file from the public/data folder
    const response = await fetch(`/data/${fileName}`);

    if (!response.ok) {
      throw new Error(`Failed to load ${fileName}: ${response.statusText}`);
    } else {
      console.debug(`[CSV Loader] Successfully loaded ${fileName}`);
    }

    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error(`Error loading CSV file ${fileName}:`, error);
    throw error;
  }
}

function aggregateByMonth(transactions: CSVTransaction[]): MonthlyData[] {
  const monthMap = new Map<string, MonthlyData>();

  for (const txn of transactions) {
    // Extract year and month from date (format: YYYY-MM-DD)
    const [year, month] = txn.date.split("-").map(Number);
    const monthKey = `${year}-${month.toString().padStart(2, "0")}`;

    // Get or create monthly data entry
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        year,
        month,
        monthKey,
        totalIncome: 0,
        totalExpenses: 0,
        transactionCount: 0,
      });
    }

    const monthData = monthMap.get(monthKey)!;

    if (txn.type === "income") {
      monthData.totalIncome += txn.amount;
    } else {
      monthData.totalExpenses += txn.amount;
    }

    monthData.transactionCount++;
  }

  return Array.from(monthMap.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
}

function filterByCurrency(transactions: CSVTransaction[], currency: string): CSVTransaction[] {
  return transactions.filter((txn) => txn.currency === currency);
}

function createFeatures(monthlyData: MonthlyData[]): {
  features: number[][];
  incomeLabels: number[];
  expenseLabels: number[];
  maxIncome: number;
  maxExpense: number;
  minYear: number;
  maxYear: number;
} {
  if (monthlyData.length === 0) {
    throw new Error("No monthly data available for feature creation");
  }

  const years = monthlyData.map((d) => d.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const maxIncome = Math.max(...monthlyData.map((d) => d.totalIncome));
  const maxExpense = Math.max(...monthlyData.map((d) => d.totalExpenses));

  const features: number[][] = [];
  const incomeLabels: number[] = [];
  const expenseLabels: number[] = [];

  for (let i = 0; i < monthlyData.length; i++) {
    const data = monthlyData[i];

    // Feature 1: Normalized month (0-1)
    // Captures seasonal patterns (e.g., December spending)
    const normalizedMonth = data.month / 12;

    // Feature 2: Normalized year (0-1)
    // Captures long-term trends (e.g., salary increases)
    const yearRange = maxYear - minYear > 0 ? maxYear - minYear : 1;
    const normalizedYear = (data.year - minYear) / yearRange;

    // Feature 3: Moving average of past 3 months (income)
    // Helps model understand recent income trends
    let movingAvgIncome = 0;
    const lookbackIncome = Math.min(i, 3); // Use up to 3 previous months
    for (let j = Math.max(0, i - lookbackIncome); j < i; j++) {
      movingAvgIncome += monthlyData[j].totalIncome;
    }
    movingAvgIncome = lookbackIncome > 0 ? movingAvgIncome / lookbackIncome : 0;
    const normalizedMovingAvgIncome = maxIncome > 0 ? movingAvgIncome / maxIncome : 0;

    // Feature 4: Moving average of past 3 months (expenses)
    // Helps model understand recent expense trends
    let movingAvgExpense = 0;
    const lookbackExpense = Math.min(i, 3);
    for (let j = Math.max(0, i - lookbackExpense); j < i; j++) {
      movingAvgExpense += monthlyData[j].totalExpenses;
    }
    movingAvgExpense = lookbackExpense > 0 ? movingAvgExpense / lookbackExpense : 0;
    const normalizedMovingAvgExpense = maxExpense > 0 ? movingAvgExpense / maxExpense : 0;

    // Combine all features into a single vector
    features.push([
      normalizedMonth,
      normalizedYear,
      normalizedMovingAvgIncome,
      normalizedMovingAvgExpense,
    ]);

    // Labels (what we're trying to predict)
    // Normalized for better training performance
    incomeLabels.push(maxIncome > 0 ? data.totalIncome / maxIncome : 0);
    expenseLabels.push(maxExpense > 0 ? data.totalExpenses / maxExpense : 0);
  }

  return {
    features,
    incomeLabels,
    expenseLabels,
    maxIncome,
    maxExpense,
    minYear,
    maxYear,
  };
}

function buildModel(): tf.LayersModel {
  const model = tf.sequential();

  // Layer 1: Input + first hidden layer
  // Takes 4 features, outputs 16 activations
  model.add(
    tf.layers.dense({
      inputShape: [4], // month, year, movingAvgIncome, movingAvgExpense
      units: 16,
      activation: "relu",
      kernelInitializer: "heNormal", // Good initializer for ReLU
    }),
  );

  // Layer 2: Second hidden layer
  // Refines patterns, outputs 8 activations
  model.add(
    tf.layers.dense({
      units: 8,
      activation: "relu",
      kernelInitializer: "heNormal",
    }),
  );

  // Layer 3: Output layer
  // Single value prediction (income or expense)
  model.add(
    tf.layers.dense({
      units: 1,
      activation: "linear", // Linear for regression (unbounded output)
    }),
  );

  // Compile the model with optimizer and loss function
  model.compile({
    optimizer: tf.train.adam(0.01), // Adaptive learning rate optimizer
    loss: "meanSquaredError", // MSE: (predicted - actual)²
    metrics: ["mae"], // Mean Absolute Error for monitoring
  });

  return model;
}

async function trainModel(
  model: tf.LayersModel,
  features: number[][],
  labels: number[],
): Promise<tf.History> {
  // Convert to tensors (TensorFlow's data structure)
  const xTensor = tf.tensor2d(features); // Shape: [numSamples, 4]
  const yTensor = tf.tensor2d(labels.map((l) => [l])); // Shape: [numSamples, 1]

  // Train the model
  const history = await model.fit(xTensor, yTensor, {
    epochs: 100, // Number of complete passes through data
    batchSize: 8, // Samples per gradient update
    shuffle: true, // Randomize order each epoch
    validationSplit: 0.2, // Use 20% for validation
    verbose: 0, // Silent training (no console logs)
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        // Log progress every 20 epochs
        if (epoch % 20 === 0 && logs) {
          const valLoss = logs.val_loss;
          console.debug(
            `Epoch ${epoch}: loss=${logs.loss.toFixed(4)}, ` +
              `val_loss=${!Number.isNaN(valLoss) ? valLoss.toFixed(4) : "N/A"}`,
          );
        }
      },
    },
  });

  // Clean up tensors to free memory
  xTensor.dispose();
  yTensor.dispose();

  return history;
}

async function generateProjections(
  incomeModel: tf.LayersModel,
  expenseModel: tf.LayersModel,
  monthlyData: MonthlyData[],
  maxIncome: number,
  maxExpense: number,
  minYear: number,
  maxYear: number,
  numMonths = 12,
): Promise<ProjectedMonthlyData[]> {
  const projections: ProjectedMonthlyData[] = [];

  // Get the last month from historical data as starting point
  const lastMonth = monthlyData[monthlyData.length - 1];
  let currentYear = lastMonth.year;
  let currentMonth = lastMonth.month;

  // Track recent values for moving averages
  // Start with last 3 months from historical data
  const recentIncomes: number[] = monthlyData.slice(-3).map((d) => d.totalIncome);
  const recentExpenses: number[] = monthlyData.slice(-3).map((d) => d.totalExpenses);

  // Generate predictions for each future month
  for (let i = 0; i < numMonths; i++) {
    // Advance to next month
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }

    const monthKey = `${currentYear}-${currentMonth.toString().padStart(2, "0")}`;

    // Create features for this future month
    const normalizedMonth = currentMonth / 12;
    const yearRange = maxYear - minYear > 0 ? maxYear - minYear : 1;
    const normalizedYear = (currentYear - minYear) / yearRange;

    // Moving averages from recent predictions/history
    const movingAvgIncome =
      recentIncomes.length > 0
        ? recentIncomes.reduce((a, b) => a + b, 0) / recentIncomes.length
        : 0;
    const normalizedMovingAvgIncome = maxIncome > 0 ? movingAvgIncome / maxIncome : 0;

    const movingAvgExpense =
      recentExpenses.length > 0
        ? recentExpenses.reduce((a, b) => a + b, 0) / recentExpenses.length
        : 0;
    const normalizedMovingAvgExpense = maxExpense > 0 ? movingAvgExpense / maxExpense : 0;

    const featureVector = [
      normalizedMonth,
      normalizedYear,
      normalizedMovingAvgIncome,
      normalizedMovingAvgExpense,
    ];

    // Predict income and expense using trained models
    const featureTensor = tf.tensor2d([featureVector]);

    const incomePredTensor = incomeModel.predict(featureTensor) as tf.Tensor;
    const expensePredTensor = expenseModel.predict(featureTensor) as tf.Tensor;

    const incomePredArray = await incomePredTensor.data();
    const expensePredArray = await expensePredTensor.data();

    // Denormalize predictions to actual amounts
    const projectedIncome = incomePredArray[0] * maxIncome;
    const projectedExpenses = expensePredArray[0] * maxExpense;

    // Store projection
    projections.push({
      monthKey,
      projectedIncome,
      projectedExpenses,
    });

    // Update moving average windows for next iteration
    recentIncomes.push(projectedIncome);
    if (recentIncomes.length > 3) recentIncomes.shift(); // Keep only last 3

    recentExpenses.push(projectedExpenses);
    if (recentExpenses.length > 3) recentExpenses.shift();

    // Clean up tensors
    featureTensor.dispose();
    incomePredTensor.dispose();
    expensePredTensor.dispose();
  }

  return projections;
}

function saveProjectionsToStorage(result: ProjectionResult): void {
  try {
    // Save as JSON string to localStorage
    const dataString = JSON.stringify(result);
    localStorage.setItem("finance-projections", dataString);
    console.debug("[Projections] Saved to localStorage");
  } catch (error) {
    console.error("[Projections] Failed to save:", error);
  }
}

export function loadProjectionsFromStorage(): ProjectionResult | null {
  try {
    const dataString = localStorage.getItem("finance-projections");
    if (dataString === null) return null;

    const result = JSON.parse(dataString) as ProjectionResult;
    console.debug("[Projections] Loaded from localStorage");
    return result;
  } catch (error) {
    console.error("[Projections] Failed to load:", error);
    return null;
  }
}

export async function generateAndSaveProjections(currency = "GBP"): Promise<ProjectionResult> {
  console.debug(`[Projections] Starting generation for currency: ${currency}`);

  // STEP 1: Load CSV data
  console.debug("[Projections] Loading CSV data...");
  const transactions = await loadCSVFile("seedTransactions_1year_13000_labeled.csv");
  console.debug(`[Projections] Loaded ${transactions.length} transactions`);

  // STEP 2: Filter by currency
  const filteredTransactions = filterByCurrency(transactions, currency);
  console.debug(
    `[Projections] Filtered to ${filteredTransactions.length} ${currency} transactions`,
  );

  if (filteredTransactions.length === 0) {
    throw new Error(`No transactions found for currency: ${currency}`);
  }

  // STEP 3: Aggregate by month
  const monthlyData = aggregateByMonth(filteredTransactions);
  console.debug(`[Projections] Aggregated into ${monthlyData.length} months`);

  if (monthlyData.length < 3) {
    throw new Error("Need at least 3 months of data for meaningful predictions");
  }

  // STEP 4: Create features
  console.debug("[Projections] Creating features...");
  const { features, incomeLabels, expenseLabels, maxIncome, maxExpense, minYear, maxYear } =
    createFeatures(monthlyData);

  // STEP 5: Build models
  console.debug("[Projections] Building neural network models...");
  const incomeModel = buildModel();
  const expenseModel = buildModel();

  // STEP 6: Train models
  console.debug("[Projections] Training income model...");
  await trainModel(incomeModel, features, incomeLabels);

  console.debug("[Projections] Training expense model...");
  await trainModel(expenseModel, features, expenseLabels);

  // STEP 7: Generate projections
  console.debug("[Projections] Generating 12-month projections...");
  const projections = await generateProjections(
    incomeModel,
    expenseModel,
    monthlyData,
    maxIncome,
    maxExpense,
    minYear,
    maxYear,
    12, // Predict 12 months ahead
  );

  // STEP 8: Create result object
  const result: ProjectionResult = {
    projections,
    trainingDate: new Date().toISOString(),
    historicalMonths: monthlyData.length,
  };

  // STEP 9: Save to localStorage
  console.debug("[Projections] Saving to localStorage...");
  saveProjectionsToStorage(result);

  // STEP 10: Clean up models
  incomeModel.dispose();
  expenseModel.dispose();

  console.debug("[Projections] Complete! Generated predictions:");
  projections.slice(0, 3).forEach((p) => {
    console.debug(
      `  ${p.monthKey}: Income=${p.projectedIncome.toFixed(2)}, ` +
        `Expenses=${p.projectedExpenses.toFixed(2)}`,
    );
  });

  return result;
}

export type HistoricalYearlyData = {
  year: string;
  income: number;
  expenses: number;
};

export async function loadHistoricalYearlyData(currency = "GBP"): Promise<HistoricalYearlyData[]> {
  try {
    const transactions = await loadCSVFile("seedTransactions_1year_13000_labeled.csv");
    const filtered = filterByCurrency(transactions, currency);

    const yearMap = new Map<string, { income: number; expenses: number }>();

    for (const txn of filtered) {
      const year = txn.date.split("-")[0];
      if (!yearMap.has(year)) {
        yearMap.set(year, { income: 0, expenses: 0 });
      }
      const data = yearMap.get(year)!;
      if (txn.type === "income") {
        data.income += txn.amount;
      } else {
        data.expenses += txn.amount;
      }
    }

    return Array.from(yearMap.entries())
      .map(([year, data]) => ({
        year,
        income: data.income,
        expenses: data.expenses,
      }))
      .sort((a, b) => a.year.localeCompare(b.year));
  } catch (error) {
    console.error("[Projections] Failed to load historical data:", error);
    return [];
  }
}
