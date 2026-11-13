import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, getRedirectResult, setPersistence, browserLocalPersistence, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getDatabase, ref, get, onValue, query as dbQuery, orderByChild, equalTo, serverTimestamp } from 'firebase/database';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {configureApi,apiMutate} from './api-client.js';

const config={apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID,databaseURL:import.meta.env.VITE_FIREBASE_DATABASE_URL,messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID};
export const configured=Boolean(config.apiKey && config.authDomain && config.projectId && config.appId && config.databaseURL);
const app=configured?initializeApp(config):null;
const appCheck=app && import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY),isTokenAutoRefreshEnabled:true}):null;
export const auth=app?getAuth(app):null;
configureApi({user:()=>auth?.currentUser,check:appCheck});
export const db=app?getDatabase(app):null;
const pathOf=(x)=>x.path;
const wrap=(path)=>({path,id:path.split('/').pop()});
const collection=(_db,...segments)=>wrap(segments.join('/'));
const doc=(_db,...segments)=>wrap(segments.join('/'));
const query=(reference,filter)=>({...reference,filter});
const where=(field,operator,value)=>{if(operator!=='==')throw Error('Filtro não suportado.');return {field,value};};
const snapshot=(key,value)=>({id:key,exists:()=>value!==null && value!==undefined,data:()=>value});
const onSnapshot=(source,onNext,onError)=>{
  if(!db)return ()=>{};
  const base=ref(db,pathOf(source));
  const target=source.filter?dbQuery(base,orderByChild(source.filter.field),equalTo(source.filter.value)):base;
  return onValue(target,s=>{
    const value=s.val();
    const docs=Object.entries(value||{}).map(([key,val])=>snapshot(key,val));
    onNext({id:source.id,exists:()=>s.exists(),data:()=>value,docs});
  },onError);
};
const addDoc=async(source,value)=>apiMutate('add',pathOf(source),value);
const setDoc=async(source,value,_opts)=>apiMutate('set',pathOf(source),value);
const updateDoc=async(source,value)=>apiMutate('update',pathOf(source),value);
const deleteDoc=async(source)=>apiMutate('delete',pathOf(source),null);
const getDoc=async(source)=>{const s=await get(ref(db,pathOf(source)));return snapshot(source.id,s.val());};
// A operação antiga arbitrária foi removida por segurança; use ações administrativas específicas.
export const atomicUpdate=()=>{throw Error('A operação genérica de escrita foi desativada na V13.');};
export const store={collection,doc,query,where,addDoc,setDoc,updateDoc,deleteDoc,getDoc,onSnapshot};
export {onAuthStateChanged,signOut,getRedirectResult};
export async function loginGoogle(){
  if(!auth)throw Object.assign(new Error('Serviço de acesso indisponível.'),{code:'auth/service-unavailable'});
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  // O clique abre o seletor diretamente, sem redirecionar para um domínio diferente.
  // Em hospedagens externas, redirecionamentos podem falhar por restrições de cookies.
  await setPersistence(auth, browserLocalPersistence); // sessão permanece após atualizar ou reabrir o navegador
  return signInWithPopup(auth, provider);
}
// Fotos são convertidas localmente em WebP Base64 e gravadas como JSON
// no nó do estabelecimento/produto quando o formulário é salvo.
// O Realtime Database não armazena arquivos binários: armazena strings data:image/webp;base64,...
import { preparePhoto } from './media.js';
export async function uploadMedia(restaurantId, file, kind='photos') {
  if (kind !== 'photos') throw Error('Esta opção aceita apenas fotografias.');
  if (!auth?.currentUser) throw Error('Entre com sua conta Google para cadastrar fotografias.');
  if (!restaurantId) throw Error('Estabelecimento inválido.');
  return preparePhoto(file);
}
export const now=()=>serverTimestamp();
export const restaurantDoc=rid=>doc(db,'restaurants',rid);
export const productCollection=rid=>collection(db,'restaurants',rid,'products');
export const productDoc=(rid,pid)=>doc(db,'restaurants',rid,'products',pid);
export const requestCollection=()=>collection(db,'modelRequests');

export async function loginEmail(email,password) {
  if (!auth) throw Error('Serviço de acesso indisponível.');
  await setPersistence(auth,browserLocalPersistence);
  return signInWithEmailAndPassword(auth,email.trim(),password);
}
export async function registerEmail(email,password) {
  if (!auth) throw Error('Serviço de acesso indisponível.');
  await setPersistence(auth,browserLocalPersistence);
  return createUserWithEmailAndPassword(auth,email.trim(),password);
}
export async function recoverPassword(email) {
  if (!auth) throw Error('Serviço de acesso indisponível.');
  return sendPasswordResetEmail(auth,email.trim());
}
