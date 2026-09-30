import engine from "../vendor/stockfish.js?raw";
import wasmUrl from "../vendor/stockfish.wasm?url&inline";
let instance: Worker | null = null;
let pending: ((move: string) => void) | null = null;
let ready: Promise<void> | null = null;
export function initializeEngine(): Promise<void> {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    const code = `const timeoutWasm=Uint8Array.from(atob(${JSON.stringify(wasmUrl.split(",")[1])}),c=>c.charCodeAt(0));const nativeFetch=self.fetch.bind(self);self.fetch=(url,options)=>String(url)==='timeout-engine.wasm'?Promise.resolve(new Response(timeoutWasm,{headers:{'Content-Type':'application/wasm'}})):nativeFetch(url,options);${engine}`;
    const url = URL.createObjectURL(
      new Blob([code], { type: "text/javascript" }),
    );

    const binary = "timeout-engine.wasm";
    instance = new Worker(url + "#" + encodeURIComponent(binary));
    const timer = setTimeout(() => {
      instance?.terminate();
      instance = null;
      ready = null;
      reject(Error("Stockfish initialization timed out"));
    }, 20000);
    instance.onmessage = (e) => {
      const line = String(e.data).trim();
      if (line === "uciok") {
        instance!.postMessage("isready");
      }
      if (line === "readyok") {
        clearTimeout(timer);
        resolve();
      }
      if (line.startsWith("bestmove ")) {
        pending?.(line.split(" ")[1]);
        pending = null;
      }
    };
    instance.onerror = (e) => {
      clearTimeout(timer);
      reject(Error(e.message));
      ready = null;
    };
    instance.postMessage("uci");
  });
  return ready;
}
async function searchMove(fen: string, difficulty: string): Promise<string> {
  await initializeEngine();
  const level = difficulty === "easy" ? 0 : difficulty === "hard" ? 15 : 6;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending = null;
      reject(Error("Stockfish search timeout"));
    }, 15000);
    pending = (move) => {
      clearTimeout(timer);
      resolve(move);
    };
    instance!.postMessage("setoption name Skill Level value " + level);
    instance!.postMessage("position fen " + fen);
    instance!.postMessage(
      "go movetime " +
        (difficulty === "hard" ? 800 : difficulty === "easy" ? 150 : 400),
    );
  });
}

let searches: Promise<unknown> = Promise.resolve();
export function engineMove(fen: string, difficulty: string): Promise<string> {
  const job = searches.catch(() => {}).then(() => searchMove(fen, difficulty));
  searches = job;
  return job;
}
