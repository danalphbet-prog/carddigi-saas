import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SavorMenu } from './SavorMenu.jsx';
import { StudioPanel } from './StudioPanel.jsx';
import { MarketingLanding, AuthPage } from './Marketing.jsx';
import {
  configured, auth, db, store, loginGoogle, uploadMedia,
  signOut, onAuthStateChanged,
  now, restaurantDoc, productDoc, productCollection, requestCollection, atomicUpdate,
} from './firebase.js';

import { MAX_REFERENCE_PHOTOS, MAX_BASE64_CHARS } from './media.js';
import { errText } from './errors.js';
import { makePublicSlug, publicMenuPath } from './slug.js';
import { shouldRedirectToBusiness } from './authRoutes.js';
import { createOrderIntent } from './orders.js';
import { trackVisit, trackEvent, installErrorReporting } from './telemetry.js';
import './platform.css';
import './account.css';

const {collection, doc, query, where, addDoc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot} = store;
const BRL = (v) => Number(v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const blank = {name: '', description: '', cat: 'Pratos', price: 0, kcal: 0, diameter: .22, roughness: .76, ingredients: '', stock: null, emoji: '🍽️', prompt: 'Gostaria de adicionar ao pedido?', photo: '', referencePhotos: [], active: true};
const cleanHandle = (v) => (v || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '');
const slug = (v) => String(v || '').trim();

function navigate(to, replace = false) { window.history[replace ? 'replaceState' : 'pushState'](null, '', to); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0); }
function A({href, children, ...props}) { return <a href={href} {...props} onClick={(e) => {props.onClick?.(e); if(!e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey){e.preventDefault();navigate(href);}}}>{children}</a>; }
function Busy({children = 'Carregando…'}) { return <div className="platform-page"><div className="panel-state">{children}</div></div>; }
function Notice({error, ok}) { return <>{error && <p className="p-error" role="alert">{error}</p>}{ok && <p className="p-success" role="status">{ok}</p>}</>; }

function useLive(path, filter) {
  const [data, setData] = useState([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!db || !path) {setLoaded(true);return;}
    setLoaded(false);
    const ref = collection(db, path);
    const source = filter ? query(ref, where(filter[0], filter[1], filter[2])) : ref;
    return onSnapshot(source, s => {setData(s.docs.map(x => ({id:x.id, ...x.data()})));setError('');setLoaded(true);}, e => {setError(errText(e));setLoaded(true);});
  }, [path, JSON.stringify(filter)]);
  return [data, error, loaded];
}
function useRestaurant(rid) {
  const [restaurant, setRestaurant] = useState(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    if (!db || !rid) {setState('error');return;}
    setState('loading');
    return onSnapshot(restaurantDoc(rid), s => { setRestaurant(s.exists() ? {id:s.id,...s.data()} : null);setState(s.exists() ? 'ok' : 'missing');}, e => setState(errText(e)));
  }, [rid]);
  return [restaurant, state];
}
function useProducts(rid, forConsumer = false) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!db || !rid) {setLoaded(true);return;}
    setLoaded(false);
    const base = productCollection(rid);
    const source = forConsumer ? query(base, where('active','==',true)) : base;
    return onSnapshot(source, s => {setItems(s.docs.map(x => ({id:x.id,...x.data()})));setError('');setLoaded(true);}, e => {setError(errText(e));setLoaded(true);});
  }, [rid, forConsumer]);
  return [items, error, loaded];
}
function SiteHeader({user, brand}) {return <header className="site-header"><A href="/" className="brand"><span className="brand-mark">◉</span> {brand}</A><nav><A href="/painel">Meus restaurantes</A>{user ? <A href="/painel" className="nav-action">Painel</A> : <A href="/entrar" className="nav-action">Entrar</A>}</nav></header>;}
function useResolvedRestaurant(handle) {
  const [resolved,setResolved]=useState({rid:null,loading:true});
  useEffect(()=>{
    if(!handle || !db){setResolved({rid:null,loading:false});return;}
    let alive=true;
    setResolved({rid:null,loading:true});
    // Slugs novos vêm do índice público. IDs antigos continuam acessíveis para não quebrar links já enviados.
    getDoc(doc(db,'slugIndex',handle)).then(s=>{
      if(alive)setResolved({rid:s.exists()?s.data():handle,loading:false});
    }).catch(()=>{if(alive)setResolved({rid:handle,loading:false});});
    return()=>{alive=false;};
  },[handle]);
  return resolved;
}
class MenuErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={failed:false};}
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error){void trackEvent(this.props.rid,'error',error?.message||'Erro ao exibir o cardápio');}
  render(){return this.state.failed?<Busy>Não foi possível abrir este cardápio agora. Atualize a página e tente novamente.</Busy>:this.props.children;}
}
function decodeMenuHandle(path){
  try{
    const value=decodeURIComponent(path.slice('/menu/'.length));
    return /^[A-Za-z0-9_-]{1,120}$/.test(value)?value:'';
  }catch{return '';}
}
function Consumer({handle}) {
  const resolved=useResolvedRestaurant(handle);
  const rid=resolved.rid;
  const [r, state]=useRestaurant(rid);
  const [prods,error,productsLoaded]=useProducts(rid,true);
  const [models,,modelsLoaded]=useLive('modelCatalog');
  const onMenuEvent=React.useCallback((type,message)=>trackEvent(rid,type,message),[rid]);
  const onOrder=React.useCallback((order)=>createOrderIntent(rid,order),[rid]);
  useEffect(()=>{
    if(resolved.loading||state!=='ok'||!r?.published)return;
    trackVisit(rid);
    const unlisten=installErrorReporting(rid);
    const onHide=()=>{void trackEvent(rid,'exit')};
    window.addEventListener('pagehide',onHide);
    return()=>{unlisten();window.removeEventListener('pagehide',onHide)};
  },[rid,resolved.loading,state,r?.published]);
  useEffect(()=>{if(rid&&error)void trackEvent(rid,'error',error)},[error,rid]);
  // Mostra o aplicativo apenas depois de resolver estabelecimento, produtos e catálogo 3D.
  // Erros e cardápios inexistentes também encerram o splash para exibir a mensagem apropriada.
  useEffect(()=>{
    if (configured && (resolved.loading || state==='loading' || (state==='ok' && r?.published && (!productsLoaded || !modelsLoaded)))) return;
    // Espera também a capa do hero decodificar (ou até 3,5 s), evitando exibir metade da imagem.
    let alive=true;
    let timeout;
    const reveal=()=>{if(alive)window.dispatchEvent(new Event('mezzira:ready'));};
    if (!r?.published || !r?.cover) {reveal();return;}
    const image=new Image();
    image.onload=reveal;
    image.onerror=reveal;
    timeout=window.setTimeout(reveal,3500);
    image.src=r.cover;
    return()=>{alive=false;clearTimeout(timeout);image.onload=null;image.onerror=null;};
  },[resolved.loading,state,r?.published,r?.cover,productsLoaded,modelsLoaded]);
  if(!configured)return <Busy>Não foi possível carregar o cardápio no momento.</Busy>;
  if(resolved.loading||state==='loading'||(state==='ok'&&r?.published&&(!productsLoaded||!modelsLoaded)))return <Busy>Abrindo cardápio…</Busy>;
  if(!r||!r.published)return <Busy>Este cardápio não está publicado ou não existe.</Busy>;
  const mapped=prods.map(p=>({...p,url:models.find(m=>m.id===p.modelId&&m.active)?.url||'',photo:p.photo||'',ingredients:Array.isArray(p.ingredients)?p.ingredients:[],cat:p.cat||'Outros',price:Number(p.price||0),diameter:Number(p.diameter||.2),kcal:Number(p.kcal||0)}));
  const cats=['Todos',...new Set(mapped.map(p=>p.cat))];
  return <MenuErrorBoundary key={rid} rid={rid}>{error&&<Notice error={error}/>}<SavorMenu restaurant={r} products={mapped} categories={cats} onEvent={onMenuEvent} onOrder={onOrder}/></MenuErrorBoundary>;
}

