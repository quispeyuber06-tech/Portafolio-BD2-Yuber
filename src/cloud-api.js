import {createClient} from '@supabase/supabase-js';

// El HTML solo contiene configuración pública. Contraseñas y sesiones no se exportan.
const nativeLocalFetch=window.fetch.bind(window);
const localGetAll=window.portfolioGetAll;
const localFile=window.portfolioFile;
const configElement=document.getElementById('portfolio-cloud-config');
const configKey='yuber-bd2-cloud-config-v1';
let config={enabled:false,url:'',publishableKey:''};
try{config={...config,...JSON.parse(configElement?.textContent||'{}')};}catch{}
let offlineCopy=false;try{offlineCopy=JSON.parse(document.getElementById('portfolio-snapshot')?.textContent||'{}').mode==='offline';}catch{}
try{const saved=localStorage.getItem(configKey);if(!config.enabled&&saved&&!offlineCopy)config={...config,...JSON.parse(saved)};}catch{}
if(offlineCopy)config.enabled=false;
let client=null,session=null,membership=null,cached=[],epoch=0,inflight=null,mutating=false,importSource=null;
let state={configured:false,phase:'local',email:'',role:'',lastSynced:'',message:'Trabajos guardados en este navegador.'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function emit(patch){state={...state,...patch};window.dispatchEvent(new CustomEvent('portfolio-cloud-state',{detail:{...state}}));}
function redraw(){window.dispatchEvent(new Event('portfolio-refresh'));}
function checkedConfig(raw){
  const url=String(raw.url||'').trim().replace(/\/+$/,'');
  const key=String(raw.publishableKey||'').trim();
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw Error('Usa la URL HTTPS de tu proyecto Supabase.');
  let publicKey=/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if(!publicKey&&key.split('.').length===3){try{const part=key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');publicKey=JSON.parse(atob(part)).role==='anon';}catch{}}
  if(!publicKey)throw Error('Usa la clave pública Publishable (o anon). Nunca la clave secret ni service_role.');
  return {enabled:true,url,publishableKey:key};
}
function currentConfig(){return config.enabled?{...config}:{enabled:false,url:'',publishableKey:''};}
function makeClient(){
  epoch++;session=null;membership=null;cached=[];inflight=null;
  if(client){client.auth.stopAutoRefresh();client.removeAllChannels();}
  client=null;
  if(!config.enabled){emit({configured:false,phase:'local',email:'',role:'',lastSynced:'',message:'Trabajos guardados en este navegador.'});return;}
  try{
    config=checkedConfig(config);
    const active=createClient(config.url,config.publishableKey,{auth:{persistSession:false,detectSessionInUrl:false,autoRefreshToken:true}});
    client=active;
    active.auth.onAuthStateChange((event,next)=>{
      if(client!==active)return;
      session=next;
      if(event==='SIGNED_OUT'){epoch++;cached=[];membership=null;emit({phase:'signed-out',email:'',role:'',lastSynced:'',message:'Inicia sesión para consultar tus trabajos en línea.'});redraw();}
    });
    emit({configured:true,phase:'signed-out',email:'',role:'',lastSynced:'',message:'Inicia sesión para consultar tus trabajos en línea.'});
  }catch(e){config.enabled=false;emit({configured:false,phase:'error',message:e.message});}
}
function requireSession(){if(!client||!session)throw Error('Inicia sesión en Mi cuenta para usar la base de datos.');}
function explain(error){
  if(error?.code==='40001')return 'Este trabajo cambió en otro dispositivo. Pulsa Actualizar y vuelve a abrirlo antes de guardar.';
  if(error?.code==='PGRST202'||error?.code==='42P01')return 'Falta instalar el esquema del portafolio en este proyecto.';
  if(error?.message?.includes('Invalid login credentials'))return 'El correo o la contraseña no son correctos.';
  if(error?.message?.includes('Email not confirmed'))return 'Confirma tu correo para iniciar sesión.';
  if(error?.code==='23505')return 'La entrega ya existe. Actualiza antes de volver a subirla.';
  if(error?.code==='23514'||error?.code==='22P02')return 'Revisa los datos del trabajo, la semana y el formato de la nota.';
  if(!navigator.onLine||/fetch|network|timeout/i.test(error?.message||''))return 'No se pudo confirmar la conexión. Comprueba internet y pulsa Actualizar antes de reintentar la entrega.';
  return error?.message||'No se pudo completar la operación.';
}
async function rpc(name,args){
  requireSession();const stamp=epoch,active=client;
  const {data,error}=await active.rpc(name,args);
  if(stamp!==epoch||active!==client)throw Error('La sesión cambió. Vuelve a abrir el trabajo.');
  if(error)throw Error(explain(error));
  return data;
}
async function fetchRemote(){
  requireSession();
  if(inflight)return inflight;
  const operation=(async()=>{
    try{
      if(!membership){membership=await rpc('bd2_session');if(membership.schemaVersion!==1)throw Error('La versión de la base de datos no coincide con este HTML.');}
      const data=await rpc('bd2_list');
      cached=data.works||[];
      emit({phase:mutating?'syncing':'ready',role:data.role,email:session?.user?.email||'',lastSynced:new Date().toISOString(),message:mutating?state.message:'Lista actualizada desde la base de datos.'});
      return {...data,cloud:true};
    }catch(e){emit({phase:navigator.onLine?'error':'offline',message:explain(e)});throw e;}
  })();inflight=operation;
  try{return await operation;}finally{if(inflight===operation)inflight=null;}
}
async function login(email,password){
  if(!client)throw Error('Primero conecta el proyecto de base de datos.');
  emit({phase:'checking',message:'Comprobando tu cuenta…'});
  epoch++;cached=[];membership=null;inflight=null;
  const {data,error}=await client.auth.signInWithPassword({email:email.trim(),password});
  if(error){emit({phase:'signed-out',message:explain(error)});throw Error(explain(error));}
  session=data.session;
  try{await fetchRemote();redraw();}catch(e){emit({email:session?.user?.email||''});redraw();throw e;}
}
async function logout(){
  const active=client;epoch++;session=null;membership=null;cached=[];inflight=null;
  emit({phase:'signed-out',email:'',role:'',lastSynced:'',message:'Sesión cerrada en este dispositivo.'});redraw();
  if(active)await active.auth.signOut({scope:'local'});
}
function validFile(file){if(!(file instanceof Blob)||file.size<1||file.size>20*1024*1024)throw Error('El archivo debe pesar entre 1 byte y 20 MB.');}
async function putFile(file,id,uploaded){
  validFile(file);requireSession();if(!membership)await fetchRemote();
  if(membership.role!=='student')throw Error('Solo la cuenta del estudiante puede subir trabajos.');
  const path=`${membership.portfolioId}/${session.user.id}/${id}/${crypto.randomUUID()}`;
  // Se registra antes de subir, para intentar limpiar incluso si la respuesta se pierde.
  uploaded.push(path);
  const {error}=await client.storage.from('bd2-works').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream',cacheControl:'0'});
  if(error)throw Error(explain(error));
  return {object_path:path,size:file.size,type:file.type||'application/octet-stream'};
}
async function removeUnused(paths){
  if(!paths?.length||!session)return false;
  // La política del servidor impide borrar un objeto todavía referenciado por una entrega.
  const {error}=await client.storage.from('bd2-works').remove([...new Set(paths)]);
  return !error;
}
async function mutation(body){
  requireSession();if(mutating)throw Error('Espera a que termine el guardado en curso.');
  mutating=true;let uploaded=[];
  emit({phase:'syncing',message:'Guardando en la base de datos…'});
  try{
    if(!membership)await fetchRemote();
    let action,data;
    if(body instanceof FormData){
      action=body.get('action')==='replace'?'replace':'create';
      const id=String(body.get('id')||crypto.randomUUID());
      if(action==='create'){await fetchRemote();if(cached.some(w=>w.id===id)){emit({phase:'ready',message:'La entrega ya estaba guardada en tu cuenta.'});redraw();return {ok:true,id,cloud:true,already:true};}}
      const file=body.get('file');
      data={id,name:String(body.get('name')||file?.name||'').trim(),description:String(body.get('description')||'')};
      if(action==='create')Object.assign(data,{unit:Number(body.get('unit')),week:Number(body.get('week')),day:body.get('day')});
      else data.revision=Number(body.get('revision'));
      if(!data.name||data.name.length>200||data.description.length>1000)throw Error('Revisa el título y la descripción.');
      if(file)Object.assign(data,await putFile(file,id,uploaded));
      else if(action==='create')throw Error('Selecciona un archivo.');
    }else{
      ({action,...data}=JSON.parse(body));
      if(['feature','cover','delete','restore','grade'].includes(action)){
        const row=cached.find(w=>w.id===data.id);
        if(!row)throw Error('Actualiza y vuelve a abrir el trabajo.');
        data.revision=data.revision??row.revision;
      }
    }
    const result=await rpc('bd2_save',{p_action:action,p_data:data});
    await fetchRemote();
    if(action==='delete'?cached.some(w=>w.id===data.id):(action!=='seen'&&!cached.some(w=>w.id===(result.id||data.id))))throw Error('El servidor no confirmó la entrega. Actualiza antes de reintentar.');
    let cleanup=true;
    if(result.paths)cleanup=await removeUnused(result.paths);
    emit({phase:'ready',message:cleanup?'Cambios confirmados en la base de datos.':'Entrega eliminada de la lista. Algunos archivos necesitan limpieza del almacenamiento.'});
    redraw();
    return {ok:true,cloud:true,...result,...(!cleanup?{warning:'La entrega se eliminó de la base de datos. Quedaron archivos sin referencias pendientes de limpieza en Storage.'}:{})};
  }catch(e){
    if(uploaded.length)try{await removeUnused(uploaded);}catch{}
    emit({phase:navigator.onLine?'error':'offline',message:explain(e)});throw e;
  }finally{mutating=false;}
}
async function downloadRow(row){
  requireSession();const stamp=epoch;
  if(!row)throw Error('Archivo o versión no encontrado. Actualiza la lista.');
  const {data,error}=await client.storage.from('bd2-works').download(row.object_path);
  if(stamp!==epoch)throw Error('La sesión cambió. Vuelve a iniciar sesión.');
  if(error)throw Error(explain(error));
  return {...row,file:new Blob([data],{type:row.type||data.type})};
}
async function remoteFile(id,version){
  const {works}=await fetchRemote();const work=works.find(w=>w.id===id);
  return downloadRow(version===undefined?work:work?.history?.[version]);
}
async function importLocal(){
  requireSession();if(mutating)throw Error('Espera a que termine la operación actual.');
  const localRows=importSource||await localGetAll();await fetchRemote();
  if(membership.role!=='student')throw Error('Ingresa con la cuenta del estudiante para importar.');
  mutating=true;let copied=0,skipped=0;
  try{
    const origins=new Set(cached.map(w=>w.origin_id).filter(Boolean));
    for(let index=0;index<localRows.length;index++){
      const row=localRows[index];const origin=String(row.id);
      if(origins.has(origin)){skipped++;continue;}
      const id=crypto.randomUUID(),uploaded=[];
      emit({phase:'syncing',message:`Copiando entrega ${index+1} de ${localRows.length}: ${row.name}`});
      try{
        if((row.history||[]).length>100)throw Error('Una entrega tiene más de 100 versiones. Conserva su copia local.');
        const history=[];
        for(const h of row.history||[]){history.push({name:h.name,description:h.description||'',created:h.created,updated:h.updated||h.created,...await putFile(h.file,id,uploaded)});}
        const data={id,origin_id:origin,unit:row.unit,week:row.week,day:row.day,name:row.name,description:row.description||'',
          created:row.created,featured:!!row.featured,cover:row.cover||null,history,...await putFile(row.file,id,uploaded)};
        const result=await rpc('bd2_save',{p_action:'import',p_data:data});
        if(result.already){skipped++;await removeUnused(uploaded);}else copied++;
        origins.add(origin);
      }catch(e){try{await removeUnused(uploaded);}catch{}throw Error(`${copied} entregas copiadas. La importación se detuvo en «${row.name}»: ${explain(e)}. Puedes reintentarlo; las ya importadas se omiten.`);}
    }
    await fetchRemote();
    emit({phase:'ready',message:`Importación terminada: ${copied} nuevas; ${skipped} ya estaban en línea. Las notas locales requieren evaluación del docente.`});
    redraw();return {copied,skipped};
  }catch(e){emit({phase:'error',message:explain(e)});throw e;}
  finally{mutating=false;}
}

makeClient();
async function selectImportFile(file){
  if(mutating)throw Error('Espera a que termine la importación.');
  if(!file||file.size>220*1024*1024)throw Error('Selecciona una copia HTML de hasta 220 MB.');
  const html=await file.text();
  const match=html.match(/<script\b(?=[^>]*\bid=["']portfolio-snapshot["'])[^>]*>([\s\S]*?)<\/script\s*>/i);
  if(!match)throw Error('Esta copia no incluye los trabajos. En el HTML anterior, pulsa Guardar copia con mis trabajos.');
  const snapshot=JSON.parse(match[1]);
  if(!Array.isArray(snapshot.works)||snapshot.works.length>1000)throw Error('La copia no tiene una lista de trabajos válida.');
  let total=0;
  function decode(w,allowHistory=true){
    if(typeof w.bytes!=='string'||w.bytes.length>28000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(w.bytes)||typeof w.name!=='string'||!w.name.trim()||w.name.length>200)throw Error('Un archivo de la copia está incompleto o no es válido.');
    const bytes=Uint8Array.from(atob(w.bytes),c=>c.charCodeAt(0));total+=bytes.length;
    if(total>150*1024*1024||!bytes.length||bytes.length>20*1024*1024)throw Error('La copia supera los límites de importación: 20 MB por archivo y 150 MB en total.');
    if(!Array.isArray(w.history||[])||(w.history||[]).length>100)throw Error('El historial de una entrega no es válido.');
    return {...w,bytes:undefined,file:new Blob([bytes],{type:w.type||'application/octet-stream'}),history:allowHistory?(w.history||[]).map(h=>decode(h,false)):[]};
  }
  const rows=snapshot.works.map(w=>{
    if(!Number.isInteger(w.unit)||w.unit<1||w.unit>4||!Number.isInteger(w.week)||w.week<1||w.week>4||!['Miércoles','Jueves'].includes(w.day)||typeof w.id!=='string')throw Error('Revisa las unidades y semanas de la copia.');
    return decode(w);
  });
  importSource=rows;return rows.length;
}
window.portfolioCloud={
  getState:()=>({...state}),getConfig:currentConfig,getSnapshot:()=>({works:cached,role:state.role,admin:state.role==='admin',cloud:true,needsLogin:!session}),
  configure:async raw=>{if(mutating)throw Error('Espera a que termine el guardado.');const next=checkedConfig(raw);if(client&&session)await logout();config=next;try{localStorage.setItem(configKey,JSON.stringify(config));}catch{}makeClient();redraw();},
  useLocal:async()=>{if(mutating)throw Error('Espera a que termine el guardado.');if(session)await logout();config={enabled:false,url:'',publishableKey:''};try{localStorage.setItem(configKey,JSON.stringify(config));}catch{}makeClient();redraw();},
  login,logout,selectLocal:async()=>{importSource=null;return (await localGetAll()).length;},refresh:async()=>{await fetchRemote();redraw();},importLocal,selectImportFile,
  localCount:async()=>(await localGetAll()).length
};
window.portfolioGetAll=async()=>{
  if(!config.enabled)return localGetAll();
  const {works}=await fetchRemote(),rows=[];
  const size=works.reduce((s,w)=>s+w.size+(w.history||[]).reduce((n,h)=>n+h.size,0),0);
  if(size>150*1024*1024)throw Error('La copia sin conexión supera 150 MB. Usa el HTML conectado para consultar tus trabajos en línea.');
  for(const w of works){const current=await downloadRow(w);const history=[];for(const h of w.history||[])history.push(await downloadRow(h));rows.push({...current,history});}
  return rows;
};
window.portfolioFile=(id,version)=>config.enabled?remoteFile(id,version):localFile(id,version);
window.fetch=async function(input,opts={}){
  if(input!=='/api/portfolio'||!config.enabled)return nativeLocalFetch(input,opts);
  try{
    if(!opts.method||opts.method==='GET'){
      if(!session)return reply({works:[],admin:false,cloud:true,needsLogin:true});
      return reply(await fetchRemote());
    }
    if(!(opts.body instanceof FormData)){
      const data=JSON.parse(opts.body);
      if(data.action==='login'){await login(data.user,data.password);return reply({ok:true,admin:membership?.role==='admin',cloud:true});}
      if(data.action==='logout'){await logout();return reply({ok:true,cloud:true});}
    }
    return reply(await mutation(opts.body));
  }catch(e){return reply({error:explain(e),cloud:true},session?503:401);}
};
window.addEventListener('online',()=>{if(config.enabled&&session){fetchRemote().then(redraw).catch(()=>{});}});
window.addEventListener('offline',()=>{if(config.enabled)emit({phase:'offline',message:'Sin internet. La lista visible puede estar desactualizada. Las entregas nuevas no se han guardado en línea.'});});
document.addEventListener('visibilitychange',()=>{
  if(!client)return;
  if(document.hidden)client.auth.stopAutoRefresh();
  else{client.auth.startAutoRefresh();if(session)fetchRemote().then(redraw).catch(()=>{});}
});
