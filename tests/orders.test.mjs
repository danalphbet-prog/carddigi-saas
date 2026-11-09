import {test} from 'node:test';
import assert from 'node:assert/strict';
// Testes de lógica pura extraída em arquivo independente para não depender do SDK no Node.
import {normalizeOrder} from '../src/ordersCore.js';
test('normaliza intenção de pedido e calcula total real dos itens',()=>{
 const value=normalizeOrder({customerName:'Ana',notes:'Sem cebola',items:[{name:'Hambúrguer',quantity:2,price:18.9},{name:'Suco',quantity:1,price:7}]});
 assert.equal(value.total,44.8);
 assert.equal(value.customerName,'Ana');
 assert.equal(value.items.length,2);
});
test('pedido precisa conter produtos e respeitar limite',()=>{
 assert.throws(()=>normalizeOrder({items:[]}),/Carrinho/);
 assert.throws(()=>normalizeOrder({items:[{name:'X',quantity:50,price:99999}]}),/limite/);
});
