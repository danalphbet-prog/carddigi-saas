import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const rules=JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url),'utf8')).rules;
test('regras V5 possuem filas de publicação, catálogo, eventos e pedidos',()=>{
  assert.ok(rules.publicationRequests);
  assert.ok(rules.slugIndex);
  assert.ok(rules.analytics);
  assert.ok(rules.orders);
});
test('publicação e endereço não ficam livres para o dono da loja',()=>{
  const write=rules.restaurants['$rid']['.write'];
  assert.match(write,/platformAdmin/);
  assert.match(write,/published/);
  assert.match(write,/publicationStatus/);
  assert.match(write,/slug/);
  assert.match(rules.slugIndex['$slug']['.write'],/platformAdmin/);
});
test('pré-pedido público só pode nascer como intenção e permite leitura ao proprietário',()=>{
  const order=rules.orders['$rid'];
  assert.match(order['$orderId']['.write'],/!data.exists\(\)/);
  assert.match(order['$orderId']['.write'],/initiated/);
  assert.match(order['.read'],/ownerUid/);
});
