import {test,expect,type Page} from '@playwright/test';
test.use({baseURL:process.env.TIMEOUT_TEST_URL||'http://127.0.0.1:4173'});
async function start(page:Page){
 await page.goto('/');await page.locator('.game-card').filter({has:page.getByRole('heading',{name:'Billar',exact:true})}).getByRole('button',{name:/^Jugar/}).click();
 await page.getByRole('combobox',{name:'Modalidad',exact:true}).selectOption('practice');await page.getByRole('button',{name:/Empezar partida/}).click();await page.bringToFront();await page.locator('.pause-overlay').getByRole('button',{name:/Continuar/}).click();await expect(page.locator('.pause-overlay')).toBeHidden();
 await page.locator('canvas').scrollIntoViewIfNeeded();await expect(page.locator('canvas')).toBeVisible();await expect.poll(()=>page.locator('canvas').boundingBox()).not.toBeNull();const b=await page.locator('canvas').boundingBox();if(!b)throw Error('Missing pool canvas');
 const point=(x:number,y:number)=>({x:b.x+x/720*b.width,y:b.y+y/400*b.height});await page.mouse.click(point(170,200).x,point(170,200).y);return point;
}
async function saved(page:Page){return page.evaluate(async()=>new Promise<any>((resolve,reject)=>{const req=indexedDB.open('timeout',1);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,r=db.transaction('data').objectStore('data').get('main');r.onsuccess=()=>{db.close();resolve(r.result.sessions.find((s:any)=>s.gameId==='billiards')?.state);};r.onerror=()=>reject(r.error);};}));}
async function beginDrag(page:Page,point:(x:number,y:number)=>{x:number;y:number},distance=100){const a=point(170,200),b=point(170-distance,200);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});return b;}
test('mouse pull sets proportional power and release starts a real saved shot',async({page})=>{
 const point=await start(page);await beginDrag(page,point,100);await expect(page.locator('.pool-drag-help')).toContainText('Potencia del tirón: 55%');await expect(page.locator('.pool-surface')).toHaveAttribute('data-phase','aim');
 await page.mouse.up();await expect(page.locator('.pool-surface')).toHaveAttribute('data-phase','moving');await expect.poll(async()=>((await saved(page))?.shot?.wasBreak)).toBe(true);const state=await saved(page);expect(Math.abs(state.power-600)).toBeLessThan(10);expect(state.angle).toBeCloseTo(0,3);expect(state.pull).toBeUndefined();
});
test('Escape and blur cancel pull gestures without firing or saving transient drag state',async({page})=>{
 const point=await start(page);await beginDrag(page,point);await page.keyboard.press('Escape');await page.mouse.up();await expect(page.locator('.pool-surface')).toHaveAttribute('data-phase','aim');await expect(page.locator('.pool-drag-help')).toContainText('Arrastra hacia atrás');
 await beginDrag(page,point);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();await expect(page.locator('.pause-overlay')).toBeVisible();await expect(page.locator('.pool-surface')).toHaveAttribute('data-phase','aim');const state=await saved(page);expect(state.shots[0]).toBe(0);expect(state.shot).toBeNull();expect(state.pull).toBeUndefined();
});
test('pausing and pointer cancellation discard the pull before mouse release',async({page})=>{
 const point=await start(page);await beginDrag(page,point);const pause=page.locator('.play-title').getByRole('button',{name:'Pausa Ⅱ',exact:true});await pause.focus();await page.keyboard.press('Enter');await expect(page.locator('.pause-overlay')).toBeVisible();await page.mouse.up();await expect(page.locator('.pool-surface')).toHaveAttribute('data-phase','aim');
 await page.locator('.pause-overlay').getByRole('button',{name:/Continuar/}).click();await beginDrag(page,point);await page.locator('.pool-surface').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'});await page.mouse.up();await expect(page.locator('.pool-surface')).toHaveAttribute('data-phase','aim');await expect(page.locator('.pool-drag-help')).toContainText('Arrastra hacia atrás');expect((await saved(page)).shots[0]).toBe(0);
});
test('a tap only aims, and precise keyboard controls stay available inside the disclosure',async({page})=>{
 const point=await start(page),target=point(420,110);await page.mouse.click(target.x,target.y);await expect(page.locator('.pool-surface')).toHaveAttribute('data-phase','aim');await page.getByText('Controles precisos y teclado',{exact:true}).click();const angle=page.getByRole('slider',{name:'Ángulo de tiro',exact:true});await angle.focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('button',{name:'Sacar',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Sacar',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('.pool-surface')).toHaveAttribute('data-phase','moving');
});
test('pool canvas theme overrides recolor the felt and rail on the next frame',async({page})=>{
 await start(page);await page.evaluate(()=>{document.documentElement.style.setProperty('--pool-cloth','#123456');document.documentElement.style.setProperty('--pool-rail','#654321');});
 await expect.poll(()=>page.locator('canvas').evaluate(c=>[...(c as HTMLCanvasElement).getContext('2d')!.getImageData(200,100,1,1).data].slice(0,3).join(','))).toBe('18,52,86');await expect.poll(()=>page.locator('canvas').evaluate(c=>[...(c as HTMLCanvasElement).getContext('2d')!.getImageData(10,100,1,1).data].slice(0,3).join(','))).toBe('101,67,33');
});
test('practice hides opponent options and a local two-person game hides bot difficulty',async({page})=>{
 await page.goto('/');await page.locator('.game-card').filter({has:page.getByRole('heading',{name:'Billar',exact:true})}).getByRole('button',{name:/^Jugar/}).click();const mode=page.getByRole('combobox',{name:'Modalidad',exact:true});
 await mode.selectOption('practice');await expect(page.getByRole('combobox',{name:'Humanos (bola 8)',exact:true})).toHaveCount(0);await expect(page.getByRole('combobox',{name:'Dificultad',exact:true})).toHaveCount(0);
 await mode.selectOption('eight');await page.getByRole('combobox',{name:'Humanos (bola 8)',exact:true}).selectOption('2');await expect(page.getByRole('combobox',{name:'Dificultad',exact:true})).toHaveCount(0);
});
test('touch pulls use Pointer Events without scrolling and release shoots',async({browser,browserName})=>{
 test.skip(browserName!=='chromium','Actual touch input uses Chromium CDP; mouse coverage runs in all engines.');const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();const point=await start(page);const a=point(170,200),b=point(70,200),scroll=await page.evaluate(()=>scrollY),cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x,y:a.y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x,y:b.y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.locator('.pool-surface')).toHaveAttribute('data-phase','aim');await expect(page.locator('.pool-drag-help')).toContainText('Arrastra hacia atrás');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x,y:a.y,id:2}]});for(let step=1;step<=10;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*step/10,y:a.y,id:2}]});await expect(page.locator('.pool-drag-help')).toContainText('Potencia del tirón');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.locator('.pool-surface')).toHaveAttribute('data-phase','moving');expect(await page.evaluate(()=>scrollY)).toBe(scroll);await context.close();
});
