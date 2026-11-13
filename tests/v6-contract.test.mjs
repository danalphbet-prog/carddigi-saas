import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
test('V6 autentica pelo Google ou e-mail e senha',()=>{
 const config=read('src/firebase.js');
 for(const x of ['loginGoogle','loginEmail','registerEmail','recoverPassword','browserLocalPersistence'])assert.ok(config.includes(x),x);
});
test('Savor usa dados recebidos do Realtime, sem importações de demonstrações',()=>{
 const p=read('src/platform.jsx');
 assert.ok(p.includes('<SavorMenu restaurant={r} products={mapped}'));
 assert.ok(p.includes('<StudioPanel'));
 assert.ok(!p.includes('loadCatalog('));
 assert.ok(!p.includes('const seed='));
});
test('V6 registra estoque e mantém aprovação pelo gestor',()=>{
 const rules=JSON.parse(read('database.rules.json'));
 assert.equal(rules.rules.restaurants.$rid['.write'],false);
 const validators=read('api/lib/validation.js');
 assert.match(validators,/stock/);
 assert.match(read('api/lib/service.js'),/stockMode/);
 const p=read('src/platform.jsx');
 assert.ok(p.includes('reviewPublication'));
 assert.ok(p.includes('publicationRequests'));
});
