import test from 'node:test';
import assert from 'node:assert/strict';
import {withRequestTimeout} from '../src/request-timeout.js';

test('V13.1: resposta rápida não é abortada',async()=>{
  const result=await withRequestTimeout(async signal=>{
    assert.equal(signal.aborted,false);
    return {ok:true};
  },{timeoutMs:200});
  assert.deepEqual(result,{ok:true});
});

test('V13.1: operação pendente expira e aborta a requisição',async()=>{
  let observed;
  await assert.rejects(withRequestTimeout(signal=>{
    observed=signal;
    return new Promise(()=>{});
  },{timeoutMs:30}),{code:'api/timeout'});
  assert.equal(observed.aborted,true);
});

test('V13.1: cancelamento externo é imediato',async()=>{
  const controller=new AbortController();
  const promise=withRequestTimeout(()=>new Promise(()=>{}),{timeoutMs:1000,signal:controller.signal});
  controller.abort();
  await assert.rejects(promise,{code:'api/cancelled'});
});

test('V13.1: erro original da API é preservado',async()=>{
  const expected=Object.assign(new Error('Estoque insuficiente'),{code:'api/conflict'});
  await assert.rejects(withRequestTimeout(async()=>{throw expected;},{timeoutMs:200}),e=>e===expected);
});
