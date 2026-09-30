import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await mkdir('src/vendor',{recursive:true}); await mkdir('licenses',{recursive:true});
const version='19.0.0';
const files=[['https://github.com/nmrugg/stockfish.js/releases/download/v'+version+'/stockfish-19-lite-single.js','src/vendor/stockfish.js'],['https://github.com/nmrugg/stockfish.js/releases/download/v'+version+'/stockfish-19-lite-single.wasm','src/vendor/stockfish.wasm'],['https://raw.githubusercontent.com/nmrugg/stockfish.js/v'+version+'/Copying.txt','LICENSE'],['https://raw.githubusercontent.com/nmrugg/stockfish.js/v'+version+'/AUTHORS','licenses/STOCKFISH-AUTHORS.txt']];
const manifest=[];
for(const [url,path] of files){const res=await fetch(url);if(!res.ok)throw Error(`${res.status} ${url}`);const bytes=Buffer.from(await res.arrayBuffer());await writeFile(path,bytes);manifest.push({url,path,sha256:createHash('sha256').update(bytes).digest('hex')});console.log(path,bytes.length);}
await writeFile('licenses/stockfish-manifest.json',JSON.stringify({version,license:'GPL-3.0',source:'https://github.com/nmrugg/stockfish.js/tree/v'+version,files:manifest},null,2));
