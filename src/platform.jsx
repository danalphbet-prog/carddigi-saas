import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Menu } from './main.jsx';
import { PRODUCTS, CATEGORIES, RESTAURANT, loadCatalog } from './products.js';
import {
  configured, auth, db, store, loginGoogle, uploadMedia,
  signOut, onAuthStateChanged,
  now, restaurantDoc, productDoc, productCollection, requestCollection,
} from './firebase.js';

import { MAX_REFERENCE_PHOTOS, MAX_BASE64_CHARS } from './media.js';
import { errText } from './errors.js';
import './platform.css';

const {collection, doc, query, where, addDoc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot} = store;
const BRL = (v) => Number(v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const blank = {name: '', description: '', cat: 'Pratos', price: 0, kcal: 0, diameter: .22, roughness: .76, ingredients: '', emoji: '🍽️', prompt: 'Gostaria de adicionar ao pedido?', photo: '', referencePhotos: [], active: true};
const cleanHandle = (v) => (v || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '');
const slug = (v) => String(v || '').trim();

function navigate(to) { window.history.pushState(null, '', to); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0); }
function A({href, children, ...props}) { return <a href={href} {...props} onClick={(e) => {props.onClick?.(e); if(!e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey){e.preventDefault();navigate(href);}}}>{children}</a>; }
function Busy({children = 'Carregando…'}) { return <div className="platform-page"><div className="panel-state">{children}</div></div>; }
function Notice({error, ok}) { return <>{error && <p className="p-error" role="alert">{error}</p>}{ok && <p className="p-success" role="status">{ok}</p>}</>; }

