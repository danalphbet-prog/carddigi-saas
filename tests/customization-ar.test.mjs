import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MENU_PALETTES,MENU_FONTS,paletteById,fontById,clampCover,getPromotions,checkoutIntro} from '../src/menu-design.js';
const read = n => readFileSync(new URL(`../${n}`,import.meta.url),'utf8');

test('paleta fechada com cinco combinações e fallback',()=>{
 assert.equal(MENU_PALETTES.length,5);
 assert.equal(new Set(MENU_PALETTES.map(p=>p.id)).size,5);
 assert.equal(paletteById('inexistente').id,'oliva');
 for(const p of MENU_PALETTES){for(const field of ['accent','cream','cream2','ink','muted'])assert.match(p[field],/^#[0-9a-f]{6}$/i)}
});
test('fontes são nomes em lista permitida, sem CSS arbitrário',()=>{
 assert.ok(MENU_FONTS.length>=5);
 assert.equal(fontById('url(malicioso)').id,'dm-sans');
});
test('promos são reais, opt-in e limitadas a cinco',()=>{
 const promos=Array.from({length:8},(_,i)=>({title:'Aviso '+i,detail:'Informação '+i}));
 assert.deepEqual(getPromotions({promotions:promos}),[]);
 assert.equal(getPromotions({promotions:promos,promotionsEnabled:true}).length,5);
 assert.deepEqual(getPromotions({promotionsEnabled:true,promotions:[]}),[]);
});
test('posição da capa é normalizada e mensagem de WhatsApp tem limite',()=>{
 assert.equal(clampCover(-9),0);
 assert.equal(clampCover(200),100);
 assert.equal(clampCover(undefined),50);
 assert.equal(checkoutIntro('texto '.repeat(200)).length,400);
});
test('rotas de integração ficam privadas e webhook não é enviado pelo frontend',()=>{
 const rules=JSON.parse(read('database.rules.json')).rules;
 assert.match(rules.integrations.$rid['.read'],/auth != null/);
 assert.match(rules.integrations.$rid['.read'],/ownerUid/);
 const integration=read('src/IntegrationsEditor.jsx');
 assert.doesNotMatch(integration, /fetch\s*\(/);
 assert.match(integration,/webhookReady:false/);
});
test('AR utiliza detecção horizontal com limiar mais acessível e XRRay opcional',()=>{
 const src=read('src/ar-viewer.jsx');
 assert.match(src,/MIN_HITS\s*=\s*2/);
 assert.match(src,/MIN_UP_DOT\s*=\s*0\.82/);
 assert.match(src,/lowerHitTestSource/);
 assert.match(src,/createAnchor/);
 assert.doesNotMatch(src,/stableFrames\s*<\s*6/);
});
