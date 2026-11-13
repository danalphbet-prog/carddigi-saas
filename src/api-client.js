// V13.1: timeout, cancelamento e mensagens de falha sem bloqueio infinito.
import {getToken as getAppCheckToken} from 'firebase/app-check';
import {withRequestTimeout} from './request-timeout.js';
let getAuthUser=()=>null;
let appCheck=null;
export const configureApi=({user,check})=>{getAuthUser=user;appCheck=check;};
const base=String(import.meta.env.VITE_API_BASE_URL||'').trim().replace(/\/$/,'');
export const apiConfigured=Boolean(base);
const timeoutFor=path=>path==='orders'?90000:path==='health'?12000:35000;
export async function apiRequest(path,value,{authenticated=false,method='POST',signal}={}){
  if(!base)throw Error('API Mezzira ainda não configurada. Configure VITE_API_BASE_URL no Static Site.');
  const route=path.replace(/^\//,'');
  const url=`${base}/api/v1/${route}`;
  return withRequestTimeout(async requestSignal=>{
    const headers={};
    if(method!=='GET')headers['Content-Type']='application/json';
    if(authenticated){
      const user=getAuthUser();
      if(!user)throw Error('Sessão expirada. Entre novamente.');
      headers.Authorization=`Bearer ${await user.getIdToken()}`;
    }
    if(appCheck){
      try{headers['X-Firebase-AppCheck']=(await getAppCheckToken(appCheck)).token;}
      catch{/* A API avisa se o token for obrigatório. */}
    }
    // Se um token demorou demais, não envie um POST atrasado.
    if(requestSignal.aborted)throw Object.assign(new Error('Solicitação interrompida.'),{code:'api/cancelled'});
    let response;
    try{
      response=await fetch(url,{method,headers,signal:requestSignal,body:method==='GET'?undefined:JSON.stringify(value)});
    }catch(e){
      if(requestSignal.aborted)throw e;
      throw Object.assign(new Error('Não foi possível conectar à API Mezzira. Verifique sua internet e tente novamente.'),{code:'api/network'});
    }
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const err=new Error(data.error||'Não foi possível completar a operação.');
      err.code='api/'+(data.code||'request_failed');
      err.status=response.status;
      err.requestId=data.requestId||response.headers.get('X-Request-ID')||'';
      throw err;
    }
    return data;
  },{timeoutMs:timeoutFor(route),signal});
}
export const apiMutate=(operation,path,value)=>apiRequest('mutate',{operation,path,value},{authenticated:true});
export const apiAdmin=(path,payload)=>apiRequest(`admin/${path}`,payload,{authenticated:true});
export function wakeApi(){if(!base)return;void apiRequest('health',undefined,{method:'GET'}).catch(()=>{});}
