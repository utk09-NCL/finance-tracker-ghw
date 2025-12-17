import * as tf from "@tensorflow/tfjs";
import { seedTransactionsAll } from "../data/seedData";

export const DEMO_LABELS: string[] = [
  "exp-groceries-tesco",
  "exp-groceries-sainsburys",
  "exp-subscriptions-ai",
  "exp-subscriptions-entertainment",
  "exp-rent",
  "exp-coffee",
  "inc-salary",
  "inc-bonus",
  "exp-utilities-gym",
  "exp-utilities-internet",
  "exp-dining",
];

export const DEMO_VOCAB: string[] = [
  "salary",
  "bonus",
  "rent",
  "tesco",
  "asda",
  "sainsbury",
  "grocery",
  "groceries",
  "netflix",
  "spotify",
  "chatgpt",
  "claude",
  "subscription",
  "coffee",
  "cafe",
  "nero",
  "costa",
  "pauls",
  "starbucks",
  "exercise",
  "gym",
  "wifi",
  "internet",
  "dining",
  "restaurant",
  "lunch",
  "dinner",
];

const VOCAB_LENGTH = DEMO_VOCAB.length;

// input: Groceries at tesco, £45.50
// output: ["groceries", "at", "tesco", "45", "50"]
export function preprocess(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// input: ["groceries", "at", "tesco", "45", "50"]
// output: [0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
function toBow(tokens: string[]): Float32Array {
  const vec = new Float32Array(VOCAB_LENGTH);
  for (const token of tokens) {
    for (let i = 0; i < DEMO_VOCAB.length; i++) {
      if (token.includes(DEMO_VOCAB[i])) {
        vec[i] += 1;
      }
    }
  }
  return vec;
}

// input: "inc-bonus"
// output: 7 (index of "inc-bonus" in DEMO_LABELS), if not found, return null
function labelIndex(categoryId: string): number | null {
  const index = DEMO_LABELS.indexOf(categoryId);
  return index === -1 ? null : index;
}

export async function generateAndSaveDemoModelToIndexedDB(): Promise<void> {
  const examples = [...seedTransactionsAll];
  console.debug(examples.length);

  const filtered = examples.filter((t) => labelIndex(t.category) !== null);

  console.debug(filtered.length);

  if (filtered.length === 0) {
    throw new Error("No valid examples found for demo model.");
  }

  const xs = filtered.map((t) => Array.from(toBow(preprocess(t.description))));
  const ys = filtered.map((t) => labelIndex(t.category)!);

  const total = xs.length;
  const trainSize = Math.max(1, Math.floor(total * 0.8));
  const testSize = Math.max(1, total - trainSize);
  console.debug("[DEMO MODEL] Dataset sizes: ", { total, trainSize, testSize });

  const xsTrain = xs.slice(0, trainSize); // [[0, 1, 0, 1, 0], [1, 0, 0, 0, 1]]
  const ysTrain = ys.slice(0, trainSize); // [7, 0] // ["inc-bonus", "exp-groceries-tesco"]
  const xsTest = xs.slice(trainSize);
  const ysTest = ys.slice(trainSize);

  // input: ([[0, 1, 0, 1, 0], [1, 0, 0, 0, 1]], [2, 20])
  const xTensor = tf.tensor2d(xsTrain, [xsTrain.length, VOCAB_LENGTH]);
  // [7, 0] -> one-hot -> [[0,0,0,0,0,0,0,1,0,0], [1,0,0,0,0,0,0,0,0,0]]
  const yTensor = tf.oneHot(tf.tensor1d(ysTrain, "int32"), DEMO_LABELS.length);

  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      inputShape: [VOCAB_LENGTH], // [0, 1, 0, 1, 0, .... 0] // 20
      units: 24, // number of neurons
      activation: "relu",
    }),
  );

  model.add(
    tf.layers.dense({
      units: DEMO_LABELS.length, // number of classes
      activation: "softmax",
    }),
  );

  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });

  await model.fit(xTensor, yTensor, {
    epochs: 30,
    batchSize: Math.min(16, xsTrain.length),
    shuffle: true,
    verbose: 1,
  });

  if (testSize > 0) {
    const xTestTensor = tf.tensor2d(xsTest, [xsTest.length, VOCAB_LENGTH]);
    const preds = model.predict(xTestTensor) as tf.Tensor;
    const probs = (await preds.array()) as number[][];
    preds.dispose();
    xTestTensor.dispose();

    let correct = 0;
    const perClass: Record<string, { tp: number; total: number }> = {};
    for (let i = 0; i < DEMO_LABELS.length; i++) {
      perClass[DEMO_LABELS[i]] = { tp: 0, total: 0 };
    }

    for (let i = 0; i < probs.length; i++) {
      const p = probs[i];
      let bestIdx = 0;
      let bestVal = -Infinity;
      for (let j = 0; j < p.length; j++) {
        if (p[j] > bestVal) {
          bestVal = p[j];
          bestIdx = j;
        }
      }

      const gold = ysTest[i];
      const goldLabel = DEMO_LABELS[gold];
      perClass[goldLabel].total += 1;
      if (bestIdx === gold) {
        correct += 1;
        perClass[goldLabel].tp += 1;
      }
    }

    const accuracy = correct / probs.length;
    console.debug(
      "[Demo Model] Test accuracy:",
      JSON.stringify({ correct, total: probs.length, accuracy }),
    );
    console.debug(
      "[Demo Model] Per-class hits (tp=true positives, total=test samples per class):",
      perClass,
    );
  }

  await model.save("indexeddb://transaction-categorizer");

  xTensor.dispose();
  yTensor.dispose();
  model.dispose();
  console.debug("[Demo Model] Saved to IndexedDB under 'transaction-categorizer'.");
}
