import test from 'node:test';
import assert from 'node:assert/strict';
import {createService} from '../lib/service.js';
import {validateOrderInput,validateProductPatch,buildPublicMenu} from '../lib/validation.js';

class MemoryDb {
  constructor(){this.data={};this.seq=0;}
  ref(path=''){
    const db=this;
    const parts=(path||'').split('/').filter(Boolean);
    const read=()=>{
      let v=db.data;
      for(const p of parts)v=v?.[p];
      return v===undefined?null:structuredClone(v);
    };
    const write=(pathSegments,v)=>{
      let target=db.data;
      if(!pathSegments.length){db.data=v;return;}
      for(const p of pathSegments.slice(0,-1))target=target[p]??(target[p]={});
      const tail=pathSegments.at(-1);
      if(v===null||v===undefined)delete target[tail];else target[tail]=structuredClone(v);
    };
    return {
      key:parts.at(-1)||null,
      get:async()=>({val:read}),
      set:async v=>write(parts,v),
      remove:async()=>write(parts,null),
      push(){const key='p_'+String(++db.seq).padStart(4,'0');return {key,set:async v=>write([...parts,key],v)};},
      update:async changes=>{
        for(const [k,v] of Object.entries(changes))write([...parts,...k.split('/').filter(Boolean)],v);
      },
      transaction:async transform=>{
        if(db.simulateNullForCommerce && parts.length===2 && parts[0]==='commerce'){
          db.simulateNullForCommerce=false;
          if(transform(null)===undefined)
            return {committed:false,snapshot:{val:read}};
        }
        const proposed=transform(read());
        if(proposed===undefined)return {committed:false,snapshot:{val:read}};
        write(parts,proposed);
        return {committed:true,snapshot:{val:read}};
      }
    };
  }
}
const OWNER={uid:'u_owner',platformAdmin:false},OTHER={uid:'u_other',platformAdmin:false},ADMIN={uid:'u_admin',platformAdmin:true};
const uuid='2ac3639c-5414-4c5f-8cec-74a9f2cc5a22';

