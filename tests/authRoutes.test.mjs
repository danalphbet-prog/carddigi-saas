import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldRedirectToBusiness} from '../src/authRoutes.js';
test('usuário logado não retorna para landing, login ou rota inexistente',()=>{
  assert.equal(shouldRedirectToBusiness('/',true),true);
  assert.equal(shouldRedirectToBusiness('/entrar',true),true);
  assert.equal(shouldRedirectToBusiness('/rota-inexistente',true),true);
});
test('usuário autenticado mantém rotas de painel e do cardápio público',()=>{
  assert.equal(shouldRedirectToBusiness('/painel',true),false);
  assert.equal(shouldRedirectToBusiness('/painel/restaurante/abc',true),false);
  assert.equal(shouldRedirectToBusiness('/gestor',true),false);
  assert.equal(shouldRedirectToBusiness('/menu/pizzaria-A7K2',true),false);
});
test('visitante pode acessar a apresentação e a tela de login',()=>{
  assert.equal(shouldRedirectToBusiness('/',false),false);
  assert.equal(shouldRedirectToBusiness('/entrar',false),false);
});