function ProductEditor({rid, product, onClose}) {
  const [models] = useLive('modelCatalog');
  const [fields, setFields] = useState(() => ({...blank,...product, ingredients:Array.isArray(product?.ingredients) ? product.ingredients.join('\n') : blank.ingredients, referencePhotos:product?.referencePhotos || []}));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [ok, setOk] = useState('');
  const set = (key,value) => setFields(f=>({...f,[key]:value}));
  const upload = async (files, isReference = false) => {
    if (!files?.length) return;
    setBusy(true);setError('');
    try {
      const images = [];
      for (const file of Array.from(files).slice(0, isReference ? MAX_REFERENCE_PHOTOS : 1)) images.push((await uploadMedia(rid,file)).url);
      if(isReference) setFields(f=>({...f,referencePhotos:[...f.referencePhotos,...images].slice(0,MAX_REFERENCE_PHOTOS)})); else set('photo',images[0]);
      setOk('Foto preparada com sucesso! Toque em Salvar produto para concluir.');
    } catch(e){setError(errText(e));}finally{setBusy(false);}
  };
  const save = async(e) => {
    e.preventDefault();setBusy(true);setError('');setOk('');
    try {
      if (fields.photo && fields.photo.length > MAX_BASE64_CHARS) throw Error('A foto é muito grande. Tente outra imagem.');
      if (fields.referencePhotos.some(url=>url?.length > MAX_BASE64_CHARS)) throw Error('Uma das fotos enviadas é muito grande. Tente outra imagem.');
      if(!fields.name.trim()) throw Error('Informe o nome do produto.');
      const price=Number(fields.price), diameter=Number(fields.diameter);
      if (!Number.isFinite(price) || price < 0 || price > 100000) throw Error('Preço inválido.');
      if (!Number.isFinite(diameter) || diameter < .05 || diameter > 2) throw Error('Diâmetro precisa estar entre 0,05 e 2 metros.');
      const obj = {name:fields.name.trim().slice(0,120),description:fields.description.trim().slice(0,1200),cat:slug(fields.cat).slice(0,70)||'Outros',price,kcal:Math.max(0,Number(fields.kcal)||0),diameter,roughness:Math.min(1,Math.max(0,Number(fields.roughness)||.75)), ingredients:fields.ingredients.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,25),emoji:fields.emoji.trim().slice(0,10),prompt:fields.prompt.trim().slice(0,200),photo:fields.photo||'',referencePhotos:fields.referencePhotos.slice(0,MAX_REFERENCE_PHOTOS),active:!!fields.active,...(fields.stock!==null&&fields.stock!==''?{stock:Math.max(0,Math.floor(Number(fields.stock)||0))}:{}),modelId:fields.modelId || '',updatedAt:now()};
      if(product?.id) await updateDoc(productDoc(rid, product.id), obj);
      else await addDoc(productCollection(rid), {...obj,modelStatus:'none',createdAt:now()});
      onClose();
    } catch(e){setError(errText(e));}finally{setBusy(false);}
  };
  return <div className="modal-back" onClick={onClose}><section className="p-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><h2>{product ? 'Editar produto' : 'Adicionar produto'}</h2><button onClick={onClose} aria-label="Fechar">✕</button></div><form onSubmit={save} className="form-grid">
    <label>Nome do item<input required maxLength={120} value={fields.name} onChange={e=>set('name',e.target.value)} /></label><label>Categoria<input required value={fields.cat} onChange={e=>set('cat',e.target.value)}/></label>
    <label className="span-2">Descrição<textarea rows={3} value={fields.description} onChange={e=>set('description',e.target.value)} /></label>
    <label>Preço (R$)<input type="number" min="0" max="100000" step="0.01" value={fields.price} onChange={e=>set('price',e.target.value)}/></label><label>Estoque (opcional)<input type="number" min="0" step="1" placeholder="Não controlado" value={fields.stock??''} onChange={e=>set('stock',e.target.value)}/></label><label>Calorias<input type="number" min="0" value={fields.kcal} onChange={e=>set('kcal',e.target.value)}/></label>
    <label>Diâmetro real estimado (metros)<input type="number" min="0.05" max="2" step="0.01" value={fields.diameter} onChange={e=>set('diameter',e.target.value)}/></label><label>Emoji do prato<input maxLength={10} value={fields.emoji} onChange={e=>set('emoji',e.target.value)}/></label>
    <label className="span-2">Ingredientes (um por linha)<textarea rows={3} value={fields.ingredients} onChange={e=>set('ingredients',e.target.value)}/></label>
    <label className="span-2">Mensagem de convite em AR<input maxLength={200} value={fields.prompt} onChange={e=>set('prompt',e.target.value)}/></label>
    <label>Foto principal do produto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload(e.target.files)}/></label><label>Fotos para solicitar modelo 3D (até 5)<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>upload(e.target.files, true)}/></label>
    {fields.photo && <img className="preview-pic" src={fields.photo} alt="Foto principal"/>}{fields.referencePhotos.length>0 && <div className="ref-photos">{fields.referencePhotos.map((url,i)=><div key={url}><img src={url} alt={`Referência ${i+1}`}/><button type="button" onClick={()=>set('referencePhotos',fields.referencePhotos.filter(x=>x!==url))}>Remover</button></div>)}</div>}
    <label className="span-2">Modelo 3D disponível no catálogo<select value={fields.modelId||''} onChange={e=>set('modelId',e.target.value)}><option value="">Nenhum modelo — solicitar produção</option>{models.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.name} · {m.category||'Geral'}</option>)}</select></label>
    <label className="checkbox-line span-2"><input type="checkbox" checked={fields.active} onChange={e=>set('active',e.target.checked)}/> Disponível no cardápio</label>
    {product?.modelStatus && product.modelStatus!=='none' && <p className="subtle span-2">Modelo 3D: {product.modelStatus==='delivered'?'entregue':'em produção'}.</p>}
    <div className="span-2"><Notice error={error} ok={ok}/><button disabled={busy} className="p-btn p-primary" type="submit">{busy?'Processando…':'Salvar produto'}</button></div>
  </form></section></div>;
}
function RestaurantSettings({r,mode='all'}) {
  const [f,setF] = useState(()=>({...r}));
  const [drag,setDrag]=useState(null);
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [ok,setOk]=useState('');
  useEffect(()=>setF({...r}),[r?.id]);
  const save = async(e) => { e.preventDefault();setBusy(true);setError('');setOk('');try {
    const whatsapp = f.whatsapp.replace(/\D/g,'');
    if (whatsapp && !/^55\d{10,11}$/.test(whatsapp)) throw Error('WhatsApp precisa ter DDI 55 + DDD + número. Ex.: 5511999999999.');
    
    await updateDoc(restaurantDoc(r.id),{name:f.name.trim().slice(0,90),tagline:f.tagline.trim().slice(0,250),whatsapp, instagram:cleanHandle(f.instagram),instagramName:f.instagramName.trim().slice(0,90),instagramBio:f.instagramBio.trim().slice(0,250),niche:(f.niche||'').trim().slice(0,80),address:(f.address||'').trim().slice(0,240),cover:f.cover || '',logo:f.logo || '',coverX:Math.max(0,Math.min(100,Number(f.coverX??50))),coverY:Math.max(0,Math.min(100,Number(f.coverY??50))),whatsappIntro:String(f.whatsappIntro||'').trim().slice(0,400),updatedAt:now()});
    setOk('Configurações salvas.');
  }catch(e){setError(errText(e));}finally{setBusy(false);}};
  const cover = async (file, field='cover')=>{if(!file)return;setBusy(true);setError('');try{const {url} = await uploadMedia(r.id,file);setF(v=>({...v,[field]:url}));setOk('Foto pronta! Toque em Salvar estabelecimento para concluir.');}catch(e){setError(errText(e));}finally{setBusy(false);}};
  return <form className="panel p-form" onSubmit={save}><h2>{mode==='contacts'?'Contatos e redes sociais':'Dados do estabelecimento'}</h2><div className="form-grid">
    {mode!=='contacts'&&<><label>Nome do restaurante<input required value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></label></>}
    {mode!=='establishment'&&<><label>WhatsApp com DDI (55)<input required placeholder="5511999999999" value={f.whatsapp||''} onChange={e=>setF({...f,whatsapp:e.target.value})}/></label></>}
    {mode!=='contacts'&&<><label>Nicho / tipo do estabelecimento<input maxLength={80} placeholder="Hamburgueria, pizzaria, cafeteria…" value={f.niche||''} onChange={e=>setF({...f,niche:e.target.value})}/></label><label>Endereço (opcional)<input maxLength={240} value={f.address||''} onChange={e=>setF({...f,address:e.target.value})}/></label>
    <label className="span-2">Descrição do restaurante<textarea rows={2} value={f.tagline||''} onChange={e=>setF({...f,tagline:e.target.value})}/></label></>}
    {mode!=='establishment'&&<><label>Instagram (@ sem URL)<input value={f.instagram||''} placeholder="meurestaurante" onChange={e=>setF({...f,instagram:e.target.value})}/></label><label>Nome no card do Instagram<input value={f.instagramName||''} onChange={e=>setF({...f,instagramName:e.target.value})}/></label>
    <label className="span-2">Bio do card Instagram<textarea rows={2} value={f.instagramBio||''} onChange={e=>setF({...f,instagramBio:e.target.value})}/></label></>}
    {mode!=='contacts'&&<><label>Foto da capa<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>cover(e.target.files[0])}/></label><label>Logotipo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>cover(e.target.files[0],'logo')}/></label>
    {f.logo && <img className="preview-pic" alt="Logotipo" src={f.logo}/>}
    {f.cover&&<div className="span-2 cover-position-editor"><strong>Enquadramento da capa</strong><p>Arraste a imagem para centralizar o trecho importante. A capa sempre preencherá o hero, sem bordas.</p><div className="cover-drag-preview" role="img" aria-label="Prévia interativa de enquadramento" style={{backgroundImage:`linear-gradient(#1112,#1116),url(${f.cover})`,backgroundPosition:`${f.coverX??50}% ${f.coverY??50}%`}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setDrag({x:e.clientX,y:e.clientY,px:Number(f.coverX??50),py:Number(f.coverY??50)});}} onPointerMove={e=>{if(!drag)return;const box=e.currentTarget.getBoundingClientRect();setF(v=>({...v,coverX:Math.max(0,Math.min(100,Math.round(drag.px-(e.clientX-drag.x)*100/Math.max(box.width,1)))),coverY:Math.max(0,Math.min(100,Math.round(drag.py-(e.clientY-drag.y)*100/Math.max(box.height,1))))}));}} onPointerUp={()=>setDrag(null)} onPointerCancel={()=>setDrag(null)}><span>Arraste para reposicionar</span></div><div className="cover-ranges"><label>Horizontal ({f.coverX??50}%)<input type="range" min="0" max="100" value={f.coverX??50} onChange={e=>setF({...f,coverX:Number(e.target.value)})}/></label><label>Vertical ({f.coverY??50}%)<input type="range" min="0" max="100" value={f.coverY??50} onChange={e=>setF({...f,coverY:Number(e.target.value)})}/></label></div></div>}
    {mode!=='contacts'&&<label className="span-2">Mensagem de apresentação do pedido no WhatsApp<textarea rows={3} maxLength={400} value={f.whatsappIntro||''} placeholder="Olá! Quero confirmar meu pedido." onChange={e=>setF({...f,whatsappIntro:e.target.value})}/><small>Essa mensagem é acrescentada ao pedido, que mantém itens, valores e total.</small></label>}
    <p className="subtle span-2">A fonte e a paleta agora são escolhidas na aba Aparência (5 combinações de contraste).</p></>}
    <p className="subtle span-2">A publicação do cardápio é aprovada pela equipe. Para solicitar a publicação, use o botão no topo do painel.</p>
  </div><Notice error={error} ok={ok}/><button className="p-btn p-primary" disabled={busy}>{busy?'Salvando…':'Salvar estabelecimento'}</button></form>;
}
function RestaurantOrders({rid}) {
  const [orders,error]=useLive(`orders/${rid}`);
  const [search,setSearch]=useState('');
  const [notice,setNotice]=useState(''),[busy,setBusy]=useState('');
  const statuses={initiated:'Aguardando confirmação',confirmed:'Confirmado',preparing:'Em preparo',completed:'Concluído',cancelled:'Cancelado'};
  const change=async(order,status)=>{
    setBusy(order.id);setNotice('');
    try {await updateDoc(doc(db,'orders',rid,order.id),{status,updatedAt:now()});setNotice('Situação do pré-pedido atualizada.');}
    catch(e){setNotice(errText(e));}finally{setBusy('');}
  };
  return <section className="panel"><h2>Pré-pedidos do cardápio</h2><p className="subtle">Os registros abaixo são criados quando o visitante toca em “Fazer pedido no WhatsApp”. A confirmação, o pagamento e o envio da mensagem precisam ser conferidos com o cliente.</p><Notice error={error} ok={notice}/><input aria-label="Pesquisar pedidos" placeholder="Buscar cliente, número ou observação..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:480,marginBottom:12}}/>
    {orders.length?<div className="orders-list">{orders.filter(o=>[o.code,o.customerName,o.notes].join(' ').toLowerCase().includes(search.toLowerCase())).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,100).map(o=><article className="order-card" key={o.id}><div className="order-head"><strong>#{o.code||o.id.slice(-6).toUpperCase()}</strong><span>{o.createdAt?new Date(o.createdAt).toLocaleString('pt-BR'):'Agora'}</span></div><h3>{o.customerName||'Cliente não identificado'}</h3><ul>{(Array.isArray(o.items)?o.items:Object.values(o.items||{})).map((item,i)=><li key={i}>{item.quantity} × {item.name} — {BRL(item.price*item.quantity)}</li>)}</ul><p>{o.notes||'Sem observações'}</p><div className="order-foot"><strong>{BRL(o.total)}</strong><label>Etapa<select disabled={busy===o.id} value={o.status||'initiated'} onChange={e=>change(o,e.target.value)}>{Object.entries(statuses).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label></div></article>)}</div>:<p className="empty">Nenhum pré-pedido registrado.</p>}
  </section>;
}
function RestaurantPanel({rid,user,admin}) {
  const [r,status]=useRestaurant(rid), [products,error]=useProducts(rid);
  const [requests,reqError]=useLive('modelRequests', ['ownerUid','==',user.uid]);
  const [models] = useLive('modelCatalog');
  const [pubRequests,pubError]=useLive('publicationRequests', ['ownerUid','==',user.uid]);
  const [tab,setTab]=useState('items'), [editing,setEditing]=useState(undefined);
  const [notice,setNotice]=useState(''), [busy,setBusy]=useState(false);
  if(status==='loading') return <Busy/>;
  if(!r || (r.ownerUid!==user.uid && !admin)) return <Busy>Restaurante não encontrado ou sem permissão.</Busy>;
  const myRequests=requests.filter(q=>q.restaurantId===rid);
  const askModel=async(p)=>{
    if(!p.photo && !p.referencePhotos?.length){setNotice('Envie pelo menos uma foto ao produto antes de solicitar o modelo.');return;}
    if(myRequests.some(q=>q.productId===p.id && ['pending','in_progress'].includes(q.status))) {setNotice('Já existe uma solicitação aberta para este produto.');return;}
    if(!window.confirm(`Solicitar modelo 3D de "${p.name}"? Prazo de referência: até 7 dias.`))return;
    setBusy(true);setNotice('');try {
      await addDoc(requestCollection(),{restaurantId:rid,ownerUid:r.ownerUid,productId:p.id,productName:p.name,note:'Produção de modelo AR a partir das fotos de referência anexadas ao produto.',status:'pending',createdAt:now(),updatedAt:now()});
      setNotice('Solicitação recebida! Nossa equipe analisará as fotos. Prazo previsto: até 7 dias.');
    }catch(e){setNotice(errText(e));}finally{setBusy(false);}
  };
  const remove=async(p)=>{if(!window.confirm(`Excluir permanentemente "${p.name}" do cardápio?`))return;try{await deleteDoc(productDoc(rid,p.id));}catch(e){setNotice(errText(e));}};
  const pendingPub=pubRequests.find(q=>q.restaurantId===rid && q.status==='pending');
  const lastPub=pubRequests.filter(q=>q.restaurantId===rid).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0];
  const url=r.published && publicMenuPath(r)?`${location.origin}${publicMenuPath(r)}`:null;
  const requestPublish=async()=>{
    setNotice('');
    if(pendingPub)return setNotice('Já existe uma solicitação de publicação aguardando análise.');
    if(!/^55\d{10,11}$/.test(String(r.whatsapp||'')))return setNotice('Configure e salve o WhatsApp do estabelecimento antes de solicitar a publicação.');
    if(!products.some(p=>p.active))return setNotice('Cadastre e ative pelo menos um produto antes de solicitar a publicação.');
    if(!window.confirm(`Enviar o cardápio de "${r.name}" para análise e publicação?`))return;
    setBusy(true);
    try{
      await addDoc(collection(db,'publicationRequests'),{restaurantId:rid,ownerUid:r.ownerUid,restaurantName:r.name,status:'pending',createdAt:now(),updatedAt:now()});
      setNotice('Solicitação enviada. A equipe avaliará seu cardápio antes de liberar o link público.');
    }catch(e){setNotice(errText(e));}finally{setBusy(false);}
  };
  return <><StudioPanel
     r={r} user={user} admin={admin} products={products} models={models} myRequests={myRequests}
     pendingPub={pendingPub} lastPub={lastPub} url={url} notice={notice}
     errProduct={error} errRequests={reqError} errPublication={pubError} busy={busy}
     requestPublish={requestPublish} onAdd={()=>setEditing(null)} onEdit={setEditing}
     onRemove={remove} onRequestModel={askModel}
     renderSettings={section=> <RestaurantSettings r={r} mode={section}/>}
     renderOrders={()=> <RestaurantOrders rid={rid}/>}
     onGo={navigate}
   />{editing!==undefined&&<div className="platform-page"><ProductEditor rid={rid} product={editing} onClose={()=>setEditing(undefined)}/></div>}</>;
}
function Overview({user,admin}) {
  const [restaurants,error]=useLive('restaurants',['ownerUid','==',user.uid]);
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const create=async(e)=>{e.preventDefault();if(!name.trim())return;setBusy(true);setNotice('');try{
    const d=await addDoc(collection(db,'restaurants'),{ownerUid:user.uid,name:name.trim().slice(0,90),tagline:'Conheça nosso cardápio em 3D.',whatsapp:'',instagram:'',instagramName:'',instagramBio:'',niche:'',address:'',cover:'',logo:'',accentColor:'#667843',slug:'',publicationStatus:'draft',published:false,createdAt:now(),updatedAt:now()});navigate(`/painel/restaurante/${d.id}`);
  }catch(e){setNotice(errText(e));}finally{setBusy(false);}};
  return <div className="platform-page account-home"><div className="account-head"><button className="account-logo" onClick={()=>navigate('/painel')}><span>◉</span> Mezzira Studio</button><button className="account-logout" onClick={async()=>{await signOut(auth);navigate('/',true)}}>Sair da conta →</button></div><main className="account-container"><div className="account-heading"><span>ÁREA DO ESTABELECIMENTO</span><h1>Olá, {user.displayName?.split(' ')[0]||user.email?.split('@')[0]||'bem-vindo'}.</h1><p>Seu espaço para criar e gerenciar experiências gastronômicas.</p></div><div className="account-kpi"><div><strong>{restaurants.length}</strong><span>Estabelecimentos</span></div><div><strong>{restaurants.filter(x=>x.published).length}</strong><span>Cardápios publicados</span></div><div><strong>{restaurants.filter(x=>!x.published).length}</strong><span>Em preparação</span></div></div><div className="account-list-head"><div><h2>Seus estabelecimentos</h2><p>Escolha um restaurante para continuar o gerenciamento.</p></div></div><Notice error={error}/><div className="account-grid">{restaurants.filter(r=>r.ownerUid===user.uid).map(r=><button className="account-restaurant" key={r.id} onClick={()=>navigate(`/painel/restaurante/${r.id}`)}><div className="account-cover">{r.cover?<img src={r.cover} alt=""/>:<span>🍽️</span>}</div><div className="account-restaurant-info"><div><b>{r.name}</b><span>{r.published?'● Publicado':'◌ Em preparação'}</span></div><p>{r.niche||'Estabelecimento gastronômico'}</p><small>Gerenciar cardápio →</small></div></button>)}</div>{!restaurants.some(r=>r.ownerUid===user.uid)&&<div className="account-empty">Você ainda não cadastrou nenhum estabelecimento. Comece criando o primeiro.</div>}<form className="account-create" onSubmit={create}><div><span>NOVO ESTABELECIMENTO</span><h2>Vamos criar algo especial?</h2><p>Comece pelo nome. Depois você poderá adicionar fotos, produtos, preços e personalizar o cardápio.</p></div><div><label htmlFor="account-business-name">Nome do estabelecimento</label><input id="account-business-name" required maxLength={90} placeholder="Ex.: Pizzaria da Praça" value={name} onChange={e=>setName(e.target.value)}/><button disabled={busy}>{busy?'Criando...':'Criar estabelecimento →'}</button></div><Notice error={notice}/></form></main></div>;
}
function PlatformEditor({site}) {
  const [f,setF]=useState({...site}),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>setF({...site}),[JSON.stringify(site)]);
  const save=async(e)=>{e.preventDefault();setBusy(true);setNotice('');try{await setDoc(doc(db,'settings','site'),{name:(f.name||'').slice(0,60),headline:(f.headline||'').slice(0,180),description:(f.description||'').slice(0,600)},{merge:true});setNotice('Site atualizado.');}catch(e){setNotice(errText(e));}finally{setBusy(false);}};
  return <form className="panel p-form" onSubmit={save}><h2>Aparência e apresentação do SaaS</h2><label>Marca<input value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Chamada principal<input value={f.headline||''} onChange={e=>setF({...f,headline:e.target.value})}/></label><label>Descrição<textarea rows={3} value={f.description||''} onChange={e=>setF({...f,description:e.target.value})}/></label><Notice ok={notice}/><button className="p-btn p-primary" disabled={busy}>Salvar apresentação</button></form>;
}
function AdminRequestCard({q, restaurant, busy, act}) {
  const [product,setProduct] = useState(null);
  useEffect(()=>onSnapshot(productDoc(q.restaurantId,q.productId),snap=>setProduct(snap.exists()?snap.data():null),()=>setProduct(null)),[q.restaurantId,q.productId]);
  const images = [product?.photo,...(product?.referencePhotos||[])].filter(Boolean);
  return <div className="admin-request"><div className="admin-request-info"><strong>{q.productName}</strong><small>{restaurant?.name || q.restaurantId}</small>
    <small>Solicitado: {q.createdAt ? new Date(q.createdAt).toLocaleDateString('pt-BR') : 'hoje'} · Prazo de referência: +7 dias</small>
    <span className="status-tag">{{pending:'Recebido',in_progress:'Em produção',delivered:'Entregue',rejected:'Revisão necessária'}[q.status]||q.status}</span>
    {product?.description && <p className="request-desc">{product.description}</p>}
    {images.length>0 && <div className="request-images">{images.map((url,i)=><a key={url+i} href={url} target="_blank" rel="noopener noreferrer" title="Abrir fotografia de referência"><img src={url} alt={`Foto de referência ${i+1} de ${q.productName}`}/></a>)}</div>}
    {!product && <small>O produto foi excluído ou não está disponível.</small>}
  </div><div className="admin-actions"><button disabled={!!busy || !product} onClick={()=>act(q,'in_progress')}>Em produção</button>
    <button disabled={!!busy || !product} onClick={()=>act(q,'delivered')}>Entregar via catálogo</button>
    <button disabled={!!busy} onClick={()=>act(q,'rejected')}>Solicitar revisão</button>
  </div></div>;
}
function ModelCatalogAdmin({models}) {
  const [name,setName]=useState(''),[category,setCategory]=useState(''),[url,setUrl]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const save=async(e)=>{e.preventDefault();setBusy(true);setNotice('');try{
    const u=new URL(url.trim());
    if(u.protocol!=='https:' || !u.pathname.toLowerCase().endsWith('.glb')) throw Error('Informe um link HTTPS direto para o arquivo .glb.');
    if(!name.trim())throw Error('Informe o nome.');
    await addDoc(collection(db,'modelCatalog'),{name:name.trim().slice(0,120),category:category.trim().slice(0,80),url:u.href,active:true,createdAt:now(),updatedAt:now()});
    setName('');setUrl('');setNotice('Modelo publicado no catálogo global.');
  }catch(e){setNotice(errText(e));}finally{setBusy(false);}};
  const toggle=async(m)=>{try{await updateDoc(doc(db,'modelCatalog',m.id),{active:!m.active,updatedAt:now()});}catch(e){setNotice(errText(e));}};
  return <section className="panel"><h2>Biblioteca global de modelos 3D</h2><p className="subtle">Somente o gestor adiciona URLs GLB. Os restaurantes escolhem os modelos ativos nos seus produtos. Os links precisam ser públicos e compatíveis com o visualizador.</p>
    <form className="p-form" onSubmit={save}><label>Nome do modelo<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Categoria<input value={category} onChange={e=>setCategory(e.target.value)}/></label><label>URL direta HTTPS (.glb)<input required type="url" placeholder="https://exemplo.com/modelos/prato.glb" value={url} onChange={e=>setUrl(e.target.value)}/></label><button disabled={busy} className="p-btn p-primary">Adicionar à biblioteca</button></form><Notice error={notice}/>
    {models.map(m=><div className="restaurant-entry" key={m.id}><div><strong>{m.name}</strong><p>{m.category||'Geral'} · ID: <code>{m.id}</code></p><a href={m.url} target="_blank" rel="noopener noreferrer">Abrir GLB</a></div><button onClick={()=>toggle(m)}>{m.active?'Desativar':'Ativar'}</button></div>)}
  </section>;
}
const fmtDate = v => Number(v)?new Date(Number(v)).toLocaleString('pt-BR'):'Agora';
const chartDay = v => new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
function VisitsChart({events}) {
  const days = Array.from({length:7},(_,i)=>{
    const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-6+i);
    const from=date.getTime(), until=from+86400000;
    return {label:chartDay(date),views:events.filter(e=>e.type==='view'&&e.at>=from&&e.at<until).length,orders:events.filter(e=>e.type==='order_intent'&&e.at>=from&&e.at<until).length};
  });
  const max=Math.max(1,...days.map(d=>Math.max(d.views,d.orders)));
  return <div className="visits-chart" role="img" aria-label={`Gráfico de acessos nos últimos sete dias: ${days.map(d=>`${d.label}: ${d.views} visitas, ${d.orders} pedidos iniciados`).join('; ')}`}>
    {days.map(d=><div key={d.label} className="chart-column"><div className="chart-sticks"><div className="chart-stick" style={{height:`${Math.max(3,100*d.views/max)}%`}} title={`${d.views} visitas`}/><div className="chart-stick orders" style={{height:`${Math.max(3,100*d.orders/max)}%`}} title={`${d.orders} aberturas do WhatsApp`}/></div><span>{d.label}</span></div>)}
  </div>;
}
function Admin({user,site}) {
  const [restaurants,restaurantsError]=useLive('restaurants');
  const [requests,requestError]=useLive('modelRequests');
  const [publicationRequests,pubError]=useLive('publicationRequests');
  const [analytics,analyticsError]=useLive('analytics');
  const [models]=useLive('modelCatalog');
  const [tab,setTab]=useState('publications'),[busy,setBusy]=useState(null),[notice,setNotice]=useState('');
  const allEvents=restaurants.flatMap(r=>Object.entries(analytics.find(x=>x.id===r.id)?.events||{}).map(([id,e])=>({...e,id,restaurantId:r.id,restaurantName:r.name}))).sort((a,b)=>(b.at||0)-(a.at||0));
  const allErrors=allEvents.filter(e=>e.type==='error');
  const eventsFor=(rid)=>allEvents.filter(e=>e.restaurantId===rid);
  const act=async(q,status)=>{
    setBusy(q.id);setNotice('');try{
      let modelId='';
      if(status==='delivered') {
        modelId=window.prompt('Informe o ID de um modelo ativo do catálogo (veja aba Modelos):')?.trim() || '';
        if(!models.some(m=>m.id===modelId && m.active))throw Error('Escolha um ID de modelo ativo válido.');
      }
      await updateDoc(doc(db,'modelRequests',q.id),{status,updatedAt:now(),...(status==='delivered'?{deliveredAt:now(),modelId}:{})});
      if(status==='delivered')await updateDoc(productDoc(q.restaurantId,q.productId),{modelId,modelStatus:'delivered',updatedAt:now()});
      if(status==='in_progress')await updateDoc(productDoc(q.restaurantId,q.productId),{modelStatus:'in_progress',updatedAt:now()});
      setNotice(status==='delivered'?'Modelo do catálogo vinculado ao produto.':'Solicitação atualizada.');
    }catch(e){setNotice(errText(e));}finally{setBusy(null);}
  };
  const reviewPublication=async(q,decision)=>{
    const r=restaurants.find(x=>x.id===q.restaurantId);
    if(!r) return setNotice('Estabelecimento não encontrado.');
    setBusy(q.id);setNotice('');
    try{
      if(decision==='rejected'){
        await atomicUpdate({[`publicationRequests/${q.id}/status`]:'rejected',[`publicationRequests/${q.id}/reviewedAt`]:now(),[`restaurants/${r.id}/publicationStatus`]:'rejected'});
        setNotice('Solicitação devolvida para revisão.');return;
      }
      if(!/^55\d{10,11}$/.test(r.whatsapp||''))throw Error('O restaurante precisa cadastrar um WhatsApp válido antes da aprovação.');
      const all=await getDoc(productCollection(r.id));
      if(!Object.values(all.data()||{}).some(p=>p?.active))throw Error('O cardápio precisa de pelo menos um produto ativo.');
      let slug=r.slug || '';
      if(!slug) {
        // Confere se o sufixo de quatro caracteres ainda está livre.
        for(let i=0;i<20;i++) {
          const candidate=makePublicSlug(r.name);
          const exists=await getDoc(doc(db,'slugIndex',candidate));
          if(!exists.exists()){slug=candidate;break;}
        }
      }
      if(!slug)throw Error('Não foi possível criar um endereço disponível. Tente novamente.');
      await atomicUpdate({
        [`slugIndex/${slug}`]:r.id,
        [`restaurants/${r.id}/slug`]:slug,
        [`restaurants/${r.id}/published`]:true,
        [`restaurants/${r.id}/publicationStatus`]:'approved',
        [`restaurants/${r.id}/reviewedAt`]:now(),
        [`publicationRequests/${q.id}/status`]:'approved',
        [`publicationRequests/${q.id}/reviewedAt`]:now(),
        [`publicationRequests/${q.id}/slug`]:slug,
      });
      setNotice(`Cardápio publicado: ${location.origin}/menu/${slug}`);
    }catch(e){setNotice(errText(e));}finally{setBusy(null);}
  };
  const assignLegacyLink=async(r)=>{
    setNotice('');
    if(r.slug)return;
    setBusy(r.id);
    try{
      let result='';
      for(let i=0;i<20;i++){
        const candidate=makePublicSlug(r.name);
        if(!(await getDoc(doc(db,'slugIndex',candidate))).exists()){result=candidate;break;}
      }
      if(!result)throw Error('Não foi possível criar um endereço. Tente novamente.');
      await atomicUpdate({[`slugIndex/${result}`]:r.id,[`restaurants/${r.id}/slug`]:result,[`restaurants/${r.id}/publicationStatus`]:r.published?'approved':'paused',[`restaurants/${r.id}/updatedAt`]:now()});
      setNotice('Endereço público atualizado para: '+location.origin+'/menu/'+result);
    }catch(e){setNotice(errText(e));}finally{setBusy(null);}
  };
  const pauseRestaurant=async(r)=>{
    if(!window.confirm(`${r.published?'Retirar do ar':'Liberar novamente'} o cardápio "${r.name}"?`))return;
    try{
      // A retomada só funciona para estabelecimentos que já passaram pela aprovação.
      if(!r.published && (!r.slug || r.publicationStatus==='draft'))throw Error('Aprovação inicial obrigatória. Abra a solicitação de publicação.');
      await updateDoc(restaurantDoc(r.id),{published:!r.published,publicationStatus:r.published?'paused':'approved',updatedAt:now()});
      setNotice('Situação do cardápio atualizada.');
    }catch(e){setNotice(errText(e));}
  };
  const pending=publicationRequests.filter(q=>q.status==='pending').sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  const currentTab={publications:'Publicações',analytics:'Indicadores',errors:'Erros',queue:'Modelos AR',models:'Catálogo 3D',restaurants:'Restaurantes',site:'Site'}[tab];
  return <div className="platform-page"><SiteHeader user={user} brand="Mezzira"/><div className="dashboard-wrap">
    <div className="dashboard-title"><div><div className="eyebrow">CENTRAL DE GESTÃO</div><h1>Controle da plataforma</h1><p>Publicações, estabelecimentos, solicitações e qualidade do serviço, em um só lugar.</p></div><A href="/painel" className="p-btn p-outline">Minha conta</A></div>
    <div className="stat-grid"><div><strong>{restaurants.length}</strong><span>Estabelecimentos</span></div><div><strong>{pending.length}</strong><span>Publicações pendentes</span></div><div><strong>{allEvents.filter(e=>e.type==='view').length}</strong><span>Visitas registradas</span></div><div><strong>{allErrors.length}</strong><span>Erros coletados</span></div></div>
    <div className="tabbar admin-tabbar">{[['publications','Aprovações'],['analytics','Gráficos'],['errors','Erros'],['queue','Solicitações AR'],['models','Biblioteca 3D'],['restaurants','Restaurantes'],['site','Site']].map(([id,name])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{name}{id==='publications'&&pending.length?` (${pending.length})`:''}</button>)}</div>
    <Notice error={restaurantsError||requestError||pubError||analyticsError} ok={notice}/>
    {tab==='publications' && <section className="panel"><h2>Solicitações de publicação</h2><p className="subtle">O cardápio só fica público após sua aprovação. O endereço recebe o nome do estabelecimento e quatro caracteres.</p>{pending.length?pending.map(q=>{
      const r=restaurants.find(x=>x.id===q.restaurantId);
      return <div className="restaurant-entry publication-entry" key={q.id}><div><strong>{r?.name||q.restaurantName||'Estabelecimento'}</strong><p>{r?.niche||'Sem nicho'} · {r?.whatsapp||'WhatsApp não cadastrado'} · {fmtDate(q.createdAt)}</p>{r?.tagline&&<small>{r.tagline}</small>}</div><div className="admin-actions"><A className="p-btn p-outline" href={`/painel/restaurante/${q.restaurantId}`}>Inspecionar</A><button disabled={busy===q.id} onClick={()=>reviewPublication(q,'approved')}>Aprovar</button><button disabled={busy===q.id} onClick={()=>reviewPublication(q,'rejected')}>Solicitar ajustes</button></div></div>;
    }):<p className="empty">Nenhuma publicação aguardando aprovação.</p>}</section>}
    {tab==='analytics' && <section className="panel"><h2>Fluxo de acessos</h2><p className="subtle">Métricas anônimas capturadas ao abrir um cardápio. Saídas e erros dependem da conexão do visitante, por isso podem não ser registrados em todos os casos.</p><div className="legend"><span><i className="legend-dot"/>Visualizações</span><span><i className="legend-dot orders"/>Aberturas do WhatsApp</span></div><VisitsChart events={allEvents}/><h3>Por estabelecimento</h3><div className="analytics-table">{restaurants.map(r=>{const entries=eventsFor(r.id);return <div className="analytics-row" key={r.id}><strong>{r.name}</strong><span>{entries.filter(e=>e.type==='view').length} visitas</span><span>{entries.filter(e=>e.type==='exit').length} saídas</span><span>{entries.filter(e=>e.type==='order_intent').length} pedidos iniciados</span><span>{entries.filter(e=>e.type==='error').length} erros</span></div>;})}</div></section>}
    {tab==='errors' && <section className="panel"><h2>Registro de falhas do cardápio</h2><p className="subtle">Erros capturados no navegador dos visitantes são enviados sem informações pessoais, com limitação por visita.</p>{allErrors.length?allErrors.slice(0,100).map(e=><div className="error-entry" key={e.restaurantId+e.id}><div><strong>{e.restaurantName}</strong><small>{fmtDate(e.at)}</small></div><code>{e.message||'Falha não identificada'}</code></div>):<p className="empty">Nenhum erro recebido.</p>}</section>}
    {tab==='queue' && <section className="panel"><h2>Produção e entrega de modelos</h2><p className="subtle">Somente contas gestoras autorizadas atribuem URLs de modelos 3D. Prazo de referência: sete dias.</p>{requests.length?requests.slice().sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).map(q=><AdminRequestCard key={q.id} q={q} restaurant={restaurants.find(r=>r.id===q.restaurantId)} busy={busy} act={act}/>):<p className="empty">Nenhuma solicitação AR recebida.</p>}</section>}
    {tab==='models' && <ModelCatalogAdmin models={models}/>}
    {tab==='restaurants' && <section className="panel"><h2>Todos os estabelecimentos</h2>{restaurants.map(r=><div className="restaurant-entry" key={r.id}><div><strong>{r.name}</strong><p>{r.published?'Online':'Privado'} · {r.slug||'Aguardando endereço público'}</p>{r.published&&r.slug&&<a href={`${location.origin}/menu/${r.slug}`} target="_blank" rel="noopener noreferrer">Abrir cardápio público</a>}</div><div className="admin-actions"><A className="p-btn p-outline" href={`/painel/restaurante/${r.id}`}>Gerenciar</A>{!r.slug&&(r.published||r.publicationStatus==='paused')&&<button disabled={busy===r.id} onClick={()=>assignLegacyLink(r)}>Gerar link público</button>}<button onClick={()=>pauseRestaurant(r)}>{r.published?'Suspender':'Reativar'}</button></div></div>)}</section>}
    {tab==='site' && <PlatformEditor site={site}/>}
  </div></div>;
}
const defaults = {name:'Mezzira',headline:'Uma experiência que começa antes da primeira garfada.',description:'Transforme o cardápio em uma experiência: modelos 3D, realidade aumentada e pedidos pelo WhatsApp.'};
function Root() {
  const [path,setPath]=useState(location.pathname),[user,setUser]=useState(undefined),[admin,setAdmin]=useState(undefined),[site,setSite]=useState(defaults);
  useEffect(()=>{const fn=()=>setPath(location.pathname);window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)},[]);
  useEffect(()=>{
    if (!auth) {setUser(null);setAdmin(false);return;}
    let alive=true, epoch=0;
    const unsubscribe=onAuthStateChanged(auth,async(u)=>{
      if(!alive)return;
      const turn=++epoch;
      setUser(u);
      if(!u){setAdmin(false);return;}
      setAdmin(undefined);
      try {const t=await u.getIdTokenResult(true);if(alive&&epoch===turn)setAdmin(t.claims.platformAdmin===true);}
      catch{if(alive&&epoch===turn)setAdmin(false);}
    });
    return()=>{alive=false;unsubscribe();};
  },[]);
  useEffect(()=>{if(!db)return;return onSnapshot(doc(db,'settings','site'),s=>{if(s.exists())setSite({...defaults,...s.data()});},()=>{});},[]);
  // Sessão Google persistente: sem exibir a landing nem o login ao abrir ou voltar.
  // Só redirecionamos rotas de apresentação; links de cardápios seguem públicos.
  useEffect(()=>{if(shouldRedirectToBusiness(path,!!user))navigate('/painel',true);},[user,path]);
  // A tela inicial só desaparece depois da restauração de sessão e do redirecionamento.
  // Para /menu/* o próprio Consumer aguarda a primeira leitura do Realtime Database.
  useEffect(()=>{
    if (path.startsWith('/menu/') && path!=='/menu/demo') return;
    if (user===undefined || shouldRedirectToBusiness(path,!!user)) return;
    if (path==='/gestor' && !!user && admin===undefined) return;
    window.dispatchEvent(new Event('mezzira:ready'));
  },[path,user,admin]);
  if(path==='/menu/demo') return <Busy>Cardápio não encontrado.</Busy>;
  if(path.startsWith('/menu/'))return <Consumer handle={decodeMenuHandle(path)}/>;
  if(user===undefined)return <Busy>Restaurando sua sessão…</Busy>;
  if(shouldRedirectToBusiness(path,!!user))return <Busy>Abrindo sua gestão…</Busy>;
  if(path==='/entrar')return <AuthPage site={site} go={navigate}/>;
  if(path==='/painel' || path.startsWith('/painel/') || path==='/gestor'){
    if(!configured)return <Busy>O serviço está temporariamente indisponível. Tente novamente mais tarde.</Busy>;
    if(!user)return <AuthPage site={site} go={navigate}/>;
    if(path==='/gestor')return admin===undefined?<Busy>Verificando permissão…</Busy>:admin?<Admin user={user} site={site}/>:<Busy>Você não tem permissão para acessar esta página.</Busy>;
    if(path.startsWith('/painel/restaurante/'))return <RestaurantPanel key={path} rid={path.split('/')[3]} user={user} admin={admin===true}/>;
    return <Overview user={user} admin={admin===true}/>;
  }
  return <MarketingLanding site={site} go={navigate}/>;
}
createRoot(document.getElementById('root')).render(<Root/>);