async function setup(){
  const db=new MemoryDb(),api=createService(db);
  const {id:rid}=await api.mutate(OWNER,'add','restaurants',{name:'Café V13'});
  await api.mutate(OWNER,'update',`restaurants/${rid}`,{whatsapp:'5511999999999'});
  const {id:pid}=await api.mutate(OWNER,'add',`restaurants/${rid}/products`,{name:'Café',price:12.5,active:true,stock:3,photo:'',referencePhotos:[]});
  const {id:qid}=await api.mutate(OWNER,'add','publicationRequests',{restaurantId:rid});
  const published=await api.approve(ADMIN,qid,'approved');
  return {db,api,rid,pid,published};
}
test('V13: produto oculto/privado nunca expõe referência 3D',()=>{
  const projection=buildPublicMenu('r1',{name:'Loja',published:true,ownerUid:'uid',products:{p1:{name:'Pizza',price:20,active:true,referencePhotos:['SEGREDO'],modelStatus:'in_progress'},p2:{name:'Oculto',active:false}}});
  assert.equal(projection.ownerUid,undefined);
  assert.equal(projection.products.p1.referencePhotos,undefined);
  assert.equal(projection.products.p2,undefined);
});
test('V13: preço e estoque são validados no servidor',()=>{
  assert.equal(validateProductPatch({stock:null}).stock,null);
  assert.throws(()=>validateProductPatch({stock:-1}));
  assert.throws(()=>validateProductPatch({published:true}));
  assert.throws(()=>validateOrderInput({restaurantId:'r1',items:[{productId:'p1',quantity:1}],requestId:'xxx'}));
});
test('V13: IDOR bloqueado, publicação aprovada e preço do cliente ignorado',async()=>{
  const {db,api,rid,pid,published}=await setup();
  assert.match(published.slug,/^[a-z0-9-]+-[A-Z2-9]{4}$/);
  await assert.rejects(api.mutate(OTHER,'update',`restaurants/${rid}`,{name:'Invadido'}),/não gerencia/i);
  await assert.rejects(api.mutate(OWNER,'update',`restaurants/${rid}`,{published:false}),/Campo não permitido/);
  const result=await api.createOrder({restaurantId:rid,requestId:uuid,items:[{productId:pid,quantity:2,price:0.01}],notes:'Sem açúcar'});
  assert.equal(result.total,25);
  assert.equal(result.items[0].price,12.5);
  const second=await api.createOrder({restaurantId:rid,requestId:uuid,items:[{productId:pid,quantity:2,price:500}]});
  assert.equal(second.id,result.id);
  assert.equal(Object.keys(db.data.commerce[rid].orders).length,1);
  assert.equal(db.data.publicMenus[rid].ownerUid,undefined);
  assert.equal(db.data.publicMenus[rid].products[pid].referencePhotos,undefined);
});
test('V13: confirmação transacional baixa estoque uma vez e cancelamento repõe',async()=>{
  const {db,api,rid,pid}=await setup();
  const first=await api.createOrder({restaurantId:rid,requestId:uuid,items:[{productId:pid,quantity:2}]});
  const other=await api.createOrder({restaurantId:rid,requestId:'cf9f99c6-c037-400d-a9f0-7eea87a39099',items:[{productId:pid,quantity:2}]});
  await api.changeOrder(OWNER,rid,first.id,'confirmed');
  assert.equal(db.data.commerce[rid].products[pid].stock,1);
  await api.changeOrder(OWNER,rid,first.id,'confirmed');
  assert.equal(db.data.commerce[rid].products[pid].stock,1);
  await assert.rejects(api.changeOrder(OWNER,rid,other.id,'confirmed'),/Estoque insuficiente/);
  await api.changeOrder(OWNER,rid,first.id,'cancelled');
  assert.equal(db.data.commerce[rid].products[pid].stock,3);
  assert.equal(db.data.publicMenus[rid].products[pid].stock,3);
  assert.equal(db.data.orders[rid][first.id].status,'cancelled');
});
test('V13: ações administrativas não podem ser chamadas por proprietário',async()=>{
  const {api,rid}=await setup();
  await assert.rejects(api.pause(OWNER,rid),/gestor/i);
  const result=await api.pause(ADMIN,rid);
  assert.equal(result.published,false);
});

test('V13: edição antiga do estoque não sobrescreve baixa confirmada',async()=>{
  const {api,rid,pid}=await setup();
  const order=await api.createOrder({restaurantId:rid,requestId:uuid,items:[{productId:pid,quantity:1}]});
  await api.changeOrder(OWNER,rid,order.id,'confirmed');
  await assert.rejects(api.mutate(OWNER,'update',`restaurants/${rid}/products/${pid}`,{stock:3,stockRevision:1}),/estoque foi alterado/);
});
test('V13: produto com estoque ilimitado permanece disponível após confirmação',async()=>{
  const {api,db,rid,pid}=await setup();
  const stockRev=db.data.restaurants[rid].products[pid].stockRevision;
  await api.mutate(OWNER,'update',`restaurants/${rid}/products/${pid}`,{stock:null,stockRevision:stockRev});
  const order=await api.createOrder({restaurantId:rid,requestId:uuid,items:[{productId:pid,quantity:50}]});
  await api.changeOrder(OWNER,rid,order.id,'confirmed');
  assert.equal(db.data.commerce[rid].products[pid].stockMode,'unlimited');
  assert.equal(db.data.publicMenus[rid].products[pid].stock,null);
});

test('V13.1.1: checkout resiste a null inicial',async()=>{
  const {db,api,rid,pid}=await setup();
  db.simulateNullForCommerce=true;
  const order=await api.createOrder({
    restaurantId:rid,
    requestId:'afbc01d4-8bde-419d-ac83-9bcb1ed4ae28',
    items:[{productId:pid,quantity:1}]
  });
  assert.equal(order.total,12.5);
  assert.ok(db.data.commerce[rid].orders[order.id]);
});
