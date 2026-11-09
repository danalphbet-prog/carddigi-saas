import test from 'node:test';
import assert from 'node:assert/strict';
import { errText } from '../src/errors.js';

test('erro de configuração Google não revela a infraestrutura ao visitante', () => {
  const text = errText({code:'auth/configuration-not-found',message:'Firebase: Error (auth/configuration-not-found).'});
  assert.match(text, /Google/);
  assert.doesNotMatch(text, /firebase|configuration-not-found|auth\//i);
});

test('domínio não autorizado recebe aviso legível', () => {
  const text = errText({code:'auth/unauthorized-domain'});
  assert.match(text, /endereço/);
  assert.doesNotMatch(text, /Firebase|auth\//i);
});

test('erros de validação próprios continuam informativos', () => {
  assert.equal(errText(new Error('Informe o nome do produto.')), 'Informe o nome do produto.');
});
