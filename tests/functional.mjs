import assert from 'node:assert/strict';import fs from 'node:fs';import {launch} from './browser.mjs';import {serve} from './server.mjs';
const server=await serve(),browser=await launch();
const project='https://axhngpimswxslllnajog.supabase.co',portfolioId='e8b4c62a-3cd1-4c94-97f1-6d9e7c8b2341';
const users={student:{id:'01bb63b5-607e-4a54-832d-7c6a847e8032',email:'quispeyuber06@gmail.com'},admin:{id:'0aaa8e74-e4a0-47fc-8c52-622e4f56604c',email:'quispeyuber06+admin@gmail.com'}};
const works=[],files=new Map(),checks=[],errors=[];let writes=0,networkDown=false;
function token(role){return Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:users[role].id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated',testRole:role})).toString('base64url')+'.test';}
function roleFrom(req){try{return JSON.parse(Buffer.from(req.headers().authorization.split('.')[1],'base64url')).testRole;}catch{return null;}}
async function context(){const c=await browser.newContext({viewport:{width:1440,height:1000}});await c.route(project+'/**',async route=>{
 const req=route.request(),url=new URL(req.url()),role=roleFrom(req);
 const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(networkDown&&url.pathname.includes('/rest/'))return route.abort('failed');
 if(url.pathname==='/auth/v1/token'){const b=req.postDataJSON();if(b.password!=='fixture-password')return reply({error:'invalid_grant',error_description:'Invalid login credentials'},400);const r=Object.keys(users).find(k=>users[k].email===b.email);if(!r)return reply({msg:'Invalid login credentials'},400);return reply({access_token:token(r),refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user:{...users[r],aud:'authenticated',role:'authenticated'}});}
 if(url.pathname==='/auth/v1/logout')return reply({});
 if(!role)return reply({message:'Acceso denegado',code:'42501'},401);
 if(url.pathname.endsWith('/bd2_session'))return reply({schemaVersion:1,portfolioId,role});
 if(url.pathname.endsWith('/bd2_list'))return reply({works,role,admin:role==='admin',portfolioId});
 if(url.pathname.startsWith('/storage/v1/object/')){
  let path=url.pathname.replace(/^\/storage\/v1\/object\/(authenticated\/)?bd2-works\//,'');
  if(req.method()==='POST'){
   if(role!=='student')return reply({message:'Solo estudiante'},403);
   const form=await new Request('http://local',{method:'POST',headers:{'content-type':req.headers()['content-type']},body:req.postDataBuffer()}).formData();
   const blob=[...form.values()].find(v=>typeof v!=='string');files.set(path,{bytes:Buffer.from(await blob.arrayBuffer()),type:blob.type});return reply({Key:'bd2-works/'+path});
  }
  if(req.method()==='GET'){const f=files.get(path);return f?route.fulfill({status:200,contentType:f.type,body:f.bytes}):reply({message:'No existe'},404);}
 }
 if(url.pathname.endsWith('/bd2_save')){
  const {p_action:a,p_data:d}=req.postDataJSON();
  if((a==='grade'&&role!=='admin')||(a!=='grade'&&role!=='student'))return reply({code:'42501',message:'Esta acción no está permitida para tu cuenta.'},403);
  if(a==='seen'){works.forEach(w=>{if(w.grade!=null)w.seen=true;});return reply({ok:true});}
  if(a==='create'){if(!files.has(d.object_path))return reply({message:'Archivo no subido'},400);works.push({...d,revision:1,created:new Date().toISOString(),updated:new Date().toISOString(),grade:null,comment:'',seen:false,graded:null,history:[]});writes++;return reply({ok:true,id:d.id});}
  const w=works.find(w=>w.id===d.id);if(!w)return reply({message:'No existe'},404);
  if(w.revision!==d.revision)return reply({message:'Conflicto de revisión',code:'40001'},409);
  if(a==='grade'){if(!Number.isInteger(d.grade)||d.grade<0||d.grade>20)return reply({message:'Nota inválida'},400);Object.assign(w,{grade:d.grade,comment:d.comment,graded:new Date().toISOString(),seen:false});}
  if(a==='replace'){const h={...w};delete h.history;w.history.push(h);Object.assign(w,{name:d.name,description:d.description,grade:null,comment:'',seen:false,graded:null});if(d.object_path)Object.assign(w,{object_path:d.object_path,size:d.size,type:d.type});}
  w.revision++;w.updated=new Date().toISOString();writes++;return reply({ok:true,id:w.id});
 }
 return reply({message:'Endpoint no simulado: '+url.pathname},404);
 });return c;}
async function login(page,role){await page.locator('#login-email').fill(role==='admin'?'ADMIN':users.student.email);await page.locator('#login-password').fill('fixture-password');await page.locator('#login-form button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);}
try{
 const studentContext=await context(),adminContext=await context(),student=await studentContext.newPage(),admin=await adminContext.newPage();
 for(const page of [student,admin])page.on('pageerror',e=>errors.push(e.message));
 await student.goto(server.url);await student.waitForSelector('#login-form');await login(student,'student');await student.waitForSelector('#work-results');
 // A student cannot activate the admin view or perform a grading RPC.
 await student.locator('.header-admin').click();await student.locator('#login-email').fill(users.student.email);await student.locator('#login-password').fill('fixture-password');await student.locator('#login-form button[type="submit"]').click();await student.waitForFunction(()=>document.querySelector('.form-error')?.textContent.includes('cuenta es de estudiante'));assert.equal(await student.evaluate(()=>window.portfolioCloud.getState().role),'');checks.push('Login rechaza cuenta estudiante en acceso administrador');
 await student.locator('[data-action="student-login"]').click();await login(student,'student');
 const denied=await student.evaluate(async()=>{const r=await fetch('/api/portfolio',{method:'POST',body:JSON.stringify({action:'grade',id:'missing',grade:20})});return r.ok;});assert.equal(denied,false);checks.push('No se concede permiso de evaluación a estudiante');
 await student.locator('[data-action="upload"]').first().click();await student.locator('#upload-file').setInputFiles({name:'Modelo-relacional.txt',mimeType:'text/plain',buffer:Buffer.from('Modelo relacional: Cliente y Pedido. Evidencia de prueba.')});await student.locator('#upload-title').fill('Modelo relacional');await student.locator('#upload-description').fill('Relaciones entre clientes y pedidos.');
 assert.equal(works.length,0);await student.locator('#upload-form button[type="submit"]').click();await student.waitForFunction(()=>!document.querySelector('#dialog').open);assert.equal(works.length,1);assert.equal(files.size,1);checks.push('Seleccionar archivo no guarda; Guardar trabajos sube bytes y registra entrega');
 await admin.goto(server.url+'#administrador');await admin.waitForSelector('#login-form[data-role="admin"]');await login(admin,'admin');await admin.waitForSelector('.admin-layout');assert.equal(await admin.locator('.review-card').count(),1);checks.push('Otro dispositivo recibe la misma entrega en panel de administrador');
 await admin.screenshot({path:'tests/admin-desktop.png',fullPage:true,animations:'disabled'});
 await admin.locator('[data-action="preview"]').first().click();await admin.waitForSelector('#dialog[open]');await admin.waitForFunction(()=>document.querySelector('#dialog pre')?.textContent.includes('Modelo relacional'));await admin.locator('[data-action="close"]').first().click();checks.push('Administrador abre los bytes del archivo recibido');
 await admin.locator('[data-action="grade"]').first().click();await admin.locator('#grade-value').fill('21');await admin.locator('#grade-comment').fill('Revisión');const before=writes;await admin.locator('#grade-form button[type="submit"]').click();assert.equal(writes,before);assert.equal(await admin.locator('#grade-value').evaluate(e=>e.validity.valid),false);checks.push('La nota fuera de 0 a 20 no se envía');
 await admin.locator('#grade-value').fill('18');await admin.locator('#grade-comment').fill('Buen trabajo. Revisa la clave foránea de Pedido.');await admin.locator('#grade-form button[type="submit"]').click();await admin.waitForFunction(()=>!document.querySelector('#dialog').open);assert.equal(works[0].grade,18);assert.equal(works[0].seen,false);
 await student.evaluate(()=>window.portfolioCloud.refresh());await student.waitForSelector('#notify-count:not([hidden])');await student.locator('[data-action="notifications"]').click();await student.waitForSelector('.notification');assert.match(await student.locator('.notification').innerText(),/18/);assert.match(await student.locator('.notification').innerText(),/clave foránea/);checks.push('Nota y comentario llegan a Notificaciones del estudiante');
 await student.locator('[data-action="seen"]').click();await student.waitForFunction(()=>document.querySelector('#notify-count').hidden);assert.equal(works[0].seen,true);checks.push('Marcar notificación leída persiste en el servidor simulado');
 // An edit made while the teacher holds an older form must not be overwritten.
 await admin.locator('#admin-status').selectOption('graded');await admin.locator('[data-action="grade"]').first().click();
 await student.locator('.nav a[data-route="trabajos"]').click();await student.locator('[data-action="edit"]').first().click();await student.locator('#upload-description').fill('Versión corregida por el estudiante');await student.locator('#upload-form button[type="submit"]').click();await student.waitForFunction(()=>!document.querySelector('#dialog').open);assert.equal(works[0].grade,null);assert.equal(works[0].history.length,1);
 await admin.locator('#grade-form button[type="submit"]').click();await admin.waitForFunction(()=>document.querySelector('.form-error')?.textContent.includes('cambió en otro dispositivo'));assert.equal(works[0].grade,null);checks.push('Conflicto de versiones conserva la edición del estudiante y rechaza nota desactualizada');
 await admin.locator('[data-action="close"]').first().click();await admin.evaluate(()=>window.portfolioCloud.refresh());await admin.locator('#admin-status').selectOption('pending');await admin.locator('[data-action="grade"]').first().click();await admin.locator('#grade-value').fill('19');await admin.locator('#grade-comment').fill('Corrección completa. <img src=x onerror=alert(1)>');await admin.locator('#grade-form button[type="submit"]').click();await admin.waitForFunction(()=>!document.querySelector('#dialog').open);await admin.locator('#admin-status').selectOption('graded');assert.equal(await admin.locator('.review-feedback img').count(),0);checks.push('Comentarios se presentan como texto sin ejecutar HTML');
 await admin.setViewportSize({width:390,height:844});await admin.screenshot({path:'tests/admin-mobile.png',fullPage:true,animations:'disabled'});assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push('Panel administrador sin desbordamiento horizontal en móvil');
 await admin.locator('.admin-sidebar [data-action="logout"]').click();await admin.waitForFunction(()=>location.hash==='#inicio'&&!document.body.classList.contains('admin-view'));assert.equal(await admin.evaluate(()=>window.portfolioCloud.getState().role),'');await admin.evaluate(()=>location.hash='#administrador');await admin.waitForSelector('.admin-gate');checks.push('Cerrar sesión limpia el acceso y regresa al portafolio; la ruta admin queda protegida');
 networkDown=true;await student.locator('[data-action="refresh"]').first().click();await student.waitForFunction(()=>window.portfolioCloud.getState().phase==='error');assert.equal(works.length,1);networkDown=false;checks.push('Fallo de red informa error sin borrar entregas');
 assert.deepEqual(errors,[]);checks.push('Sin errores JavaScript durante los flujos');
 fs.writeFileSync('tests/resultado.json',JSON.stringify({date:new Date().toISOString(),environment:'Chromium con Supabase simulado; no escribe en cuentas reales',checks,passed:checks.length},null,2));console.log(JSON.stringify({passed:checks.length,checks},null,2));
}finally{await browser.close();server.close();}
