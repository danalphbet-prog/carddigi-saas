import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_SIDE, MAX_BASE64_CHARS, MAX_REFERENCE_PHOTOS, isPhotoDataUrl } from '../src/media.js';

test('configura 512 px e no máximo 5 referências', () => {
  assert.equal(PHOTO_SIDE, 512);
  assert.equal(MAX_REFERENCE_PHOTOS, 5);
});
test('valida imagens codificadas como Base64 WebP e JPEG', () => {
  assert.equal(isPhotoDataUrl('data:image/webp;base64,QUJDRA=='), true);
  assert.equal(isPhotoDataUrl('data:image/jpeg;base64,QUJDRA=='), true);
  assert.equal(isPhotoDataUrl('data:image/png;base64,QUJDRA=='), false);
  assert.equal(isPhotoDataUrl('https://exemplo.com/foto.webp'), false);
  assert.equal(isPhotoDataUrl('data:text/html;base64,PHNjcmlwdD4='), false);
});
test('rejeita strings acima do teto definido', () => {
  assert.equal(isPhotoDataUrl('data:image/webp;base64,' + 'A'.repeat(MAX_BASE64_CHARS)), false);
});
