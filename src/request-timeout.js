// Limite para a operação inteira (tokens, fetch e resposta), sem carregamento infinito.
export function timeoutError(){
  const error=new Error('A API demorou mais que o esperado para responder. Tente novamente.');
  error.code='api/timeout';
  return error;
}
export function cancelledError(){
  const error=new Error('Solicitação cancelada.');
  error.code='api/cancelled';
  return error;
}
export async function withRequestTimeout(run,{timeoutMs=35000,signal}={}){
  const controller=new AbortController();
  let timer,abortExternal;
  const timeoutPromise=new Promise((_,reject)=>{
    timer=setTimeout(()=>{controller.abort();reject(timeoutError());},timeoutMs);
  });
  const externalPromise=signal?new Promise((_,reject)=>{
    abortExternal=()=>{controller.abort();reject(cancelledError());};
    if(signal.aborted)abortExternal();
    else signal.addEventListener('abort',abortExternal,{once:true});
  }):new Promise(()=>{});
  try{
    return await Promise.race([
      timeoutPromise,
      externalPromise,
      Promise.resolve().then(()=>{
        if(controller.signal.aborted)throw cancelledError();
        return run(controller.signal);
      })
    ]);
  }finally{
    clearTimeout(timer);
    if(signal&&abortExternal)signal.removeEventListener('abort',abortExternal);
  }
}
