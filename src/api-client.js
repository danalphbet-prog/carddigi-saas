// V13: todas as mutações comerciais passam pela API. Nenhuma escrita usa o SDK Web do RTDB.
import {getToken as getAppCheckToken} from 'firebase/app-check';
let getAuthUser=()=>null;
let appCheck=null;
export const configureApi=({user,check})=>{getAuthUser=user;appCheck=check;};
const base=String(import.meta.env.VITE_API_BASE_URL||'').trim().replace(/\/$/,'');
export const apiConfigured=Boolean(base);
export async function apiRequest(path,value,{authenticated=false,method='POST',signal}={}){
  if(!base)throw Error('API Mezzira ainda não configurada. Configure VITE_API_BASE_URL no Static Site.');
  const url=`${base}/api/v1/${path.replace(/^\//,'')}`;
  const headers={};
  if(method!=='GET')headers['Content-Type']='application/json';
  if(authenticated){
    const user=getAuthUser();
    if(!user)throw Error('Sessão expirada. Entre novamente.');
    headers.Authorization=`Bearer ${await user.getIdToken()}`;
  }
  if(appCheck){
    try{headers['X-Firebase-AppCheck']=(await getAppCheckToken(appCheck)).token;}
    catch{/* quando enforcement estiver ativo, a API informará falha */}
  }
  let response;
  try{response=await fetch(url,{method,headers,signal,body:method==='GET'?undefined:JSON.stringify(value)});}
  catch{throw Error('Não foi possível conectar à API Mezzira. Tente novamente.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const err=new Error(data.error||'Não foi possível completar a operação.');err.code='api/'+(data.code||'request_failed');throw err;}
  return data;
}
export const apiMutate=(operation,path,value)=>apiRequest('mutate',{operation,path,value},{authenticated:true});
export const apiAdmin=(path,payload)=>apiRequest(`admin/${path}`,payload,{authenticated:true});
export function wakeApi(){if(!base)return;void apiRequest('health',undefined,{method:'GET'}).catch(()=>{});}
