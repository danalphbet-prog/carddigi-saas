import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MENU_PALETTES,paletteById} from '../src/menu-design.js';
const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
test('V12: cinco temas fechados incluem fundo, superfície, ícones, bordas e contrastes',()=>{
  assert.equal(MENU_PALETTES.length,5);
  assert.equal(new Set(MENU_PALETTES.map(t=>t.id)).size,5);
  for(const t of MENU_PALETTES)for(const prop of ['accent','cream','cream2','surface','border','accentSoft','heroBase','ink','muted','onAccent'])assert.match(t[prop],/^#[0-9a-fA-F]{6}$/);
  assert.equal(paletteById('oceano').accent,'#26536c');
});
test('V12: aparência, estabelecimento e contatos compartilham a aba Loja',()=>{
 const studio=read('StudioPanel.jsx');
 assert.match(studio,/\['shop',Store,'Loja'\]/);
 assert.match(studio,/tab==='shop'/);
 assert.match(studio,/renderSettings\('all'\)/);
 assert.match(studio,/<ThemeEditor r=\{r\}/);
 assert.doesNotMatch(studio,/\['themes',Palette,'Aparência'\]/);
 assert.doesNotMatch(studio,/\['contacts',ContactRound,'Contatos'\]/);
});
test('V12: estoque ilimitado remove o saldo anterior do Realtime',()=>{
 const platform=read('platform.jsx');const studio=read('StudioPanel.jsx');
 assert.match(platform,/stock:stockMode==='unlimited'\?null:Number\(fields.stock\)/);
 assert.match(studio,/stock:value,stockRevision:p.stockRevision/);
 assert.match(studio,/value=n===null\?null:Number\(n\)/);
 assert.match(studio,/<option value="unlimited">Ilimitado/);
 assert.match(platform,/setStockMode\(next\)/);
});
test('V12: imagem hero é preenchida sem barras e tem 5 presets de foco',()=>{
 const platform=read('platform.jsx');const menu=read('SavorMenu.jsx');const css=read('savor-menu.css');
 for(const name of ['Esquerda','Centro','Direita','Topo','Embaixo'])assert.ok(platform.includes(`name:'${name}'`));
 assert.match(platform,/backgroundSize:'cover'/);
 assert.match(menu,/className="sm-hero-image"/);
 assert.match(menu,/objectPosition:/);
 assert.match(css,/\.sm-hero-image\s*\{[\s\S]*?object-fit:cover/);
});
