import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { createReadStream,createWriteStream,existsSync } from 'node:fs';
import { createGunzip, gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
await mkdir('.cache',{recursive:true});await mkdir('src/data',{recursive:true});await mkdir('licenses',{recursive:true});
const configs=[{lang:'es',url:'https://kaikki.org/dictionary/downloads/es/es-extract.jsonl.gz',source:'https://kaikki.org/eswiktionary/'},{lang:'en',url:'https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz',source:'https://kaikki.org/dictionary/English/'}];
for(const cfg of configs){
const cache=`.cache/${cfg.lang}.jsonl.gz`;if(!existsSync(cache)){console.log('Downloading',cfg.url);const res=await fetch(cfg.url);if(!res.ok)throw Error(`${res.status} ${cfg.url}`);await pipeline(Readable.fromWeb(res.body),createWriteStream(cache));}
const words=new Map();const lines=createInterface({input:createReadStream(cache).pipe(createGunzip()),crlfDelay:Infinity});let records=0;
for await(const line of lines){if(!line)continue;const v=JSON.parse(line);if(v.lang_code!==cfg.lang)continue;records++;const w=String(v.word||'').normalize('NFC');if(w!==w.toLowerCase()||!new RegExp(cfg.lang==='es'?'^[a-záéíóúüñ]{2,20}$':'^[a-z]{2,20}$').test(w)||!['noun','verb','adj','adv','intj','pron','prep','conj','det','num'].includes(v.pos))continue;
let gloss='';for(const sense of v.senses||[]){if((sense.tags||[]).some(t=>['obsolete','archaic','rare','offensive','vulgar','proper-noun','name','form-of'].includes(t))||sense.form_of||sense.alt_of)continue;const g=(sense.glosses||[]).at(-1)?.replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim()||'';if(g.length<12||g.length>200||/^(inflection|plural|past |alternative|forma |conjugación|primera persona|segunda persona|tercera persona)/i.test(g))continue;if(g.toLowerCase().includes(w.toLowerCase()))continue;gloss=g;break;}
const prev=words.get(w);if(!prev||(!prev.g&&gloss))words.set(w,{w,g:gloss,p:v.pos});
}
const entries=[...words.values()].sort((a,b)=>a.w.localeCompare(b.w));const packed=JSON.stringify(entries);await writeFile(`src/data/${cfg.lang}.json`,packed);await writeFile(`src/data/${cfg.lang}.json.gz`,gzipSync(packed,{level:9}));const hash=createHash('sha256');for await(const chunk of createReadStream(cache))hash.update(chunk);await writeFile(`licenses/words-${cfg.lang}.json`,JSON.stringify({...cfg,license:'CC-BY-SA-4.0',attribution:'Wiktionary contributors; machine extraction by Kaikki / Wiktextract',retrievedAt:new Date().toISOString(),sha256:hash.digest('hex'),records,entries:entries.length,clues:entries.filter(e=>e.g).length,changes:'Filtered by language, part of speech, spelling and clue quality; selected gloss; compacted. Article attribution URLs: https://'+(cfg.lang==='es'?'es':'en')+'.wiktionary.org/wiki/{word}'},null,2));console.log(cfg.lang,'entries',entries.length,'clues',entries.filter(e=>e.g).length);
}
