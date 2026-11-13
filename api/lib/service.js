import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {ApiError,fail,segment,validateRestaurantPatch,validateProductPatch,validateOrderInput,validateWebhookUrl,buildPublicMenu,calculateOfficialOrder} from './validation.js';

const ts=()=>Date.now();
const key=id=>{if(!segment(id))fail(400,'Identificador inválido.');return id;};
const getValue=async(db,path)=>(await db.ref(path).get()).val();
const checkAdmin=user=>{if(!user||user.platformAdmin!==true)fail(403,'Operação exclusiva do gestor.','forbidden');};
const slugBase=name=>String(name||'estabelecimento').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'estabelecimento';
const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newSlug=name=>`${slugBase(name)}-${Array.from(randomBytes(4),v=>chars[v%chars.length]).join('')}`;
const canonicalProduct=p=>({name:p.name,price:p.price,active:p.active!==false,stockMode:Number.isInteger(p.stock)?'limited':'unlimited',stock:Number.isInteger(p.stock)?p.stock:0,stockRevision:Number.isInteger(p.stockRevision)?p.stockRevision:0});

export function createService(db){
  async function restaurant(rid){
    const r=await getValue(db,`restaurants/${key(rid)}`);
    if(!r)fail(404,'Estabelecimento não encontrado.','not_found');
    return r;
  }
  async function canManage(rid,user){
    if(!user)fail(401,'Entre na sua conta.','unauthenticated');
    const r=await restaurant(rid);
    if(!user.platformAdmin && r.ownerUid!==user.uid)fail(403,'Você não gerencia este estabelecimento.','forbidden');
    return r;
  }
  async function syncCommerce(rid,r){
    // Bootstrap idempotente dos produtos V12 para o registro comercial V13.
    // Nunca substitui saldos e preços que já foram escritos pela V13.
    const source=r||await restaurant(rid);
    await db.ref(`commerce/${rid}/products`).transaction(current=>{
      const output=current||{};
      for(const [pid,product] of Object.entries(source.products||{}))if(!Object.hasOwn(output,pid))output[pid]=canonicalProduct(product);
      return output;
    },undefined,false);
  }
  async function projected(rid,override){
    const r=override||await restaurant(rid);
    const [models,commerceProducts]=await Promise.all([
      getValue(db,'modelCatalog'),getValue(db,`commerce/${rid}/products`)
    ]);
    const products={};
    for(const [pid,p] of Object.entries(r.products||{})){
      const c=commerceProducts?.[pid];
      products[pid]={...p,stock:c?(c.stockMode==='limited'?c.stock:null):p.stock};
    }
    return buildPublicMenu(rid,r,models||{},products);
  }
  async function publishProjection(rid,override){
    const r=override||await restaurant(rid);
    // Keep unpublished projections unavailable by rules, not just by React checks.
    await db.ref(`publicMenus/${rid}`).set(await projected(rid,r));
  }
  async function createRestaurant(user,data){
    if(!user)fail(401,'Faça login para cadastrar um estabelecimento.');
    const name=String(data?.name||'').trim();
    if(!name||name.length>90)fail(422,'Nome do estabelecimento inválido.');
    const id=db.ref('restaurants').push().key;
    const value={ownerUid:user.uid,name,tagline:'Conheça nosso cardápio em 3D.',whatsapp:'',instagram:'',instagramName:'',instagramBio:'',niche:'',address:'',cover:'',logo:'',accentColor:'#667843',slug:'',publicationStatus:'draft',published:false,createdAt:ts(),updatedAt:ts()};
    await db.ref(`restaurants/${id}`).set(value);
    return {id};
  }
  async function updateRestaurant(user,rid,input){
    const r=await canManage(rid,user);
    const patch=validateRestaurantPatch(input);
    await db.ref(`restaurants/${rid}`).update({...patch,updatedAt:ts()});
    await publishProjection(rid,{...r,...patch});
    return {ok:true};
  }
  async function updateProduct(user,rid,pid,input,creating=false){
    const r=await canManage(rid,user);
    if(creating && pid)fail(400,'ID não deve ser enviado ao criar.');
    const id=creating?db.ref(`restaurants/${rid}/products`).push().key:key(pid);
    const existing=creating?null:r.products?.[id];
    if(!creating&&!existing)fail(404,'Produto não encontrado.');
    const patch=validateProductPatch(input,{creating});
    const expectedRevision=patch.stockRevision;
    delete patch.stockRevision;
    if(patch.modelId){
      const model=await getValue(db,`modelCatalog/${patch.modelId}`);
      if(!model?.active)fail(422,'Modelo 3D inexistente ou inativo.');
    }
    const next={...(existing||{}),...patch};
    // Serialize updates to prices/availability/stock with order confirmation transactions.
    let conflict=false;
    const updated=await db.ref(`commerce/${rid}`).transaction(current=>{
      const state=current||{};
      const products=state.products||{};
      const old=products[id];
      if(!creating&&!old){ // Existing V12 stores are bootstrapped before edits.
        products[id]=canonicalProduct(existing);
      }
      const previous=products[id]||canonicalProduct(next);
      if(!creating&&Object.hasOwn(patch,'stock')&&expectedRevision!==previous.stockRevision){conflict=true;return;}
      products[id]={...previous,name:next.name,price:next.price,active:next.active!==false,
        stockMode:Object.hasOwn(patch,'stock')?(Number.isInteger(patch.stock)?'limited':'unlimited'):previous.stockMode,stock:Object.hasOwn(patch,'stock')?(Number.isInteger(patch.stock)?patch.stock:0):previous.stock,
        stockRevision:previous.stockRevision+(Object.hasOwn(patch,'stock')?1:0)};
      state.products=products;
      return state;
    },undefined,false);
    if(!updated.committed)fail(409,conflict?'O estoque foi alterado por outro pedido. Atualize a página para editar novamente.':'Não foi possível atualizar o produto.');
    const revision=updated.snapshot.val()?.products?.[id]?.stockRevision??0;
    const stamp=ts();
    await db.ref(`restaurants/${rid}/products/${id}`).set({...next,stockRevision:revision,updatedAt:stamp,...(creating?{createdAt:stamp,modelStatus:'none'}:{})});
    await publishProjection(rid);
    return {id};
  }
  async function deleteProduct(user,rid,pid){
    await canManage(rid,user);key(pid);
    await db.ref(`commerce/${rid}`).transaction(current=>{
      const state=current||{};
      const products=state.products||{};
      delete products[pid];state.products=products;
      return state;
    },undefined,false);
    await db.ref(`restaurants/${rid}/products/${pid}`).remove();
    await publishProjection(rid);
    return {ok:true};
  }
  async function createModelRequest(user,rid,productId){
    const r=await canManage(rid,user);
    const p=r.products?.[key(productId)];
    if(!p)fail(404,'Produto não encontrado.');
    if(!p.photo&&!p.referencePhotos?.length)fail(422,'Envie uma fotografia primeiro.');
    const reqs=await getValue(db,'modelRequests');
    if(Object.values(reqs||{}).some(q=>q.restaurantId===rid && q.productId===productId && ['pending','in_progress'].includes(q.status)))fail(409,'Já existe uma solicitação aberta.');
    const id=db.ref('modelRequests').push().key;
    await db.ref(`modelRequests/${id}`).set({restaurantId:rid,ownerUid:r.ownerUid,productId,productName:p.name,note:'Produção do modelo 3D a partir das imagens enviadas.',status:'pending',createdAt:ts(),updatedAt:ts()});
    return {id};
  }
  async function createPublicationRequest(user,rid){
    const r=await canManage(rid,user);
    if(r.published)fail(409,'Cardápio já publicado.');
    if(!/^55\d{10,11}$/.test(r.whatsapp||''))fail(422,'Cadastre um WhatsApp válido.');
    if(!Object.values(r.products||{}).some(p=>p.active===true))fail(422,'Ative ao menos um produto.');
    const reqs=await getValue(db,'publicationRequests');
    if(Object.values(reqs||{}).some(q=>q.restaurantId===rid&&q.status==='pending'))fail(409,'Já existe uma publicação em análise.');
    const id=db.ref('publicationRequests').push().key;
    await db.ref(`publicationRequests/${id}`).set({restaurantId:rid,ownerUid:r.ownerUid,restaurantName:r.name,status:'pending',createdAt:ts(),updatedAt:ts()});
    return {id};
  }
  async function getOrReserveSlug(rid,r){
    if(r.slug){
      if((await getValue(db,`slugIndex/${r.slug}`))===rid)return r.slug;
      fail(409,'Endereço público inconsistente.');
    }
    for(let i=0;i<25;i++){
      const candidate=newSlug(r.name);
      const reserved=await db.ref(`slugIndex/${candidate}`).transaction(v=>v===null?rid:undefined,undefined,false);
      if(reserved.committed)return candidate;
    }
    fail(503,'Não foi possível gerar um endereço público.');
  }
  async function approve(user,requestId,decision){
    checkAdmin(user);key(requestId);
    if(!['approved','rejected'].includes(decision))fail(422,'Decisão inválida.');
    const q=await getValue(db,`publicationRequests/${requestId}`);
    if(!q||q.status!=='pending')fail(409,'Solicitação indisponível.');
    const rid=key(q.restaurantId),r=await restaurant(rid);
    if(decision==='rejected'){
      await db.ref().update({[`publicationRequests/${requestId}/status`]:'rejected',[`publicationRequests/${requestId}/reviewedAt`]:ts(),[`restaurants/${rid}/publicationStatus`]:'rejected'});
      return {ok:true};
    }
    if(!/^55\d{10,11}$/.test(r.whatsapp||''))fail(422,'WhatsApp obrigatório.');
    if(!Object.values(r.products||{}).some(p=>p.active===true))fail(422,'Ative ao menos um produto.');
    await syncCommerce(rid,r);
    const slug=await getOrReserveSlug(rid,r);
    const changed={...r,slug,published:true,publicationStatus:'approved'};
    const projection=await projected(rid,changed);
    await db.ref().update({[`restaurants/${rid}/slug`]:slug,[`restaurants/${rid}/published`]:true,[`restaurants/${rid}/publicationStatus`]:'approved',[`restaurants/${rid}/reviewedAt`]:ts(),[`publicationRequests/${requestId}/status`]:'approved',[`publicationRequests/${requestId}/reviewedAt`]:ts(),[`publicationRequests/${requestId}/slug`]:slug,[`publicMenus/${rid}`]:projection});
    return {ok:true,slug};
  }
  async function assignSlug(user,rid){
    checkAdmin(user);const r=await restaurant(rid);
    const slug=await getOrReserveSlug(rid,r);
    const next={...r,slug};
    await db.ref().update({[`restaurants/${rid}/slug`]:slug,[`publicMenus/${rid}`]:await projected(rid,next)});
    return {slug};
  }
  async function pause(user,rid){
    checkAdmin(user);const r=await restaurant(rid);
    if(!r.published && (!r.slug||!['paused','approved'].includes(r.publicationStatus)))fail(409,'Aprovação inicial obrigatória.');
    const next={...r,published:!r.published,publicationStatus:r.published?'paused':'approved'};
    await db.ref().update({[`restaurants/${rid}/published`]:next.published,[`restaurants/${rid}/publicationStatus`]:next.publicationStatus,[`restaurants/${rid}/updatedAt`]:ts(),[`publicMenus/${rid}`]:await projected(rid,next)});
    return {published:next.published};
  }
  async function updateModelRequest(user,requestId,input){
    checkAdmin(user);
    const q=await getValue(db,`modelRequests/${key(requestId)}`);
    if(!q)fail(404,'Solicitação não encontrada.');
    const status=input?.status;
    if(!['in_progress','delivered','rejected'].includes(status))fail(422,'Status inválido.');
    const changes={[`modelRequests/${requestId}/status`]:status,[`modelRequests/${requestId}/updatedAt`]:ts()};
    if(status==='delivered'){
      const modelId=key(input.modelId),model=await getValue(db,`modelCatalog/${modelId}`);
      if(!model?.active)fail(422,'Modelo ativo obrigatório.');
      changes[`modelRequests/${requestId}/deliveredAt`]=ts();
      changes[`modelRequests/${requestId}/modelId`]=modelId;
      changes[`restaurants/${q.restaurantId}/products/${q.productId}/modelId`]=modelId;
      changes[`restaurants/${q.restaurantId}/products/${q.productId}/modelStatus`]='delivered';
    }else if(status==='in_progress')changes[`restaurants/${q.restaurantId}/products/${q.productId}/modelStatus`]='in_progress';
    await db.ref().update(changes);
    if(status==='delivered')await publishProjection(q.restaurantId);
    return {ok:true};
  }
  async function writeModel(user,input,modelId){
    checkAdmin(user);
    if(modelId){
      const existing=await getValue(db,`modelCatalog/${key(modelId)}`);
      if(!existing)fail(404,'Modelo não encontrado.');
      if(typeof input?.active!=='boolean'||Object.keys(input).some(k=>!['active','updatedAt'].includes(k)))fail(422,'Somente status ativo pode ser alterado.');
      await db.ref(`modelCatalog/${modelId}`).update({active:input.active,updatedAt:ts()});
      await rebuildAllPublic(user);
      return {ok:true};
    }
    const name=String(input?.name||'').trim(),category=String(input?.category||'').trim();
    if(!name||name.length>120||category.length>80)fail(422,'Nome ou categoria inválida.');
    let url;
    try{url=new URL(input.url);}catch{fail(422,'URL inválida.');}
    if(url.protocol!=='https:'||url.username||url.password||url.hash||!url.pathname.toLowerCase().endsWith('.glb')||url.href.length>2000)fail(422,'Informe URL HTTPS direta de arquivo .glb.');
    const id=db.ref('modelCatalog').push().key;
    await db.ref(`modelCatalog/${id}`).set({name,category,url:url.href,active:true,createdAt:ts(),updatedAt:ts()});
    return {id};
  }
  async function rebuildAllPublic(user){
    checkAdmin(user);
    const all=await getValue(db,'restaurants');
    let count=0;
    for(const [rid,r] of Object.entries(all||{})){
      if(r.published)await syncCommerce(rid,r);
      await publishProjection(rid);
      count++;
    }
    return {count};
  }
  async function createOrder(input){
    const orderInput=validateOrderInput(input);
    const rid=orderInput.restaurantId,r=await restaurant(rid);
    if(!r.published)fail(404,'Cardápio indisponível.');
    await syncCommerce(rid,r);
    const id='o_'+createHash('sha256').update(`${rid}:${orderInput.requestId}`).digest('hex').slice(0,28);
    const stamp=ts();
    let created=false;
    const trans=await db.ref(`commerce/${rid}`).transaction(current=>{
      created=false;
      // Firebase pode iniciar a transacao com cache null.
      // Retornar {} permite reconciliar com o estado remoto.
      if(current===null)return {};
      const orders=current.orders||{};
      if(orders[id])return current; // retries are idempotent
      created=true;
      const pricing=calculateOfficialOrder(orderInput.items,current.products||{});
      const code=id.slice(2,10).toUpperCase();
      orders[id]={...pricing,customerName:orderInput.customerName,notes:orderInput.notes,code,status:'initiated',stockApplied:false,createdAt:stamp,updatedAt:stamp};
      current.orders=orders;
      return current;
    },undefined,false);
    if(!trans.committed)fail(503,'Não foi possível registrar o pedido.','order_transaction_aborted');
    const order=trans.snapshot.val()?.orders?.[id];
    if(!order)fail(503,'Pedido não foi confirmado pelo banco.','order_missing_after_commit');
    await db.ref(`orders/${rid}/${id}`).set(order); // replica de leitura do painel atual
    // Indicador comercial autoritativo: visitantes não podem falsificar este evento.
    if(created){try {await businessEvent(rid,'order_intent');}catch(e){console.warn('[Mezzira] Métrica de pedido não gravada:',e?.message);}}
    return {id,code:order.code,status:order.status,total:order.total,items:order.items};
  }
  async function changeOrder(user,rid,oid,status){
    const r=await canManage(rid,user);
    if(!['initiated','confirmed','preparing','completed','cancelled'].includes(status))fail(422,'Status inválido.');
    // Legacy V12 order: import on first action. A legacy order is never charged/confirmed based on its untrusted prices.
    await syncCommerce(rid,r);
    if(!await getValue(db,`commerce/${rid}/orders/${oid}`)){
      const legacy=await getValue(db,`orders/${rid}/${oid}`);
      if(!legacy)fail(404,'Pedido não encontrado.');
      if(status!=='cancelled')fail(409,'Pedido legado: cancele ou registre novamente usando o checkout V13.');
      await db.ref(`orders/${rid}/${oid}`).update({status:'cancelled',updatedAt:ts()});
      return {status:'cancelled'};
    }
    let error=null,changed=false;
    const result=await db.ref(`commerce/${rid}`).transaction(current=>{
      changed=false;
      if(!current?.orders?.[oid])return;
      const order=current.orders[oid],prev=order.status;
      if(prev===status)return current;
      const possible={initiated:['confirmed','cancelled'],confirmed:['preparing','completed','cancelled'],preparing:['completed','cancelled'],completed:[],cancelled:[]};
      if(!possible[prev]?.includes(status)){error='Transição inválida para o estado solicitado.';return;}
      if(status==='confirmed' && !order.stockApplied){
        for(const item of order.items){
          const p=current.products?.[item.productId];
          if(!p||p.active===false){error=`Produto indisponível: ${item.name}`;return;}
          if(p.stockMode==='limited'&&p.stock<item.quantity){error=`Estoque insuficiente: ${item.name}`;return;}
        }
        for(const item of order.items){const p=current.products[item.productId];if(p.stockMode==='limited'){p.stock-=item.quantity;p.stockRevision=(p.stockRevision||0)+1;}}
        order.stockApplied=true;
      }
      if(status==='cancelled'&&order.stockApplied){
        for(const item of order.items){const p=current.products?.[item.productId];if(p?.stockMode==='limited'){p.stock+=item.quantity;p.stockRevision=(p.stockRevision||0)+1;}}
        order.stockApplied=false;
      }
      changed=true;order.status=status;order.updatedAt=ts();
      return current;
    },undefined,false);
    if(!result.committed)fail(409,error||'Este pedido foi alterado. Atualize e tente novamente.');
    const val=result.snapshot.val(),order=val?.orders?.[oid];
    if(!order)fail(500,'Pedido não localizado após confirmação.');
    // Mirror changes are eventually consistent. commerce/ is the source of truth.
    const updates={[`orders/${rid}/${oid}`]:order};
    if(['confirmed','cancelled'].includes(status)){
      for(const item of order.items){
        const p=val.products?.[item.productId];
        if(p){updates[`restaurants/${rid}/products/${item.productId}/stock`]=p.stockMode==='limited'?p.stock:null;updates[`restaurants/${rid}/products/${item.productId}/stockRevision`]=p.stockRevision||0;}
      }
    }
    await db.ref().update(updates);
    if(['confirmed','cancelled'].includes(status))await publishProjection(rid);
    const byStatus={confirmed:'order_confirmed',completed:'order_completed',cancelled:'order_cancelled'};
    if(changed&&byStatus[status]){try{await businessEvent(rid,byStatus[status]);}catch(e){console.warn('[Mezzira] Métrica operacional não gravada:',e?.message);}}
    return {status:order.status};
  }
  async function businessEvent(rid,type,message=''){
    const at=ts();
    const day=new Date(at).toISOString().slice(0,10);
    await db.ref(`analytics/${rid}/events`).push().set({type,at,message});
    // Agregado compacto, útil para evolução dos gráficos sem download de todos os eventos.
    await db.ref(`metricsDaily/${rid}/${day}`).transaction(current=>{
      const daily=current||{counts:{},updatedAt:at};
      daily.counts=daily.counts||{};
      daily.counts[type]=(daily.counts[type]||0)+1;
      daily.updatedAt=at;
      return daily;
    },undefined,false);
  }
  async function recordEvent(input){
    const rid=key(input?.restaurantId),r=await restaurant(rid);
    if(!r.published)fail(404,'Cardápio indisponível.');
    // Eventos financeiros são sempre gerados pelo servidor, jamais pelo cliente.
    const allowed=['view','exit','ar_open','error','product_view','add_to_cart','checkout_started'];
    if(!allowed.includes(input.type))fail(422,'Evento desconhecido.');
    const message=String(input.message||'').replace(/[\r\n\t]/g,' ').slice(0,180);
    await businessEvent(rid,input.type,message);
    return {ok:true};
  }
  async function audit(user,action,resource){
    const date=new Date().toISOString().slice(0,10);
    await db.ref(`auditLogs/${date}`).push().set({uid:user?.uid||'',action:String(action).slice(0,60),resource:String(resource||'').slice(0,180),at:ts()});
  }
  async function mutate(user,operation,path,value){
    if(!user)fail(401,'Entre na sua conta.');
    const parts=String(path||'').split('/');
    if(!parts.every(segment))fail(400,'Caminho inválido.');
    if(operation==='add'&&parts.length===1&&parts[0]==='restaurants')return createRestaurant(user,value);
    if(parts[0]==='restaurants'&&parts.length===2&&operation==='update')return updateRestaurant(user,parts[1],value);
    if(parts[0]==='restaurants'&&parts[2]==='products'){
      if(parts.length===3&&operation==='add')return updateProduct(user,parts[1],null,value,true);
      if(parts.length===4&&operation==='update')return updateProduct(user,parts[1],parts[3],value);
      if(parts.length===4&&operation==='delete')return deleteProduct(user,parts[1],parts[3]);
    }
    if(parts[0]==='modelRequests'){
      if(parts.length===1&&operation==='add')return createModelRequest(user,key(value?.restaurantId),key(value?.productId));
      if(parts.length===2&&operation==='update')return updateModelRequest(user,parts[1],value);
    }
    if(parts[0]==='publicationRequests'&&parts.length===1&&operation==='add')return createPublicationRequest(user,key(value?.restaurantId));
    if(parts[0]==='modelCatalog'){
      if(parts.length===1&&operation==='add')return writeModel(user,value);
      if(parts.length===2&&operation==='update')return writeModel(user,value,parts[1]);
    }
    if(parts[0]==='orders'&&parts.length===3&&operation==='update')return changeOrder(user,parts[1],parts[2],value?.status);
    if(parts[0]==='integrations'&&parts.length===2&&operation==='set'){
      await canManage(parts[1],user);
      const webhookUrl=validateWebhookUrl(value?.webhookUrl);
      await db.ref(`integrations/${parts[1]}`).set({webhookUrl,webhookReady:false,updatedAt:ts()});
      return {ok:true};
    }
    if(parts[0]==='settings'&&parts[1]==='site'&&parts.length===2&&operation==='set'){
      checkAdmin(user);
      const values={};
      for(const [k,max] of [['name',60],['headline',180],['description',600]]){
        if(typeof value?.[k]!=='string'||value[k].length>max)fail(422,`${k} inválido.`);
        values[k]=value[k].trim();
      }
      await db.ref('settings/site').update(values);
      return {ok:true};
    }
    fail(403,'Operação não autorizada.','forbidden');
  }
  return {mutate,createOrder,recordEvent,approve,assignSlug,pause,rebuildAllPublic,changeOrder,projected,canManage,restaurant,audit};
}
