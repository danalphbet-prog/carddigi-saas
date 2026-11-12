import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const platform=fs.readFileSync(new URL('../src/platform.jsx',import.meta.url),'utf8');
test('preloader aparece no HTML antes do bundle React',()=>{
  assert.ok(html.indexOf('id="mezzira-preload"')<html.indexOf('id="root"'));
  assert.match(html,/MEZZIRA<\/strong>/);
  assert.match(html,/CARDÁPIO<\/p>/);
});
test('preloader aguarda sinal de app pronto e tem recuperação para demora',()=>{
  assert.match(html,/mezzira:ready/);
  assert.match(html,/Tentar novamente/);
  assert.match(html,/prefers-reduced-motion/);
});
test('menu público aguarda primeira leitura real do banco antes de abrir',()=>{
  assert.match(platform,/!productsLoaded \|\| !modelsLoaded/);
  assert.match(platform,/image\.src=r\.cover/);
  assert.match(platform,/resolved\.loading/);
  assert.match(platform,/window\.dispatchEvent\(new Event\('mezzira:ready'\)\)/);
});
