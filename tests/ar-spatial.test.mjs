import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const viewer = readFileSync(new URL('../src/ar-viewer.jsx', import.meta.url), 'utf8');
const spatial = readFileSync(new URL('../src/ar-cards.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
test('o AR cria o card do produto como mesh na âncora do prato', () => {
  assert.match(viewer, /dishCard = createDishSpatialCard\(product\)/);
  assert.match(viewer, /pusher\.add\(dishCard\.mesh\)/);
});
test('o Instagram fica inativo no AR, sem remover o módulo para versão futura', () => {
  assert.doesNotMatch(viewer, /createInstagramSpatialCard|socialCard\.mesh|socialOn/);
  assert.match(spatial, /createInstagramSpatialCard/);
});
test('categoria do produto substitui a etiqueta ilustrativa Veg', () => {
  assert.match(spatial, /const category = clean\(product\.cat\)/);
  assert.match(spatial, /ctx\.fillText\(category\.slice/);
  assert.doesNotMatch(spatial, /fillText\('Veg'/);
});
test('modelo GLB é preparado antes de conectar o XR à câmera', () => {
  const loadAt = viewer.indexOf('model = await loadProduct(product)');
  const xrAt = viewer.indexOf('session = await sessionP');
  assert.ok(loadAt > 0 && loadAt < xrAt);
  assert.match(viewer, /if \(session\) session\.end/);
});
test('Voltar usa transição visual e deixa encerramento XR para limpeza', () => {
  assert.match(viewer, /setTransition\('closing'\)/);
  assert.match(viewer, /setTimeout\(\(\) => \{ if \(!destroyed\) closeRef\.current\(\); \}, 260\)/);
  assert.doesNotMatch(viewer, /Promise\.race\(\[\s*session\.end/);
  assert.match(css, /\.ar-transition\.is-visible/);
});
test('overlay AR ocupa tela inteira sem margens', () => {
  assert.match(css, /\.ar-screen\{position:fixed;inset:0/);
  assert.doesNotMatch(css, /\.ar-screen\{[^}]*margin:\s*2%/);
});
