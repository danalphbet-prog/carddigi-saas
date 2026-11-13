/** Pure validation utilities. The API never trusts client prices, roles or timestamps. */
export class ApiError extends Error {
  constructor(status, message, code='invalid_request') {super(message);this.status=status;this.code=code;}
}
export const fail=(status,message,code)=>{throw new ApiError(status,message,code);};
export const segment=value=>typeof value==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const safeString=(value,max,label='Texto')=>{
  if(typeof value!=='string'||value.length>max)fail(422,`${label} inválido.`);
  return value.trim();
};
const requiredString=(value,max,label)=>{
  const s=safeString(value,max,label);
  if(!s)fail(422,`${label} é obrigatório.`);
  return s;
};
const fields=(obj,allowed)=>{
  if(!obj||typeof obj!=='object'||Array.isArray(obj))fail(422,'Objeto inválido.');
  const keys=Object.keys(obj).filter(k=>!['createdAt','updatedAt','reviewedAt','ownerUid'].includes(k));
  if(keys.some(k=>!allowed.includes(k)))fail(422,'Campo não permitido nesta operação.');
  return Object.fromEntries(keys.map(k=>[k,obj[k]]));
};
const numberIn=(n,min,max,label,integer=false)=>{
  if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))fail(422,`${label} inválido.`);
  return n;
};
const boolean=(v,label)=>{if(typeof v!=='boolean')fail(422,`${label} inválido.`);return v;};
const image=(v,label)=>{
  const s=safeString(v,190000,label);
  if(s&&!/^data:image\/(?:webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(s))fail(422,`${label} deve ser WebP/JPEG Base64.`);
  return s;
};
export const restaurantFields=['name','tagline','whatsapp','instagram','instagramName','instagramBio','niche','address','cover','logo','coverX','coverY','whatsappIntro','menuPalette','menuFontGroup','menuFont','menuCategoryGroups','menuTemplateId','productDetailTemplateId','promotionsEnabled','promotions'];
const strings={name:90,tagline:250,whatsapp:13,instagram:50,instagramName:90,instagramBio:250,niche:80,address:240,whatsappIntro:400,menuFont:40,menuPalette:30,menuFontGroup:30,menuTemplateId:50,productDetailTemplateId:50};
export function validateRestaurantPatch(input){
  const o=fields(input,restaurantFields);
  for(const [k,v] of Object.entries(o)){
    if(k in strings)o[k]=safeString(v,strings[k],k);
    else if(['cover','logo'].includes(k))o[k]=image(v,k);
    else if(['coverX','coverY'].includes(k))o[k]=numberIn(v,0,100,k);
    else if(['menuCategoryGroups','promotionsEnabled'].includes(k))o[k]=boolean(v,k);
    else if(k==='promotions'){
      if(!Array.isArray(v)||v.length>5)fail(422,'Máximo de cinco promoções.');
      o[k]=v.map(p=>({title:requiredString(p?.title,90,'Título'),detail:safeString(p?.detail??'',180,'Descrição')}));
    }
  }
  if('name' in o&&!o.name)fail(422,'Nome do estabelecimento obrigatório.');
  if('whatsapp' in o && o.whatsapp&&!/^55\d{10,11}$/.test(o.whatsapp))fail(422,'WhatsApp deve começar por 55 e conter DDD e número.');
  const allowedEnums={menuPalette:['oliva','areia','terracota','oceano','grafite'],menuFontGroup:['luxuoso','moderno','descontraido','editorial','compacto'],menuTemplateId:['grid-classico'],productDetailTemplateId:['detail-classico']};
  for(const [key,valid] of Object.entries(allowedEnums))if(key in o&&!valid.includes(o[key]))fail(422,`Opção ${key} inválida.`);
  return o;
}
export const productFields=['name','description','cat','price','kcal','diameter','roughness','ingredients','emoji','prompt','photo','referencePhotos','active','stock','modelId','stockRevision'];
export function validateProductPatch(input,{creating=false}={}){
  const o=fields(input,productFields);
  for(const [k,v] of Object.entries(o)){
    if(['name','description','cat','emoji','prompt','modelId'].includes(k))o[k]=safeString(v,({name:120,description:1200,cat:70,emoji:10,prompt:200,modelId:128})[k],k);
    else if(k==='price')o[k]=Math.round(numberIn(v,0,100000,k)*100)/100;
    else if(k==='kcal')o[k]=numberIn(v,0,100000,k,true);
    else if(k==='diameter')o[k]=numberIn(v,0.05,2,k);
    else if(k==='roughness')o[k]=numberIn(v,0,1,k);
    else if(k==='active')o[k]=boolean(v,k);
    else if(k==='stock')o[k]=v===null?null:numberIn(v,0,1000000,k,true);
    else if(k==='stockRevision')o[k]=numberIn(v,0,100000000,k,true);
    else if(k==='photo')o[k]=image(v,'Foto principal');
    else if(k==='referencePhotos'){
      if(!Array.isArray(v)||v.length>5)fail(422,'No máximo cinco fotografias de referência.');
      o[k]=v.map(x=>image(x,'Foto de referência'));
    }else if(k==='ingredients'){
      if(!Array.isArray(v)||v.length>25)fail(422,'Ingredientes inválidos.');
      o[k]=v.map(x=>safeString(x,90,'Ingrediente')).filter(Boolean);
    }
  }
  if(creating){
    if(!o.name)fail(422,'Nome obrigatório.');
    if(!Number.isFinite(o.price))fail(422,'Preço obrigatório.');
    if(typeof o.active!=='boolean')fail(422,'Informe se o produto está ativo.');
  }
  return o;
}
export function validateOrderInput(input){
  if(!input||typeof input!=='object')fail(422,'Pedido inválido.');
  if(!segment(input.restaurantId))fail(422,'Estabelecimento inválido.');
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>25)fail(422,'Carrinho deve conter entre 1 e 25 itens.');
  const items=input.items.map(p=>{
    if(!segment(p?.productId))fail(422,'Produto inválido.');
    return {productId:p.productId,quantity:numberIn(p.quantity,1,50,'Quantidade',true)};
  });
  if(new Set(items.map(x=>x.productId)).size!==items.length)fail(422,'Não repita produtos no pedido.');
  const customerName=safeString(input.customerName||'',70,'Nome do cliente');
  const notes=safeString(input.notes||'',300,'Observações');
  if(!/^[a-f0-9-]{32,36}$/i.test(input.requestId||''))fail(422,'Identificador do pedido inválido.');
  return {restaurantId:input.restaurantId,items,customerName,notes,requestId:input.requestId};
}
export function validateWebhookUrl(value){
  if(typeof value!=='string'||value.length>500)fail(422,'URL inválida.');
  if(!value.trim())return '';
  let u;
  try{u=new URL(value.trim());}catch{fail(422,'URL inválida.');}
  if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port||!u.hostname.includes('.')||u.hostname==='localhost'||/\b(?:localhost|local|internal)\b/i.test(u.hostname)||/^\d+(?:\.\d+){3}$/.test(u.hostname)||u.hostname.includes(':'))fail(422,'Use somente URL HTTPS pública, sem IP ou credenciais.');
  return u.href;
}
export function buildPublicMenu(rid,restaurant={},models={},productsOverride){
  const products=productsOverride || restaurant.products || {};
  const publicProducts={};
  for(const [id,p] of Object.entries(products)){
    if(p?.active===false)continue;
    const m=models[p.modelId];
    publicProducts[id]={
      name:p.name||'',description:p.description||'',cat:p.cat||'Outros',price:Number(p.price||0),
      kcal:Number(p.kcal||0),diameter:Number(p.diameter||0.22),roughness:Number(p.roughness||0.76),
      ingredients:Array.isArray(p.ingredients)?p.ingredients:[],emoji:p.emoji||'🍽️',prompt:p.prompt||'',
      photo:p.photo||'',active:p.active!==false,stock:Number.isInteger(p.stock)?p.stock:null,
      url:m?.active===true&&typeof m.url==='string'?m.url:''
    };
  }
  const publicFields=['name','tagline','whatsapp','instagram','instagramName','instagramBio','niche','address','cover','logo','coverX','coverY','whatsappIntro','menuPalette','menuFontGroup','menuFont','menuCategoryGroups','menuTemplateId','productDetailTemplateId','promotionsEnabled','promotions'];
  const result={rid,published:restaurant.published===true,slug:restaurant.slug||'',products:publicProducts};
  for(const key of publicFields)if(restaurant[key]!==undefined)result[key]=restaurant[key];
  return result;
}
export function calculateOfficialOrder(items,catalog){
  let totalCents=0;
  const result=items.map(row=>{
    const p=catalog[row.productId];
    if(!p||p.active===false)fail(409,'Um produto do pedido não está disponível.');
    if(p.stockMode==='limited' && (!Number.isInteger(p.stock)||p.stock<row.quantity))fail(409,`Estoque insuficiente para ${p.name}.`);
    const cents=Math.round(numberIn(p.price,0,100000,'Preço oficial')*100);
    totalCents+=cents*row.quantity;
    return {productId:row.productId,name:p.name,quantity:row.quantity,price:cents/100,subtotalCents:cents*row.quantity};
  });
  if(totalCents>100000000)fail(422,'Total excede o limite permitido.');
  return {items:result,totalCents,total:totalCents/100};
}
