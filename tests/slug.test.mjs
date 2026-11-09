import {test} from 'node:test';
import assert from 'node:assert/strict';
import {slugBase,makePublicSlug,publicMenuPath,isPublicSlug} from '../src/slug.js';
test('slug legível ignora acentuação e pontuação',()=>{
  assert.equal(slugBase('Pizzaria São João!'),'pizzaria-sao-joao');
  assert.equal(slugBase('🍕 !!!!'), 'estabelecimento');
});
test('slug público combina nome e quatro caracteres, sem o ID do Firebase',()=>{
  const slug=makePublicSlug('Pizzaria Paulista');
  assert.match(slug,/^pizzaria-paulista-[A-Z2-9]{4}$/);
  assert.ok(isPublicSlug(slug));
  assert.equal(publicMenuPath({slug}),'/menu/'+slug);
  assert.equal(publicMenuPath({id:'-NkX-foo'}),null);
});
