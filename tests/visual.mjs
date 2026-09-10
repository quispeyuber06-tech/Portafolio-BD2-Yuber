import {chromium as pw} from 'playwright-core';
import chromium from '@sparticuz/chromium';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const browser=await pw.launch({executablePath:root+'/tests/browser/chromium',args:chromium.args.filter(a=>!['--single-process','--disable-web-security','--allow-running-insecure-content'].includes(a)),headless:true});
const errors=[];
for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const ctx=await browser.newContext({viewport});const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+root+'/Portafolio-BD2-Profesional.html');await page.waitForSelector('dialog[open]');await page.screenshot({path:root+`/tests/login-${viewport.width}.png`});await page.getByRole('button',{name:'Explorar mi presentación'}).click();await page.waitForTimeout(700);
 for(const theme of ['jjk','game']){
  await page.locator(`[data-action="theme"][data-theme="${theme}"]`).click();
  for(const route of ['inicio','perfil','universidad','trabajos','progreso','recursos','cuenta']){
   await page.evaluate(r=>location.hash=r,route);await page.waitForTimeout(350);
   const checks=await page.evaluate(()=>({width:innerWidth,docWidth:document.documentElement.scrollWidth,headers:document.querySelectorAll('.site-header').length,images:[...document.querySelectorAll('main img')].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.alt),headings:[...document.querySelectorAll('main h1,main h2,main h3')].filter(h=>{const n=h.nextElementSibling;if(!n)return false;const r=document.createRange();r.selectNodeContents(h);return r.getBoundingClientRect().bottom>n.getBoundingClientRect().top+2&&n.getBoundingClientRect().width>0;}).map(h=>h.textContent)}));
   if(checks.docWidth>checks.width||checks.headers!==1||checks.images.length||checks.headings.length)errors.push({route,theme,viewport:viewport.width,...checks});
   if(['inicio','perfil','trabajos'].includes(route))await page.screenshot({path:root+`/tests/${route}-${theme}-${viewport.width}.png`,fullPage:true});
  }
 }
 await ctx.close();
}
await browser.close();fs.writeFileSync(root+'/tests/visual-results.json',JSON.stringify(errors,null,2));console.log(JSON.stringify({visualErrors:errors},null,2));if(errors.length)process.exit(1);
