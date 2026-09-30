import {test,expect,type Page,type Locator} from '@playwright/test';
test.use({baseURL:process.env.TIMEOUT_TEST_URL||'http://127.0.0.1:4173'});

async function practice(page:Page,variant='klondike') {
  await page.goto('/');
  await page.locator('.game-card').filter({has:page.getByRole('heading',{name:'Solitarios',exact:true})}).getByRole('button',{name:/^Jugar/}).click();
  await page.getByRole('combobox',{name:'Variante',exact:true}).selectOption(variant);
  await page.getByRole('button',{name:/Empezar partida/}).click();
  await page.locator('.pause-overlay').getByRole('button',{name:/Continuar/}).click();
  await page.getByText('Cómo jugar · guía visual y práctica',{exact:true}).click();
  await page.getByRole('button',{name:'Abrir práctica interactiva',exact:true}).click();
  return page.locator('.sol-demo');
}
async function points(source:Locator,target:Locator) {
  await source.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();
  const a=await source.boundingBox(),b=await target.boundingBox();
  if(!a||!b)throw Error('Missing drag bounds');
  return {from:{x:a.x+12,y:a.y+12},to:{x:b.x+b.width/2,y:b.y+12}};
}
async function mouseDrag(page:Page,source:Locator,target:Locator) {
  const {from,to}=await points(source,target);
  await page.mouse.move(from.x,from.y);await page.mouse.down();
  await page.mouse.move(from.x+10,from.y+10);await expect(page.locator('.sol-drag-ghost')).toBeVisible();
  await page.mouse.move(to.x,to.y,{steps:10});
}
for(const variant of ['klondike','spider','freecell'])test(`${variant}: mouse drags complete groups, previews legal target and undo restores cards`,async({page})=>{
  const demo=await practice(page,variant);
  const sourceName=variant==='spider'?'6 picas':'6 corazones';const targetName=variant==='spider'?'7 corazones':'7 tréboles';
  const source=demo.getByRole('button',{name:new RegExp(`^${sourceName}`)});const target=demo.getByRole('button',{name:new RegExp(`^${targetName}`)});
  await mouseDrag(page,source,target);
  await expect(page.locator('.sol-drag-ghost .sol-card')).toHaveCount(2);
  await expect(target).toHaveClass(/sol-drop-ready/);
  if(variant==='klondike')await page.screenshot({path:test.info().outputPath('desktop-ghost-stack.png')});
  await page.mouse.up();
  await expect(page.locator('.sol-drag-ghost')).toHaveCount(0);
  await expect(demo.locator('.sol-tools')).toContainText('Movimientos: 1');
  await expect(demo.getByRole('button',{name:new RegExp(`^${sourceName} · columna 2`)})).toBeVisible();
  await expect(demo.getByRole('button',{name:/^5 picas · columna 2/})).toBeVisible();
  await demo.getByRole('button',{name:'↶ Deshacer',exact:true}).click();
  await expect(demo.locator('.sol-tools')).toContainText('Movimientos: 0');
  await expect(demo.getByRole('button',{name:new RegExp(`^${sourceName} · columna 1`)})).toBeVisible();
});
test('illegal and cancelled drops leave the complete board unchanged',async({page})=>{
  const demo=await practice(page);const source=demo.getByRole('button',{name:/^6 corazones/});
  const illegal=demo.locator('.sol-slot[data-sol-zone="tableau"][data-sol-index="2"]');
  await mouseDrag(page,source,illegal);await expect(illegal).not.toHaveClass(/sol-drop-ready/);await page.mouse.up();
  await expect(demo.locator('.sol-tools')).toContainText('Movimientos: 0');await expect(source).toHaveAttribute('aria-pressed','false');
  const target=demo.getByRole('button',{name:/^7 tréboles/});await mouseDrag(page,source,target);await page.keyboard.press('Escape');await page.mouse.up();
  await expect(page.locator('.sol-drag-ghost')).toHaveCount(0);await expect(demo.locator('.sol-tools')).toContainText('Movimientos: 0');
  // Keyboard and click remain first-class alternatives after a cancelled drag.
  await source.focus();await page.keyboard.press('Enter');await target.focus();await page.keyboard.press('Enter');
  await expect(demo.locator('.sol-tools')).toContainText('Movimientos: 1');
});
test('Pyramid drag pairs exposed cards and kings still remove by click',async({page})=>{
  const demo=await practice(page,'pyramid');
  const source=demo.getByRole('button',{name:/^6 picas/});const target=demo.getByRole('button',{name:/^7 corazones/});
  await mouseDrag(page,source,target);await expect(target).toHaveClass(/sol-drop-ready/);await page.mouse.up();
  await expect(source).toHaveCount(0);await expect(target).toHaveCount(0);await expect(demo.locator('.sol-tools')).toContainText('Movimientos: 1');
  await demo.getByRole('button',{name:/^K tréboles/}).click();
  await expect(demo.locator('.sol-tools')).toContainText('Movimientos: 2');
});
test('touch Pointer Events transfer groups without scrolling the page',async({browser,browserName})=>{
  test.skip(browserName!=='chromium','Real touch drag uses Chromium CDP input; desktop drags cover the other engines.');
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();const demo=await practice(page);
  const source=demo.getByRole('button',{name:/^6 corazones/});const target=demo.getByRole('button',{name:/^7 tréboles/});
  const {from,to}=await points(source,target);const before=await page.evaluate(()=>scrollY);const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:1}]});
  for(let step=1;step<=10;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*step/10,y:from.y+(to.y-from.y)*step/10,id:1}]});
  await expect(page.locator('.sol-drag-ghost .sol-card')).toHaveCount(2);await expect(target).toHaveClass(/sol-drop-ready/);
  await page.screenshot({path:test.info().outputPath('touch-ghost-stack.png')});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(demo.locator('.sol-tools')).toContainText('Movimientos: 1');
  expect(await page.evaluate(()=>scrollY)).toBe(before);
  await demo.getByRole('button',{name:'↶ Deshacer',exact:true}).click();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:to.x,y:to.y,id:1}]});
  await expect(page.locator('.sol-drag-ghost')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(page.locator('.sol-drag-ghost')).toHaveCount(0);
  await expect(demo.locator('.sol-tools')).toContainText('Movimientos: 0');
  await context.close();
});
test('solitaire setup shows only options relevant to the selected variant',async({page})=>{
  await page.goto('/');await page.locator('.game-card').filter({has:page.getByRole('heading',{name:'Solitarios',exact:true})}).getByRole('button',{name:/^Jugar/}).click();
  const variant=page.getByRole('combobox',{name:'Variante',exact:true});
  await expect(page.getByRole('combobox',{name:'Klondike: cartas por robo',exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Spider: número de palos',exact:true})).toHaveCount(0);
  await variant.selectOption('spider');await expect(page.getByRole('combobox',{name:'Klondike: cartas por robo',exact:true})).toHaveCount(0);
  await expect(page.getByRole('combobox',{name:'Spider: número de palos',exact:true})).toBeVisible();
  await variant.selectOption('freecell');await expect(page.getByRole('combobox')).toHaveCount(1);
});
