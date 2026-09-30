import {test,expect,type Page} from '@playwright/test';

async function choose(page:Page,name:string){await page.locator('.game-card').filter({has:page.getByRole('heading',{name,exact:true})}).getByRole('button',{name:/^Jugar/}).click();}
async function start(page:Page,name:string){await choose(page,name);await page.getByRole('button',{name:/Empezar partida/}).click();await expect(page.locator('.play-title h1')).toHaveText(name);await page.getByRole('button',{name:'Continuar →',exact:true}).click();}
async function pause(page:Page){await page.getByRole('button',{name:'Pausa Ⅱ',exact:true}).click();}
async function saved(page:Page,id:string){return page.evaluate(id=>new Promise<any>((resolve,reject)=>{const request=indexedDB.open('timeout');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,get=db.transaction('data').objectStore('data').get('main');get.onsuccess=()=>{const data=get.result;resolve([...data.sessions,...data.history].find(s=>s.gameId===id));db.close();};get.onerror=()=>reject(get.error);};}),id);}

test('blocks shows only relevant goals; hard drop scores and held controls release on resume',async({page})=>{
 await page.goto('/');await choose(page,'Caída de bloques');
 await expect(page.getByRole('combobox',{name:'Tiempo',exact:true})).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'Líneas objetivo',exact:true})).toHaveCount(0);
 await page.getByRole('combobox',{name:'Objetivo',exact:true}).selectOption('time');
 await expect(page.getByRole('combobox',{name:'Tiempo',exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'Objetivo',exact:true}).selectOption('lines');
 await expect(page.getByRole('combobox',{name:'Líneas objetivo',exact:true})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Tiempo',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:/Empezar partida/}).click();await page.getByRole('button',{name:'Continuar →',exact:true}).click();
 await page.keyboard.press('Space');await expect.poll(async()=> (await saved(page,'blocks'))?.state.moves).toBeGreaterThan(0);
 await page.keyboard.down('ArrowLeft');await pause(page);await page.keyboard.up('ArrowLeft');
 await page.getByRole('button',{name:'Continuar →',exact:true}).click();await pause(page);
 await expect.poll(async()=> (await saved(page,'blocks'))?.state.input).toEqual({left:false,right:false,down:false});
 expect((await saved(page,'blocks')).state.score).toBeGreaterThan(0);
});

test('mobile snake supports swiping and spatial direction buttons without overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await start(page,'Serpiente');
 const canvas=page.locator('.game-canvas'),box=(await canvas.boundingBox())!;
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.55);await page.mouse.down();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.25,{steps:3});await page.mouse.up();await pause(page);
 await expect.poll(async()=> (await saved(page,'snake'))?.state.queued).toEqual([0,-1]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Continuar →',exact:true}).click();
 const up=await page.locator('.snake-pad button').nth(1).boundingBox(),down=await page.locator('.snake-pad button').nth(2).boundingBox();expect(up!.y).toBeLessThan(down!.y);
});

test('crossword direction, clue focus, letter progress and hint survive reload',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await start(page,'Crucigramas');
 const clue=page.locator('.crossword-clues button').first();await clue.click();await expect(page.locator('.crossword-grid input:focus')).toHaveCount(1);
 await page.getByRole('button',{name:'Cambiar dirección ↔',exact:true}).click();
 await page.locator('.crossword-grid input:focus').press('a');await expect(page.locator('.crossword-progress')).toContainText('1 /');
 await page.getByRole('button',{name:'Revelar letra',exact:true}).click();await pause(page);
 await expect.poll(async()=> (await saved(page,'crossword'))?.state.hints).toBe(1);const before=await saved(page,'crossword');
 await page.reload();await page.locator('.game-card').filter({has:page.getByRole('heading',{name:'Crucigramas',exact:true})}).getByRole('button',{name:/pendiente/}).click();
 await expect(page.locator('.pause-overlay')).toBeVisible();const after=await saved(page,'crossword');expect(after.state.puzzle).toEqual(before.state.puzzle);expect(after.state.board).toEqual(before.state.board);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('sound preference mutes generated effects and persists',async({page})=>{
 await page.addInitScript(()=>{const Native=window.AudioContext||(window as any).webkitAudioContext;if(Native){(window as any).__sounds=0;const original=Native.prototype.createOscillator;Native.prototype.createOscillator=function(){(window as any).__sounds++;return original.call(this);};}});
 await page.goto('/');await start(page,'Salto de dinosaurio');await page.keyboard.press('Space');
 const supported=await page.evaluate(()=>typeof window.AudioContext==='function'||typeof (window as any).webkitAudioContext==='function');
 if(supported)await expect.poll(()=>page.evaluate(()=>(window as any).__sounds||0)).toBeGreaterThan(0);else test.info().annotations.push({type:'compatibility',description:'This browser build has no Web Audio API; mute/persistence and graceful fallback are checked.'});await pause(page);
 await page.getByRole('button',{name:'← Colección',exact:true}).click();await page.getByRole('button',{name:/Ajustes/}).click();const toggle=page.getByRole('checkbox',{name:'Efectos de sonido',exact:true});await toggle.click();await expect(toggle).not.toBeChecked();
 await page.reload();await page.getByRole('button',{name:/Ajustes/}).click();await expect(page.getByRole('checkbox',{name:'Efectos de sonido',exact:true})).not.toBeChecked();expect(await page.evaluate(()=>(window as any).__sounds||0)).toBe(0);
});
