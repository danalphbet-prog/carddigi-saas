import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TEMPLATE_FAMILIES,TEMPLATE_SLOTS,INSTALLED_TEMPLATES,resolveTemplates,templateSlot} from '../src/template-system.js';
import {FONT_GROUPS,fontGroupById} from '../src/menu-design.js';

const rules=JSON.parse(fs.readFileSync(new URL('../database.rules.json',import.meta.url),'utf8'));

test('catálogo V11 reserva exatamente 60 templates sem fingir que estão instalados',()=>{
 assert.equal(TEMPLATE_SLOTS.length,60);
 assert.equal(new Set(TEMPLATE_SLOTS.map(x=>x.id)).size,60);
 assert.deepEqual(TEMPLATE_FAMILIES.map(x=>x.capacity),[20,20,20]);
 assert.ok(TEMPLATE_SLOTS.every(x=>x.status==='aguardando-layout'));
 assert.equal(INSTALLED_TEMPLATES.length,2);
 assert.equal(templateSlot('list',20)?.id,'list-20');
});
test('templates antigos são recuperados sem quebrar restaurantes legados',()=>{
 assert.deepEqual(resolveTemplates({}),{menu:'grid-classico',detail:'detail-classico',categoriesSeparated:false});
 assert.deepEqual(resolveTemplates({menuTemplateId:'list-14',productDetailTemplateId:'detail-19',menuCategoryGroups:true}),{menu:'grid-classico',detail:'detail-classico',categoriesSeparated:true});
});
test('cinco grupos de tipografia têm títulos, textos e ênfase independentes',()=>{
 assert.equal(FONT_GROUPS.length,5);
 assert.equal(new Set(FONT_GROUPS.map(x=>x.id)).size,5);
 assert.ok(FONT_GROUPS.every(x=>x.body&&x.heading&&x.accent));
 assert.equal(fontGroupById('luxuoso')?.descriptionItalic,true);
 assert.equal(fontGroupById('não-existe'),null);
});
test('regras de restaurante reconhecem tipografia e separação por categoria',()=>{
 const r=rules.rules.restaurants.$rid;
 for(const field of ['menuFontGroup','menuCategoryGroups','menuTemplateId','productDetailTemplateId'])assert.ok(r[field]?.['.validate']);
});
test('prévia limita a renderização e reutiliza o canvas durante alterações de estado',()=>{
 const s=fs.readFileSync(new URL('../src/ar-viewer.jsx',import.meta.url),'utf8');
 assert.match(s,/lastFrame<32/);
 assert.match(s,/IntersectionObserver/);
 assert.match(s,/errorRef\.current/);
 assert.match(s,/const MIN_HITS = 2/);
});
