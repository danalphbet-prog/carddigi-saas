// Executar uma única vez antes de ativar as regras fechadas da V13.
// Requer credenciais administrativas no ambiente, nunca no repositório.
import {getApps,initializeApp,cert,applicationDefault} from 'firebase-admin/app';
import {getDatabase} from 'firebase-admin/database';
import {createService} from '../lib/service.js';
if(!process.env.FIREBASE_DATABASE_URL)throw Error('FIREBASE_DATABASE_URL ausente.');
const credentials=process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) : applicationDefault();
const app=getApps()[0]||initializeApp({credential:credentials,databaseURL:process.env.FIREBASE_DATABASE_URL});
const service=createService(getDatabase(app));
const response=await service.rebuildAllPublic({uid:'system-migration',platformAdmin:true});
console.log(`V13: ${response.count} cardápios gerados. Confira os dados antes de fechar as regras.`);
process.exit(0);
