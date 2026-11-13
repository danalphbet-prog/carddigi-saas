// Eventos anônimos agregáveis. Nenhuma identidade, IP ou conteúdo do pedido é enviado.
import {apiRequest} from './api-client.js';
const allowed=new Set(['view','exit','ar_open','error','product_view','add_to_cart','checkout_started']);
const text=(s,max=180)=>String(s||'').replace(/[\r\n\t]/g,' ').slice(0,max);
export async function trackEvent(restaurantId,type,details='') {
  if(!restaurantId || !allowed.has(type))return;
  try {await apiRequest('events',{restaurantId,type,message:text(details,180)});}
  catch{/* telemetria jamais impede compra ou navegação */}
}
export function trackVisit(restaurantId) {
  try {
    const key=`mezeira-view-${restaurantId}`,ts=Date.now();
    const last=Number(sessionStorage.getItem(key))||0;
    if (ts-last < 30*60*1000) return;
    sessionStorage.setItem(key,String(ts));
  }catch{/* navegador sem sessionStorage: continua normalmente */}
  void trackEvent(restaurantId,'view');
}
export function installErrorReporting(restaurantId) {
  if(!restaurantId)return()=>{};
  let sent=0;
  const report=(kind,e)=>{
    if(sent++ >= 5)return;
    const message = text(e?.message || e?.reason?.message || kind,180);
    void trackEvent(restaurantId,'error',message);
  };
  const onError=e=>report('Erro de interface',e);
  const onRejection=e=>report('Falha de carregamento',e);
  window.addEventListener('error',onError);
  window.addEventListener('unhandledrejection',onRejection);
  return()=>{
    window.removeEventListener('error',onError);
    window.removeEventListener('unhandledrejection',onRejection);
  };
}
