import http from 'node:http';
import {getApps,initializeApp,cert,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getAppCheck} from 'firebase-admin/app-check';
import {getDatabase} from 'firebase-admin/database';
import {ApiError,fail} from './lib/validation.js';
import {createService} from './lib/service.js';

const PORT=Number(process.env.PORT||3001);
const DATABASE_URL=process.env.FIREBASE_DATABASE_URL;
if(!DATABASE_URL)throw Error('FIREBASE_DATABASE_URL precisa ser configurada no serviço da API.');
let credential;
if(process.env.FIREBASE_SERVICE_ACCOUNT_JSON){
  try{credential=cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));}
  catch{throw Error('FIREBASE_SERVICE_ACCOUNT_JSON não contém um JSON de conta de serviço válido.');}
}else credential=applicationDefault();
const app=getApps()[0]||initializeApp({credential,databaseURL:DATABASE_URL});
const auth=getAuth(app),database=getDatabase(app),appCheck=getAppCheck(app),svc=createService(database);
const allowedOrigins=new Set((process.env.ALLOWED_ORIGINS||'http://localhost:5173').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean));
const enforceAppCheck=process.env.ENFORCE_APP_CHECK==='true';
const limiter=new Map();
const allowedMethods='GET, POST, OPTIONS';
const allowedHeaders='Content-Type, Authorization, X-Firebase-AppCheck';

function headers(req,res){
  const origin=req.headers.origin;
  if(origin){
    if(!allowedOrigins.has(origin))fail(403,'Origem não autorizada.');
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods',allowedMethods);
    res.setHeader('Access-Control-Allow-Headers',allowedHeaders);
    res.setHeader('Access-Control-Max-Age','600');
  }
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
}
function limit(req,route){
  // Baseline limiter per instance. Deploy a shared edge limiter for multiple replicas.
  const ip=req.socket.remoteAddress||'unknown';
  const now=Date.now(),id=route+':'+ip,prev=limiter.get(id);
  const ttl=60_000,maximum=route==='events'?1200:route==='orders'?120:400;
  if(!prev||now>=prev.until)limiter.set(id,{count:1,until:now+ttl});
  else if(++prev.count>maximum)fail(429,'Muitas solicitações. Tente novamente em instantes.','rate_limited');
  if(limiter.size>15000){for(const [k,v] of limiter)if(v.until<now)limiter.delete(k);}
}
async function body(req){
  if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Envie JSON.');
  let size=0,raw='';
  for await(const chunk of req){
    size+=chunk.length;
    if(size>1_850_000)fail(413,'Os dados enviados excedem o limite.');
    raw+=chunk.toString('utf8');
  }
  try{return JSON.parse(raw);}catch{fail(400,'JSON inválido.');}
}
async function identity(req){
  const bearer=String(req.headers.authorization||'');
  if(!/^Bearer [\w.-]+$/.test(bearer))fail(401,'Sessão necessária.','unauthenticated');
  let token;
  try{token=await auth.verifyIdToken(bearer.slice(7),true);}
  catch{fail(401,'Sessão inválida ou expirada. Entre novamente.','unauthenticated');}
  return {uid:token.uid,platformAdmin:token.platformAdmin===true};
}
async function verifyApp(req){
  if(!enforceAppCheck)return;
  const token=req.headers['x-firebase-appcheck'];
  if(typeof token!=='string'||!token)fail(401,'App Check obrigatório.','app_check_required');
  try{await appCheck.verifyToken(token);}catch{fail(401,'App Check inválido.','app_check_invalid');}
}
function send(res,status,value){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(value));
}
const server=http.createServer(async(req,res)=>{
  try{
    headers(req,res);
    const path=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`).pathname;
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(req.method==='GET'&&path==='/api/v1/health')return send(res,200,{ok:true,service:'mezzira-api',version:13});
    if(req.method!=='POST')fail(404,'Rota inexistente.','not_found');
    const type=path==='/api/v1/events'?'events':path==='/api/v1/orders'?'orders':'admin';
    limit(req,type);
    await verifyApp(req);
    const data=await body(req);
    if(path==='/api/v1/events')return send(res,202,await svc.recordEvent(data));
    if(path==='/api/v1/orders')return send(res,201,await svc.createOrder(data));
    const user=await identity(req);
    if(path==='/api/v1/mutate'){
      const result=await svc.mutate(user,data.operation,data.path,data.value);
      await svc.audit(user,data.operation,data.path).catch(e=>console.warn('[Mezzira] Auditoria:',e?.message));
      return send(res,200,result);
    }
    if(!user.platformAdmin)fail(403,'Permissão administrativa necessária.','forbidden');
    const adminRoutes={
      '/api/v1/admin/publications':()=>svc.approve(user,data.requestId,data.decision),
      '/api/v1/admin/slug':()=>svc.assignSlug(user,data.restaurantId),
      '/api/v1/admin/toggle-publication':()=>svc.pause(user,data.restaurantId),
      '/api/v1/admin/rebuild-public-menus':()=>svc.rebuildAllPublic(user)
    };
    if(adminRoutes[path]){
      const result=await adminRoutes[path]();
      await svc.audit(user,path.replace('/api/v1/admin/','admin:'),data.restaurantId||data.requestId||'global').catch(e=>console.warn('[Mezzira] Auditoria:',e?.message));
      return send(res,200,result);
    }
    fail(404,'Rota inexistente.','not_found');
  }catch(e){
    const status=e instanceof ApiError?e.status:500;
    if(status===500)console.error('[Mezzira API]',e);
    if(!res.headersSent)send(res,status,{error:e instanceof ApiError?e.message:'Falha interna. Tente novamente.',code:e instanceof ApiError?e.code:'server_error'});
    else res.end();
  }
});
server.listen(PORT,'0.0.0.0',()=>console.log(`[Mezzira API v13] Porta ${PORT}`));
