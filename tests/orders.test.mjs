import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOrder} from '../src/ordersCore.js';
test('V13 envia somente produto/quantidade e remove preços falsificados do navegador',()=>{
  const value=normalizeOrder({requestId:'f6b7462d-d955-44b8-a07f-22f9bac5c76a',customerName:'Ana',notes:'Sem cebola',items:[{productId:'p1',name:'Hambúrguer',quantity:2,price:0.01,total:0.02},{productId:'p2',quantity:1,price:999999}]});
  assert.deepEqual(value.items,[{productId:'p1',quantity:2},{productId:'p2',quantity:1}]);
  assert.equal(value.total,undefined);
  assert.equal(value.customerName,'Ana');
});
test('V13 valida quantidade inteira, IDs e produtos únicos antes da API',()=>{
  assert.throws(()=>normalizeOrder({items:[]}),/Carrinho/);
  assert.throws(()=>normalizeOrder({items:[{productId:'x',quantity:51}]}),/Quantidade/);
  assert.throws(()=>normalizeOrder({items:[{productId:'x',quantity:2},{productId:'x',quantity:2}]}),/repetido/);
});
