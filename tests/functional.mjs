import {chromium as pw} from 'playwright-core';
import chromium from '@sparticuz/chromium';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const file='file://'+root+'/Portafolio-BD2-Profesional.html';
const host='https://axhngpimswxslllnajog.supabase.co';
const uid='11111111-1111-4111-8111-111111111111',aid='22222222-2222-4222-8222-222222222222',pid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const works=new Map(),objects=new Map(),errors=[];let networkFailure=false,loseCommit=false,listCalls=0;
const now=()=>new Date().toISOString();
function token(user){return Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test-signature';}
async function handler(route){
 const req=route.request(),url=new URL(req.url());if(networkFailure)return route.abort('internetdisconnected');
 const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)});
 if(req.method()==='OPTIONS')return send({});
 let json={};try{json=req.postDataJSON()||{};}catch{}
 let admin=false;try{admin=JSON.parse(Buffer.from((req.headers().authorization||'').split('.')[1],'base64url')).sub===aid;}catch{}
 if(url.pathname==='/auth/v1/token'){
  if(json.password==='wrong')return send({code:'invalid_credentials',message:'Invalid login credentials'},400);
  const user=json.email==='admin@example.test'?aid:uid;return send({access_token:token(user),refresh_token:'private-test-refresh-token',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:user,email:json.email,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}});
 }
 if(url.pathname==='/auth/v1/logout')return send({});
 if(url.pathname==='/rest/v1/rpc/bd2_session')return send({schemaVersion:1,portfolioId:pid,role:admin?'admin':'student'});
 if(url.pathname==='/rest/v1/rpc/bd2_list'){listCalls++;return send({works:[...works.values()],role:admin?'admin':'student',portfolioId:pid,admin});}
 if(url.pathname==='/rest/v1/rpc/bd2_save'){
  const {p_action:action,p_data:d}=json;
  if(action==='seen'){for(const row of works.values())row.seen=true;return send({ok:true});}
  if(action==='grade'?!admin:admin)return send({message:'No autorizado'},403);
  if(action==='create'){
   if(works.has(d.id))return send({code:'23505',message:'Duplicate'},409);
   assert(objects.has(d.object_path));works.set(d.id,{...d,created:now(),updated:now(),history:[],revision:1,grade:null,comment:'',seen:false});
   if(loseCommit){loseCommit=false;return route.abort('failed');}return send({ok:true,id:d.id});
  }
  const w=works.get(d.id);if(!w)return send({message:'No encontrado'},404);
  if(d.revision!==w.revision)return send({code:'40001',message:'Conflicto de edición'},409);
  if(action==='grade'){Object.assign(w,{grade:d.grade,comment:d.comment,seen:false,revision:w.revision+1,graded:now(),updated:now()});return send({ok:true,id:d.id});}
  if(action==='replace'){const {history,...old}=w;works.set(w.id,{...w,...d,history:[...history,old],grade:null,comment:'',revision:w.revision+1,updated:now()});return send({ok:true,id:d.id});}
  if(action==='restore'){const {history,...old}=w;works.set(w.id,{...w,...w.history[d.version],id:w.id,history:[...history,old],grade:null,comment:'',revision:w.revision+1,updated:now()});return send({ok:true,id:d.id});}
  if(action==='feature'){w.featured=!w.featured;w.revision++;return send({ok:true,id:d.id});}
  if(action==='cover'){w.cover=d.cover;w.revision++;return send({ok:true,id:d.id});}
  if(action==='delete'){works.delete(w.id);return send({ok:true,paths:[w.object_path,...w.history.map(h=>h.object_path)]});}
 }
 if(req.method()==='GET'&&/^\/storage\/v1\/object\/(authenticated\/)?bd2-works\//.test(url.pathname)){
  const p=decodeURIComponent(url.pathname.split('/bd2-works/')[1]),o=objects.get(p);if(!o)return send({message:'Not found'},404);return route.fulfill({status:200,contentType:o.type,body:o.bytes});
 }
 if(url.pathname.startsWith('/storage/v1/object/bd2-works/')&&req.method()==='POST'){
  const p=decodeURIComponent(url.pathname.split('/bd2-works/')[1]);const r=new Request('http://local.test',{method:'POST',headers:req.headers(),body:req.postDataBuffer()});
  let blob;if(req.headers()['content-type']?.includes('multipart')){const fd=await r.formData();blob=[...fd.values()].find(v=>typeof v!=='string');}else blob=await r.blob();objects.set(p,{bytes:Buffer.from(await blob.arrayBuffer()),type:blob.type});return send({Key:'bd2-works/'+p});
 }
 if(url.pathname==='/storage/v1/object/bd2-works'&&req.method()==='DELETE'){for(const p of json.prefixes||[])if(![...works.values()].some(w=>w.object_path===p||w.history.some(h=>h.object_path===p)))objects.delete(p);return send([]);}
 return send({message:'Unexpected test endpoint '+url.pathname},404);
}
let browser;
try{
 browser=await pw.launch({executablePath:root+'/tests/browser/chromium',args:chromium.args.filter(a=>!['--single-process','--disable-web-security','--allow-running-insecure-content'].includes(a)),headless:true});
 async function device(viewport){const context=await browser.newContext({viewport,acceptDownloads:true});await context.route(host+'/**',handler);const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(file);await p.waitForSelector('#login-form');return p;}
 async function login(p,email='student@example.test'){await p.getByLabel('Correo de tu cuenta').fill(email);await p.getByLabel('Contraseña',{exact:true}).fill('test-password-never-exported');await p.getByRole('button',{name:'Entrar a mi portafolio',exact:true}).click();await p.waitForSelector('dialog:not([open])',{state:'attached'});}
 async function route(p,name){await p.evaluate(n=>location.hash=n,name);await p.waitForTimeout(250);}
 const a=await device({width:1440,height:1000});
 await a.getByLabel('Correo de tu cuenta').fill('student@example.test');await a.getByLabel('Contraseña',{exact:true}).fill('wrong');await a.getByRole('button',{name:'Entrar a mi portafolio',exact:true}).click();await a.getByText('El correo o la contraseña no son correctos.',{exact:true}).waitFor();
 await login(a);await route(a,'trabajos');
 await a.getByRole('button',{name:'Subir trabajo',exact:true}).click();await a.locator('#upload-unit').selectOption('2');await a.locator('#upload-week').selectOption('3');await a.locator('#upload-day').selectOption('Jueves');await a.locator('#upload-file').setInputFiles({name:'Informe.txt',mimeType:'text/plain',buffer:Buffer.from('Entrega original desde computadora A')});await a.locator('#upload-title').fill('Mi primera evidencia');
 assert.equal(works.size,0,'selecting file must not save');await a.getByRole('button',{name:'Guardar trabajos',exact:true}).click();await a.waitForSelector('dialog:not([open])',{state:'attached'});assert.equal(works.size,1);const id=[...works.keys()][0];assert.equal(works.get(id).name,'Mi primera evidencia.txt');assert.equal(works.get(id).unit,2);assert.equal(works.get(id).week,3);
 const b=await device({width:390,height:844});await login(b);await b.getByRole('button',{name:'Abrir menú',exact:true}).click();await b.locator('.nav').getByRole('link',{name:'Trabajos',exact:true}).click();await b.locator('[data-action="unit"][data-unit="2"]').click();await b.locator('[data-action="week"][data-week="3"]').click();await b.getByRole('heading',{name:'Mi primera evidencia.txt',exact:true}).waitFor();
 const dl=b.waitForEvent('download');await b.locator('[data-action="download"][data-id="'+id+'"]').click();const downloaded=await dl;await downloaded.saveAs(root+'/tests/download.txt');assert.equal(fs.readFileSync(root+'/tests/download.txt','utf8'),'Entrega original desde computadora A');
 await b.locator('[data-action="edit"]').click();await b.locator('#upload-file').setInputFiles({name:'Revisado.txt',mimeType:'text/plain',buffer:Buffer.from('Archivo corregido desde celular B')});await b.locator('#upload-title').fill('Mi evidencia corregida');await b.locator('#upload-description').fill('Comparación de arquitecturas de bases de datos.');await b.getByRole('button',{name:'Guardar cambios',exact:true}).click();await b.waitForSelector('dialog:not([open])',{state:'attached'});assert.equal(works.get(id).history.length,1);assert.equal(works.get(id).name,'Mi evidencia corregida.txt');
 await a.locator('[data-action="refresh"]').click();await a.getByRole('heading',{name:'Mi evidencia corregida.txt',exact:true}).waitFor();
 await route(b,'cuenta');await b.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await b.waitForSelector('#login-form');await login(b,'admin@example.test');await route(b,'trabajos');await b.locator('[data-action="grade"]').click();await b.locator('#grade-value').fill('19');await b.locator('#grade-comment').fill('Revisión desde el dispositivo B.');await b.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(works.get(id).grade,null,'cancel must not submit');
 await b.locator('[data-action="grade"]').click();await b.locator('#grade-value').fill('19');await b.locator('#grade-comment').fill('Revisión desde el dispositivo B.');await b.getByRole('button',{name:'Guardar evaluación',exact:true}).click();await b.waitForSelector('dialog:not([open])',{state:'attached'});assert.equal(works.get(id).grade,19);assert.equal(await b.locator('[data-action="upload"]').count(),0);
 await a.locator('[data-action="refresh"]').click();await a.waitForTimeout(300);await route(a,'notificaciones');await a.getByText('Revisión desde el dispositivo B.',{exact:true}).waitFor();
 await route(a,'trabajos');networkFailure=true;await a.getByRole('button',{name:'Subir trabajo',exact:true}).click();await a.locator('#upload-file').setInputFiles({name:'No-confirmado.txt',mimeType:'text/plain',buffer:Buffer.from('Entrega sin respuesta')});await a.getByRole('button',{name:'Guardar trabajos',exact:true}).click();await a.waitForFunction(()=>document.querySelector('.form-error')?.textContent.length>0);assert.equal(works.size,1);assert.equal(await a.locator('dialog[open]').count(),1);networkFailure=false;
 loseCommit=true;await a.getByRole('button',{name:'Guardar trabajos',exact:true}).click();await a.waitForFunction(()=>document.querySelector('.form-error')?.textContent.length>0);assert.equal(works.size,2);await a.getByRole('button',{name:'Guardar trabajos',exact:true}).click();await a.waitForSelector('dialog:not([open])',{state:'attached'});assert.equal(works.size,2,'retry after lost response must not duplicate');
 await route(a,'cuenta');const exp=a.waitForEvent('download');await a.getByRole('button',{name:'Descargar HTML conectado',exact:true}).click();const connected=await exp;await connected.saveAs(root+'/tests/connected.html');await a.waitForSelector('dialog:not([open])',{state:'attached'});const connectedText=fs.readFileSync(root+'/tests/connected.html','utf8');assert(connectedText.includes(host));assert(!connectedText.includes('test-password-never-exported'));assert(!connectedText.includes('private-test-refresh-token'));assert(!connectedText.includes(token(uid)));assert(!connectedText.includes('student@example.test'));
 const bak=a.waitForEvent('download');await a.getByRole('button',{name:'Guardar copia sin conexión',exact:true}).click();const backup=await bak;await backup.saveAs(root+'/tests/offline.html');await a.waitForSelector('dialog:not([open])',{state:'attached'});const backupText=fs.readFileSync(root+'/tests/offline.html','utf8');assert(backupText.includes('"mode":"offline"'));assert(!backupText.includes('private-test-refresh-token'));
 const oc=await browser.newContext();await oc.route('https://**/*',r=>r.abort());const op=await oc.newPage();await op.goto('file://'+root+'/tests/offline.html');await op.waitForFunction(async()=>{const d=await(await fetch('/api/portfolio')).json();return d.works.length===2;});const saved=await op.evaluate(async()=>{const d=await(await fetch('/api/portfolio')).json();const w=await window.portfolioFile(d.works.find(w=>w.name==='Mi evidencia corregida.txt').id);return {count:d.works.length,text:await w.file.text(),configured:window.portfolioCloud.getState().configured};});assert.deepEqual(saved,{count:2,text:'Archivo corregido desde celular B',configured:false});
 const cc=await browser.newContext();await cc.route(host+'/**',handler);const cp=await cc.newPage();await cp.goto('file://'+root+'/tests/connected.html');await cp.waitForSelector('#login-form');assert.equal(await cp.locator('#login-password').inputValue(),'');
 await route(a,'trabajos');await a.locator('[data-action="work-menu"][data-id="'+id+'"]').click();await a.getByRole('button',{name:'Ver historial de versiones',exact:true}).click();await a.getByRole('button',{name:'Restaurar',exact:true}).click();await a.getByRole('button',{name:'Restaurar versión',exact:true}).click();await a.waitForSelector('dialog:not([open])',{state:'attached'});assert.equal(works.get(id).name,'Mi primera evidencia.txt');assert.equal(works.get(id).history.length,2);assert.equal(works.get(id).grade,null);
 await a.locator('[data-action="work-menu"][data-id="'+id+'"]').click();await a.getByRole('button',{name:'Eliminar trabajo',exact:true}).click();await a.getByRole('button',{name:'Conservar',exact:true}).click();assert(works.has(id));
 await a.locator('[data-action="work-menu"][data-id="'+id+'"]').click();await a.getByRole('button',{name:'Eliminar trabajo',exact:true}).click();await a.getByRole('button',{name:'Eliminar trabajo',exact:true}).click();await a.waitForSelector('dialog:not([open])',{state:'attached'});assert(!works.has(id));
 await a.getByRole('button',{name:'Abrir asistente del portafolio',exact:true}).click();await a.locator('[data-action="bot-ask"][data-text="Mi progreso"]').click();assert((await a.locator('.bot-log').innerText()).includes('1 trabajo guardado'));assert(!await a.getByText('Guía de misión',{exact:true}).count());
 assert(listCalls<90,'no request feedback loop');await a.evaluate(()=>{window.scrollTo(0,0);document.activeElement?.blur();});await b.evaluate(()=>{window.scrollTo(0,0);document.activeElement?.blur();});assert.deepEqual(errors,[]);await a.screenshot({path:root+'/tests/workflow-desktop.png',fullPage:true});await b.screenshot({path:root+'/tests/admin-mobile.png',fullPage:true});
 const result={status:'PASS',listCalls,checks:['Inicio de sesión y rechazo de contraseña incorrecta','Selección de archivo sin guardado prematuro','Guardar trabajos y consultar desde otro dispositivo','Descarga con bytes iguales al archivo original','Edición con historial','Cancelar evaluación sin guardar','Roles de estudiante y administrador','Notas visibles en el otro dispositivo','Error de red sin confirmación falsa','Reintento tras respuesta perdida sin duplicar','HTML exportado sin sesión ni contraseña','Copia offline con bytes del archivo','Restauración de versión y borrado confirmado','Asistente funcional sin letrero inferior'],scope:'Supabase simulado. Sin escrituras al proyecto real.'};fs.writeFileSync(root+'/tests/functional-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e.stack);process.exitCode=1;}finally{await browser?.close();}
