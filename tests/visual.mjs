import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launch} from './browser.mjs';
import {serve} from './server.mjs';
const server=await serve(),browser=await launch(),checks=[];
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(server.url);await p.locator('[data-action="guest"]').click();
 await p.screenshot({path:'tests/home.png',fullPage:true,animations:'disabled'});
 for(const width of [320,390,768,1440]){
  await p.setViewportSize({width,height:900});
  for(const route of ['inicio','perfil','universidad','trabajos','progreso','recursos']){
   await p.evaluate(route=>location.hash=route,route);await p.waitForTimeout(100);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width} ${route}`);
  }
  assert(await p.locator('.head-actions>.notify-btn').isVisible());
  checks.push(`Seis secciones sin desbordamiento horizontal y campana visible a ${width}px`);
 }
 await p.evaluate(()=>location.hash='inicio');await p.waitForTimeout(150);
 await p.locator('[data-action="theme"][data-theme="game"]').first().click();
 assert.equal(await p.locator('html').getAttribute('data-theme'),'game');
 await p.screenshot({path:'tests/game.png',fullPage:true,animations:'disabled'});
 checks.push('Cambio visual de tema y escena de personajes');
 await p.locator('[data-action="motion"]').first().click();
 await p.evaluate(()=>location.hash='perfil');await p.waitForTimeout(600);
 assert.equal(await p.locator('.page').evaluate(e=>getComputedStyle(e).opacity),'1');
 await p.locator('.header-admin').click();await p.waitForSelector('#login-form[data-role="admin"]');
 await p.waitForTimeout(350);
 assert.equal(await p.locator('dialog[open]').evaluate(e=>getComputedStyle(e).opacity),'1');
 await p.screenshot({path:'tests/admin-login.png',animations:'disabled'});
 checks.push('Pausar personajes permite abrir páginas y login sin ocultar su contenido');
 assert.deepEqual(errors,[]);
 fs.writeFileSync('tests/visual-resultado.json',JSON.stringify({date:new Date().toISOString(),checks,passed:checks.length},null,2));
 console.log(JSON.stringify({visualChecks:checks.length,errors}));
}finally{await browser.close();server.close()}
