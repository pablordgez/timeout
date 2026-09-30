import engine from "../vendor/stockfish.js?raw";
import wasmUrl from "../vendor/stockfish.wasm?url";
let instance: Worker | null = null;
let pending: ((move: string) => void) | null = null;
let ready: Promise<void> | null = null;
async function wasmBase64(): Promise<string> {
  if (wasmUrl.startsWith("data:")) return wasmUrl.split(",")[1];
  const response = await fetch(wasmUrl);
  if (!response.ok) throw Error("Unable to load local Stockfish");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let raw = "";
  for (let i = 0; i < bytes.length; i += 32768)
    raw += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(raw);
}
export function initializeEngine(): Promise<void> {
  if (ready) return ready;
  ready = wasmBase64()
    .then(
      (base64) =>
        new Promise<void>((resolve, reject) => {
          const code = `const timeoutWasm=Uint8Array.from(atob(${JSON.stringify(base64)}),c=>c.charCodeAt(0));const nativeFetch=self.fetch.bind(self);self.fetch=(url,options)=>String(url)==='timeout-engine.wasm'?Promise.resolve(new Response(timeoutWasm,{headers:{'Content-Type':'application/wasm'}})):nativeFetch(url,options);${engine}`;
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
              URL.revokeObjectURL(url);
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
        }),
    )
    .catch((error) => {
      ready = null;
      throw error;
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
