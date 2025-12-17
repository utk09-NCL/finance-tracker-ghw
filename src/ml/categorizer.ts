import * as tf from "@tensorflow/tfjs";
import { DEMO_LABELS, DEMO_VOCAB } from "./generateAndSaveDemoModelToIndexedDB";

const VOCAB_LENGTH = DEMO_VOCAB.length;

function preprocess(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) return [];
  return cleaned.split(" ");
}

function toBow(tokens: string[]): Float32Array {
  const vec = new Float32Array(VOCAB_LENGTH);
  for (const tok of tokens) {
    for (let i = 0; i < VOCAB_LENGTH; i++) {
      if (tok.includes(DEMO_VOCAB[i])) vec[i] += 1;
    }
  }
  return vec;
}

async function loadModel(): Promise<tf.LayersModel | null> {
  try {
    return await tf.loadLayersModel("indexeddb://transaction-categorizer");
  } catch {
    console.warn("No ML model found in IndexedDB");
    return null;
  }
}

export async function suggestCategory(description: string): Promise<string> {
  if (!description || description.trim().length === 0) return "";

  const model = await loadModel();
  if (!model) return "";

  const tokens = preprocess(description);
  const bow = toBow(tokens);
  const input = tf.tensor2d(Array.from(bow), [1, VOCAB_LENGTH]);

  try {
    const pred = model.predict(input) as tf.Tensor;
    const probs = (await pred.data()) as Float32Array;

    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > bestVal) {
        bestVal = probs[i];
        bestIdx = i;
      }
    }

    pred.dispose();
    input.dispose();

    return DEMO_LABELS[bestIdx] ?? "";
  } catch {
    input.dispose();
    return "";
  }
}
