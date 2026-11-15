import test from 'node:test';
import assert from 'node:assert/strict';
import {EXAMPLE_PRODUCT,normalizeProduct,serializeProducts,parseProducts,productKey,MAX_PRODUCTS_PER_FILE} from '../src/product-interchange.js';

test('modelo JSON é válido e preserva preço, mensagem e estoque ilimitado',()=>{
  const json=serializeProducts([EXAMPLE_PRODUCT],'json');
  const [p]=parseProducts(json,'json');
  assert.equal(p.price,49.9);
  assert.equal(p.prompt,'Quer adicionar esta pizza ao pedido?');
  assert.equal(p.stock,null);
  assert.equal(p.photo,'');
  assert.equal(p.ingredients.length,4);
});

test('exportação de produtos reais ignora IDs e campos de administração',()=>{
  const json=serializeProducts([{...EXAMPLE_PRODUCT,id:'abc',ownerUid:'segredo',modelStatus:'in_progress',stockRevision:5,updatedAt:123}],'json');
  assert.ok(!json.includes('segredo'));
  assert.ok(!json.includes('stockRevision'));
  assert.ok(!json.includes('modelStatus'));
});

test('formulário aceita ingredientes por linha e mantém saldo zero',()=>{
  const p=normalizeProduct({...EXAMPLE_PRODUCT,ingredients:'Pão\nQueijo',stock:0});
  assert.deepEqual(p.ingredients,['Pão','Queijo']);
  assert.equal(p.stock,0);
});

test('XML exportado preserva caracteres especiais e a mensagem de AR',()=>{
  const xml=serializeProducts([{...EXAMPLE_PRODUCT,name:'Massa & Molho <caseiro>',prompt:'Quer "experimentar"?'}],'xml');
  assert.ok(xml.includes('Massa &amp; Molho &lt;caseiro&gt;'));
  assert.ok(xml.includes('Quer &quot;experimentar&quot;?'));
  assert.ok(xml.includes('<prompt>'));
  assert.ok(xml.includes('<stock></stock>'));
});

test('recusa campos estranhos, preços inadequados e URLs externas para imagens',()=>{
  assert.throws(()=>parseProducts(JSON.stringify({version:1,products:[{...EXAMPLE_PRODUCT,isAdmin:true}]}),'json'),/não reconhecido/);
  assert.throws(()=>normalizeProduct({...EXAMPLE_PRODUCT,price:25.555}),/duas casas/);
  assert.throws(()=>normalizeProduct({...EXAMPLE_PRODUCT,photo:'https://example.com/foto.jpg'}),/Base64/);
  assert.throws(()=>normalizeProduct({...EXAMPLE_PRODUCT,stock:-1}),/stock/);
});

test('imagens JPEG/WebP Base64 são preservadas',()=>{
  const image='data:image/webp;base64,AQID';
  const p=normalizeProduct({...EXAMPLE_PRODUCT,photo:image,referencePhotos:[image]});
  const [copy]=parseProducts(serializeProducts([p],'json'),'json');
  assert.equal(copy.photo,image);
  assert.equal(copy.referencePhotos[0],image);
});

test('recusa XML com DOCTYPE/ENTITY antes de analisá-lo',()=>{
  assert.throws(()=>parseProducts('<!DOCTYPE mezzira [<!ENTITY x SYSTEM "file:///etc/passwd">]><mezzira/>','xml'),/não é permitido/);
});

test('valida versão, quantidade e identidade de duplicados',()=>{
  assert.throws(()=>parseProducts('{"version":5,"products":[]}', 'json'),/Versão/);
  assert.throws(()=>serializeProducts(Array(MAX_PRODUCTS_PER_FILE+1).fill(EXAMPLE_PRODUCT),'json'),/entre 1 e/);
  assert.equal(productKey({name:' Café ',cat:'Doces'}),productKey({name:'café',cat:'DOCES'}));
});
