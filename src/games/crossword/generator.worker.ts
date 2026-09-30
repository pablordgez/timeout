import { generate } from './generator';
import { generateFamiliar } from './familiar';
self.onmessage=e=>{try{const {size,entries,seed,locale,difficulty}=e.data;const result=difficulty?generateFamiliar(size,entries,seed,locale,difficulty):generate(size,entries,seed,12);self.postMessage(result?{result}:{error:'No valid crossword found within the bounded search. Try another seed.'});}catch(error){self.postMessage({error:String(error)});}};
