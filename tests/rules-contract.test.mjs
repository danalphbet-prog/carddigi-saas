import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const rules=JSON.parse(readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')).rules;
test('V13: caminhos privados não autorizam escritas diretas do navegador',()=>{
 for(const name of ['restaurants','modelRequests','publicationRequests','slugIndex','analytics','orders','integrations','commerce','modelCatalog']){
   assert.equal(rules[name]['.write']??false,false,name);
 }
 assert.equal(rules.restaurants['$rid']['.write'],false);
 assert.equal(rules.analytics['$rid']['.write'],false);
 assert.equal(rules.orders['$rid']['.write'],false);
});
test('V13: cardápio público é projeção independente e depende de published',()=>{
 assert.match(rules.publicMenus['$rid']['.read'],/published/);
 assert.equal(rules.publicMenus['$rid']['.write'],false);
 assert.doesNotMatch(rules.restaurants['$rid']['.read'],/published/);
});
test('V13: proprietário mantém leitura apenas das próprias lojas e pedidos',()=>{
 assert.match(rules.restaurants['.read'],/ownerUid/);
 assert.match(rules.orders['$rid']['.read'],/ownerUid/);
});