function useLive(path, filter) {
  const [data, setData] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!db || !path) return;
    const ref = collection(db, path);
    const source = filter ? query(ref, where(filter[0], filter[1], filter[2])) : ref;
    return onSnapshot(source, s => {setData(s.docs.map(x => ({id:x.id, ...x.data()})));setError('');}, e => setError(errText(e)));
  }, [path, JSON.stringify(filter)]);
  return [data, error];
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
  useEffect(() => {
    if (!db || !rid) return;
    const base = productCollection(rid);
    const source = forConsumer ? query(base, where('active','==',true)) : base;
    return onSnapshot(source, s => {setItems(s.docs.map(x => ({id:x.id,...x.data()})));setError('');}, e => setError(errText(e)));
  }, [rid, forConsumer]);
  return [items, error];
}
function GoGoogle({user, target = '/painel', children = 'Continuar com Google'}) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  return <div><button disabled={loading} className="p-btn p-primary" onClick={async()=>{
    if (user) {navigate(target);return;}
    setLoading(true);setError('');
    try {const r = await loginGoogle(); if(r) navigate(target);} catch(e) {setError(errText(e));} finally {setLoading(false);}
  }}>{loading ? 'Conectando…' : children}</button><Notice error={error}/></div>;
}
function SiteHeader({user, brand}) {return <header className="site-header"><A href="/" className="brand"><span className="brand-mark">◉</span> {brand}</A><nav><A href="/menu/demo">Demonstração</A>{user ? <A href="/painel" className="nav-action">Painel</A> : <A href="/entrar" className="nav-action">Entrar</A>}</nav></header>;}
function Landing({user, site}) {return <div className="platform-page">
  <SiteHeader user={user} brand={site.name || 'Mesa Imersiva'} />
  <section className="landing-hero"><div><div className="eyebrow">CARDÁPIO 3D + REALIDADE AUMENTADA</div><h1>{site.headline || 'Uma experiência que começa antes da primeira garfada.'}</h1><p>{site.description || 'Seu cliente explora cada prato em 3D, posiciona o pedido na própria mesa usando a câmera e finaliza direto no WhatsApp do restaurante.'}</p><div className="hero-actions"><GoGoogle user={user}>{user ? 'Acessar meu painel' : 'Criar meu cardápio'}</GoGoogle><A href="/menu/demo" className="p-btn p-outline">Explorar cardápio demo ↗</A></div><p className="subtle">Cadastro com Google · Fotos e itens por restaurante · Modelos AR preparados pela nossa equipe</p></div>
    <div className="hero-preview"><div className="hero-preview-top">PRÉVIA DA EXPERIÊNCIA <span>● ao vivo</span></div><img alt="Foto do prato de frango e abacate usado no cardápio de demonstração" src="/fotos/frango.jpg"/><div className="hero-preview-bottom"><span>Explore cada detalhe</span><strong>Visualização 3D + AR</strong></div></div>
  </section>
  <section className="features"><div><span>01 / RESTAURANTE</span><h3>Seu cardápio, sua marca</h3><p>Cadastre produtos, preços, categorias, fotografias, redes sociais e número do WhatsApp. Publique ou pause itens sem depender de suporte.</p></div><div><span>02 / PRODUÇÃO AR</span><h3>Da foto para o modelo</h3><p>Envie as fotos de referência e solicite a criação de um modelo 3D. Nossa equipe trabalha com prazo de referência de até 7 dias.</p></div><div><span>03 / CONSUMIDOR</span><h3>Pedido sem complicação</h3><p>Seu cliente visualiza, monta o carrinho e abre a mensagem completa no WhatsApp do estabelecimento.</p></div></section>
  <div className="landing-bottom"><p>Crie seu cardápio digital, encante seus clientes e receba pedidos com praticidade.</p><GoGoogle user={user}>{user ? 'Abrir painel' : 'Começar com Google'}</GoGoogle></div>
</div>;}
function Login({user, site}) {return <div className="platform-page"><SiteHeader brand={site.name || 'Mesa Imersiva'} user={user}/><section className="login-wrap"><div className="login-card"><div className="eyebrow">ACESSO AO ESTABELECIMENTO</div><h1>Entre para criar seu cardápio.</h1><p>Entre com Google para cadastrar seu estabelecimento, organizar os produtos e acompanhar solicitações de modelos 3D.</p><GoGoogle user={user}/><div className="login-divider">Acesso protegido pela sua conta Google</div><p className="subtle">Seu estabelecimento, produtos e cardápio reunidos em um só lugar. Seus clientes não precisam criar conta para fazer pedidos.</p></div></section></div>;}
function Consumer({rid, demo}) {
  const [r, state] = useRestaurant(demo ? null : rid);
  const [prods, error] = useProducts(demo ? null : rid, true);
  const [models] = useLive('modelCatalog');
  const [sample, setSample] = useState(null);
  useEffect(() => {if (demo) loadCatalog().then(s => setSample({r:{...s.RESTAURANT, instagram:'diemsociety', instagramName:'Diem Society', instagramBio:'Novidades, combos e bastidores', whatsapp:''}, p:s.PRODUCTS.map(p=>({...p,url:''})),c:s.CATEGORIES})).catch(()=>setSample({error:'Catálogo da demo não encontrado.'}));}, [demo]);
  if (demo) return sample?.r ? <><div className="demo-ribbon"><A href="/">← Início</A> Você está explorando um cardápio de demonstração</div><Menu restaurant={sample.r} products={sample.p} categories={sample.c}/></> : <Busy>{sample?.error || 'Abrindo demonstração…'}</Busy>;
  if (!configured) return <Busy>Não foi possível carregar o cardápio no momento. Tente novamente mais tarde.</Busy>;
  if (state === 'loading') return <Busy/>;
  if (!r || !r.published) return <Busy>Este cardápio não está publicado ou não existe. <A href="/">Voltar</A></Busy>;
  const mapped = prods.map(p => ({...p,url:(models.find(m=>m.id===p.modelId && m.active)?.url || ''), photo:p.photo || '', ingredients:Array.isArray(p.ingredients)?p.ingredients:[], cat:p.cat || 'Outros', price:Number(p.price || 0), diameter:Number(p.diameter || .2), kcal:Number(p.kcal || 0)}));
  const cats = ['Todos', ...new Set(mapped.map(p => p.cat))];
  return <>{error && <Notice error={error}/>}<Menu key={rid} restaurant={r} products={mapped} categories={cats}/></>;
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
      const obj = {name:fields.name.trim().slice(0,120),description:fields.description.trim().slice(0,1200),cat:slug(fields.cat).slice(0,70)||'Outros',price,kcal:Math.max(0,Number(fields.kcal)||0),diameter,roughness:Math.min(1,Math.max(0,Number(fields.roughness)||.75)), ingredients:fields.ingredients.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,25),emoji:fields.emoji.trim().slice(0,10),prompt:fields.prompt.trim().slice(0,200),photo:fields.photo||'',referencePhotos:fields.referencePhotos.slice(0,MAX_REFERENCE_PHOTOS),active:!!fields.active,modelId:fields.modelId || '',updatedAt:now()};
      if(product?.id) await updateDoc(productDoc(rid, product.id), obj);
      else await addDoc(productCollection(rid), {...obj,modelStatus:'none',createdAt:now()});
      onClose();
    } catch(e){setError(errText(e));}finally{setBusy(false);}
  };
  return <div className="modal-back" onClick={onClose}><section className="p-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><h2>{product ? 'Editar produto' : 'Adicionar produto'}</h2><button onClick={onClose} aria-label="Fechar">✕</button></div><form onSubmit={save} className="form-grid">
    <label>Nome do item<input required maxLength={120} value={fields.name} onChange={e=>set('name',e.target.value)} /></label><label>Categoria<input required value={fields.cat} onChange={e=>set('cat',e.target.value)}/></label>
    <label className="span-2">Descrição<textarea rows={3} value={fields.description} onChange={e=>set('description',e.target.value)} /></label>
    <label>Preço (R$)<input type="number" min="0" max="100000" step="0.01" value={fields.price} onChange={e=>set('price',e.target.value)}/></label><label>Calorias<input type="number" min="0" value={fields.kcal} onChange={e=>set('kcal',e.target.value)}/></label>
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
function RestaurantSettings({r}) {
  const [f,setF] = useState(()=>({...r}));
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [ok,setOk]=useState('');
  useEffect(()=>setF({...r}),[r?.id]);
  const save = async(e) => { e.preventDefault();setBusy(true);setError('');setOk('');try {
    const whatsapp = f.whatsapp.replace(/\D/g,'');
    if (whatsapp && !/^55\d{10,11}$/.test(whatsapp)) throw Error('WhatsApp precisa ter DDI 55 + DDD + número. Ex.: 5511999999999.');
    if(f.published && !/^55\d{10,11}$/.test(whatsapp)) throw Error('Configure o WhatsApp antes de publicar.');
    await updateDoc(restaurantDoc(r.id),{name:f.name.trim().slice(0,90),tagline:f.tagline.trim().slice(0,250),whatsapp, instagram:cleanHandle(f.instagram),instagramName:f.instagramName.trim().slice(0,90),instagramBio:f.instagramBio.trim().slice(0,250),niche:(f.niche||'').trim().slice(0,80),address:(f.address||'').trim().slice(0,240),published:!!f.published,cover:f.cover || '',logo:f.logo || '',updatedAt:now()});
    setOk('Configurações salvas.');
  }catch(e){setError(errText(e));}finally{setBusy(false);}};
  const cover = async (file, field='cover')=>{if(!file)return;setBusy(true);setError('');try{const {url} = await uploadMedia(r.id,file);setF(v=>({...v,[field]:url}));setOk('Foto pronta! Toque em Salvar estabelecimento para concluir.');}catch(e){setError(errText(e));}finally{setBusy(false);}};
  return <form className="panel p-form" onSubmit={save}><h2>Configurações do estabelecimento</h2><div className="form-grid">
    <label>Nome do restaurante<input required value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></label><label>WhatsApp com DDI (55)<input required placeholder="5511999999999" value={f.whatsapp||''} onChange={e=>setF({...f,whatsapp:e.target.value})}/></label>
    <label>Nicho / tipo do estabelecimento<input maxLength={80} placeholder="Hamburgueria, pizzaria, cafeteria…" value={f.niche||''} onChange={e=>setF({...f,niche:e.target.value})}/></label><label>Endereço (opcional)<input maxLength={240} value={f.address||''} onChange={e=>setF({...f,address:e.target.value})}/></label>
    <label className="span-2">Descrição do restaurante<textarea rows={2} value={f.tagline||''} onChange={e=>setF({...f,tagline:e.target.value})}/></label>
    <label>Instagram (@ sem URL)<input value={f.instagram||''} placeholder="meurestaurante" onChange={e=>setF({...f,instagram:e.target.value})}/></label><label>Nome no card do Instagram<input value={f.instagramName||''} onChange={e=>setF({...f,instagramName:e.target.value})}/></label>
    <label className="span-2">Bio do card Instagram<textarea rows={2} value={f.instagramBio||''} onChange={e=>setF({...f,instagramBio:e.target.value})}/></label>
    <label>Foto da capa<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>cover(e.target.files[0])}/></label><label>Logotipo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>cover(e.target.files[0],'logo')}/></label>
    {f.logo && <img className="preview-pic" alt="Logotipo" src={f.logo}/>}
    <label className="checkbox-line span-2"><input type="checkbox" checked={!!f.published} onChange={e=>setF({...f,published:e.target.checked})}/> Publicar cardápio para visitantes</label>
  </div><Notice error={error} ok={ok}/><button className="p-btn p-primary" disabled={busy}>{busy?'Salvando…':'Salvar estabelecimento'}</button></form>;
}
function RestaurantPanel({rid,user,admin}) {
  const [r,status]=useRestaurant(rid), [products,error]=useProducts(rid);
  const [requests,reqError]=useLive('modelRequests', ['ownerUid','==',user.uid]);
  const [models] = useLive('modelCatalog');
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
  const url=`${location.origin}/menu/${rid}`;
  return <div className="platform-page"><SiteHeader user={user} brand="Mesa Imersiva"/><div className="dashboard-wrap"><div className="crumb"><A href="/painel">Meus restaurantes</A> / {r.name}</div><div className="dashboard-title"><div><div className="eyebrow">PAINEL DO RESTAURANTE</div><h1>{r.name}</h1><p>{r.published?'Cardápio publicado':'Rascunho — somente você pode administrar'}</p></div><A href={`/menu/${rid}`} className="p-btn p-outline">Ver cardápio ↗</A></div>
    <div className="share-strip"><div><small>Link do cardápio</small><code>{url}</code></div><button onClick={()=>{navigator.clipboard?.writeText(url);setNotice('Link copiado.');}}>Copiar</button></div>
    <div className="tabbar"><button className={tab==='items'?'active':''} onClick={()=>setTab('items')}>Produtos ({products.length})</button><button className={tab==='requests'?'active':''} onClick={()=>setTab('requests')}>Solicitações AR ({myRequests.length})</button><button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}>Estabelecimento</button></div>
    {tab==='items' && <section className="panel"><div className="panel-head"><div><h2>Seu cardápio</h2><p>Gerencie fotos, informações e disponibilidade.</p></div><button className="p-btn p-primary" onClick={()=>setEditing(null)}>+ Novo item</button></div><Notice error={error} ok={notice}/>{products.length? <div className="item-list">{products.map(p=><div className="item-entry" key={p.id}><div className="item-image">{p.photo?<img src={p.photo} alt=""/>:p.emoji||'🍽️'}</div><div className="item-text"><strong>{p.name}</strong><span>{p.cat} · {BRL(p.price)}</span><small>{p.active?'Ativo':'Oculto'} · {models.some(m=>m.id===p.modelId && m.active)?'3D disponível':'Sem modelo 3D'}</small></div><div className="item-buttons"><button onClick={()=>setEditing(p)}>Editar</button><button disabled={busy || models.some(m=>m.id===p.modelId && m.active)} onClick={()=>askModel(p)}>Solicitar AR</button><button className="danger" onClick={()=>remove(p)}>Excluir</button></div></div>)}</div>:<p className="empty">Nenhum item cadastrado. Comece pelo primeiro prato.</p>}</section>}
    {tab==='requests' && <section className="panel"><h2>Solicitações de modelos AR</h2><p className="subtle">Acompanhe aqui as etapas de produção. O prazo previsto é de até 7 dias, sujeito à análise das fotos enviadas.</p><Notice error={reqError}/>{myRequests.length?myRequests.map(q=><div className="request-row" key={q.id}><div><strong>{q.productName}</strong><small>{q.createdAt ? new Date(q.createdAt).toLocaleDateString('pt-BR') : 'Enviado agora'}</small></div><span className="status-tag">{{pending:'Recebido',in_progress:'Em produção',delivered:'Entregue',rejected:'Precisa de revisão'}[q.status]||q.status}</span></div>):<p className="empty">Você ainda não solicitou modelos.</p>}</section>}
    {tab==='settings' && <RestaurantSettings r={r}/>}
  </div>{editing!==undefined && <ProductEditor rid={rid} product={editing} onClose={()=>setEditing(undefined)}/>}</div>;
}
function Overview({user,admin}) {
  const [restaurants,error]=useLive('restaurants',['ownerUid','==',user.uid]);
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const create=async(e)=>{e.preventDefault();if(!name.trim())return;setBusy(true);setNotice('');try{
    const d=await addDoc(collection(db,'restaurants'),{ownerUid:user.uid,name:name.trim().slice(0,90),tagline:'Conheça nosso cardápio em 3D.',whatsapp:'',instagram:'',instagramName:'',instagramBio:'',niche:'',address:'',cover:'',logo:'',published:false,createdAt:now(),updatedAt:now()});navigate(`/painel/restaurante/${d.id}`);
  }catch(e){setNotice(errText(e));}finally{setBusy(false);}};
  return <div className="platform-page"><SiteHeader user={user} brand="Mesa Imersiva"/><div className="dashboard-wrap"><div className="dashboard-title"><div><div className="eyebrow">ÁREA DO ESTABELECIMENTO</div><h1>Olá, {user.displayName?.split(' ')[0] || 'bem-vindo'}.</h1><p>Organize seus estabelecimentos e os modelos AR.</p></div><button className="p-btn p-outline" onClick={()=>signOut(auth)}>Sair</button></div><section className="panel"><h2>Seus restaurantes</h2><Notice error={error}/>{restaurants.filter(r=>r.ownerUid===user.uid).map(r=><div className="restaurant-entry" key={r.id}><div><strong>{r.name}</strong><p>{r.published?'Publicado':'Não publicado'}</p></div><A href={`/painel/restaurante/${r.id}`} className="p-btn p-outline">Gerenciar →</A></div>)}{!restaurants.some(r=>r.ownerUid===user.uid)&&<p className="empty">Nenhum restaurante cadastrado.</p>}</section><form className="panel create-rest" onSubmit={create}><h2>Adicionar estabelecimento</h2><p className="subtle">Cada restaurante recebe seu próprio endereço, produtos e painel.</p><div><input required maxLength={90} placeholder="Nome do restaurante" value={name} onChange={e=>setName(e.target.value)}/><button className="p-btn p-primary" disabled={busy}>{busy?'Criando…':'+ Criar restaurante'}</button></div><Notice error={notice}/></form></div></div>;
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
function Admin({user,site}) {
  const [restaurants,error]=useLive('restaurants');
  const [requests,requestError]=useLive('modelRequests');
  const [tab,setTab]=useState('queue'),[busy,setBusy]=useState(null),[notice,setNotice]=useState('');
  const [models] = useLive('modelCatalog');
  const act=async(q,status)=>{
    setBusy(q.id);setNotice('');try{
      let modelId='';
      if(status==='delivered') {
        modelId=window.prompt('Informe o ID de um modelo ativo do catálogo (veja aba Modelos):')?.trim() || '';
        if(!models.some(m=>m.id===modelId && m.active)) throw Error('Escolha um ID de modelo ativo válido.');
      }
      await updateDoc(doc(db,'modelRequests',q.id),{status,updatedAt:now(),...(status==='delivered'?{deliveredAt:now(),modelId}:{})});
      if(status==='delivered') await updateDoc(productDoc(q.restaurantId,q.productId),{modelId,modelStatus:'delivered',updatedAt:now()});
      if(status==='in_progress') await updateDoc(productDoc(q.restaurantId,q.productId),{modelStatus:'in_progress',updatedAt:now()});
      setNotice(status==='delivered'?'Modelo do catálogo vinculado ao produto.':'Solicitação atualizada.');
    }catch(e){setNotice(errText(e));}finally{setBusy(null);}
  };
  return <div className="platform-page"><SiteHeader user={user} brand="Mesa Imersiva"/><div className="dashboard-wrap"><div className="dashboard-title"><div><div className="eyebrow">GESTÃO DO SAAS — ACESSO PRIVILEGIADO</div><h1>Central de administração</h1><p>Acompanhe os estabelecimentos, modelos e configurações públicas.</p></div><A href="/painel" className="p-btn p-outline">Painel pessoal</A></div><div className="stat-grid"><div><strong>{restaurants.length}</strong><span>Restaurantes</span></div><div><strong>{requests.filter(r=>r.status==='pending').length}</strong><span>Aguardando</span></div><div><strong>{requests.filter(r=>r.status==='in_progress').length}</strong><span>Em produção</span></div><div><strong>{requests.filter(r=>r.status==='delivered').length}</strong><span>Entregues</span></div></div><div className="tabbar"><button className={tab==='queue'?'active':''} onClick={()=>setTab('queue')}>Pedidos AR</button><button className={tab==='models'?'active':''} onClick={()=>setTab('models')}>Catálogo 3D ({models.length})</button><button className={tab==='restaurants'?'active':''} onClick={()=>setTab('restaurants')}>Restaurantes</button><button className={tab==='site'?'active':''} onClick={()=>setTab('site')}>Site</button></div>
  <Notice error={error || requestError} ok={notice}/>
  {tab==='queue' && <section className="panel"><h2>Produção e entrega de modelos</h2><p className="subtle">Somente o gestor autorizado pode atribuir GLBs aos itens. A data-alvo é de até 7 dias após cada requisição.</p>{requests.length?requests.slice().sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).map(q=><AdminRequestCard key={q.id} q={q} restaurant={restaurants.find(r=>r.id===q.restaurantId)} busy={busy} act={act}/>):<p className="empty">Nenhuma requisição recebida.</p>}</section>}
  {tab==='models' && <ModelCatalogAdmin models={models}/>}
  {tab==='restaurants' && <section className="panel"><h2>Restaurantes registrados</h2>{restaurants.map(r=><div className="restaurant-entry" key={r.id}><div><strong>{r.name}</strong><p>{r.published?'Publicado':'Rascunho'} · Proprietário: {r.ownerUid}</p></div><A className="p-btn p-outline" href={`/painel/restaurante/${r.id}`}>Inspecionar</A></div>)}</section>}
  {tab==='site' && <PlatformEditor site={site}/>}
  </div></div>;
}
const defaults = {name:'Mesa Imersiva',headline:'Uma experiência que começa antes da primeira garfada.',description:'Transforme o cardápio em uma experiência: modelos 3D, realidade aumentada e pedidos pelo WhatsApp.'};
function Root() {
  const [path,setPath]=useState(location.pathname),[user,setUser]=useState(undefined),[admin,setAdmin]=useState(false),[site,setSite]=useState(defaults);
  useEffect(()=>{const fn=()=>setPath(location.pathname);window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)},[]);
  useEffect(()=>{
    if (!auth) {setUser(null);return;}
    return onAuthStateChanged(auth,async(u)=>{
      setUser(u);if(u){try{const t=await u.getIdTokenResult();setAdmin(t.claims.platformAdmin===true);}catch{setAdmin(false);}}else setAdmin(false);
    });
  },[]);
  useEffect(()=>{if(!db)return;return onSnapshot(doc(db,'settings','site'),s=>{if(s.exists())setSite({...defaults,...s.data()});},()=>{});},[]);
  if(path==='/menu/demo') return <Consumer demo/>;
  if(path.startsWith('/menu/'))return <Consumer rid={path.split('/')[2]}/>;
  if(path==='/entrar')return <Login user={user} site={site}/>;
  if(path==='/painel' || path.startsWith('/painel/') || path==='/gestor'){
    if(!configured)return <Busy>O serviço está temporariamente indisponível. Tente novamente mais tarde.</Busy>;
    if(user===undefined)return <Busy>Validando sessão…</Busy>;
    if(!user)return <Login user={null} site={site}/>;
    if(path==='/gestor')return admin?<Admin user={user} site={site}/>:<Busy>Você não tem permissão para acessar esta página.</Busy>;
    if(path.startsWith('/painel/restaurante/'))return <RestaurantPanel key={path} rid={path.split('/')[3]} user={user} admin={admin}/>;
    return <Overview user={user} admin={admin}/>;
  }
  return <Landing user={user} site={site}/>;
}
createRoot(document.getElementById('root')).render(<Root/>);
