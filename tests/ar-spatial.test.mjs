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
test('o Instagram também pertence ao grupo espacial, sem CSS seguindo câmera', () => {
  assert.match(viewer, /pusher\.add\(socialCard\.mesh\)/);
  assert.doesNotMatch(viewer, /socialClip|socialWorld|socialRef\.current\.style\.left/);
});
test('o Instagram aparece após atraso e não some ao sair da tela', () => {
  assert.match(viewer, /nextSocial = performance\.now\(\) \+ 10000/);
  assert.match(viewer, /socialCard\.mesh\.visible = true/);
  assert.doesNotMatch(viewer, /socialUntil|Math\.abs\(socialClip/);
});
test('categoria do produto substitui a etiqueta ilustrativa Veg', () => {
  assert.match(spatial, /const category = clean\(product\.cat\)/);
  assert.match(spatial, /ctx\.fillText\(category\.slice/);
  assert.doesNotMatch(spatial, /fillText\('Veg'/);
});
test('sessão AR é ativada antes de aguardar o GLB', () => {
  assert.ok(viewer.indexOf('session = await sessionP') < viewer.indexOf('loadProduct(product).then', viewer.indexOf('session = await sessionP')));
  assert.match(viewer, /if \(session\) session\.end/);
});
test('overlay AR ocupa tela inteira sem margens', () => {
  assert.match(css, /\.ar-screen\{position:fixed;inset:0/);
  assert.doesNotMatch(css, /\.ar-screen\{[^}]*margin:\s*2%/);
});
