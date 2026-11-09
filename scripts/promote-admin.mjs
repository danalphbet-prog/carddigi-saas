// Executar somente no seu ambiente seguro com GOOGLE_APPLICATION_CREDENTIALS,
// NUNCA no navegador / React e NUNCA colocando a chave no GitHub.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.argv[2];
if (!email || !email.includes('@')) {
  console.error('Uso: GOOGLE_APPLICATION_CREDENTIALS=/caminho/privado/key.json node scripts/promote-admin.mjs seu@email.com');
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Defina GOOGLE_APPLICATION_CREDENTIALS apontando para chave privada do seu Firebase.');
  process.exit(1);
}
initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const u = await auth.getUserByEmail(email);
const current = u.customClaims || {};
await auth.setCustomUserClaims(u.uid, { ...current, platformAdmin: true });
console.log('Acesso do gestor habilitado para:', email);
console.log('Saia e entre novamente na plataforma para atualizar a sessão.');
