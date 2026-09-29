import { generate } from './generator';
self.onmessage=e=>{try{const result=generate(e.data.size,e.data.entries,e.data.seed,12);self.postMessage(result?{result}:{error:'No valid crossword found within the bounded search. Try another seed.'});}catch(error){self.postMessage({error:String(error)});}};
