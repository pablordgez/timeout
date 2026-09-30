import { generateSudoku } from "./engine";
self.onmessage = (e) => {
  try {
    self.postMessage({ result: generateSudoku(e.data.seed, e.data.level) });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
