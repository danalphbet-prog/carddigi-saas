import React, {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowRight,ShoppingBag,Plus,Minus, X, Search, MapPin, Instagram, MessageCircle, Box, ScanLine, Camera, ChevronRight, Heart, UtensilsCrossed, SlidersHorizontal, Check, Globe} from 'lucide-react';
import {Viewer, ARSession} from './ar-viewer.jsx';
import './savor-menu.css';

const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const tel=v=>String(v||'').replace(/\D/g,'');
function Image({src,alt='',className=''}){return src?<img className={className} src={src} alt={alt} loading="lazy"/>:<div className={'savor-no-photo '+className}><UtensilsCrossed size={29}/><span>Fotografia em preparação</span></div>}
export function SavorMenu({restaurant,products=[],categories=[],onEvent=()=>{},onOrder=()=>{}}){
 const [cat,setCat]=useState('Todos'),[search,setSearch]=useState(''),[opened,setOpened]=useState(null),[count,setCount]=useState(1),[cart,setCart]=useState({}),[cartOpen,setCartOpen]=useState(false),[mode,setMode]=useState('photo'),[ar,setAr]=useState(null),[viewerError,setViewerError]=useState(''),[clientName,setClientName]=useState(''),[notes,setNotes]=useState(''),[msg,setMsg]=useState('');
 const [economy,setEconomy]=useState(false);
 const available=useMemo(()=>products.filter(p=>p.active!==false && !(Number.isFinite(p.stock)&&p.stock===0)),[products]);
 const filtered=useMemo(()=>available.filter(p=>(cat==='Todos'||p.cat===cat)&&(!search||[p.name,p.cat,p.description].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))),[available,cat,search]);
 const total=available.reduce((s,p)=>s+Number(p.price||0)*(cart[p.id]||0),0);
 const numItems=Object.values(cart).reduce((s,n)=>s+n,0);
 const chosen=available.find(p=>p.id===opened);
 const closeAr=()=>setAr(null);
 useEffect(()=>{if(!ar)return;return()=>ar.overlay.remove()},[ar]);
 useEffect(()=>{const fn=e=>{if(e.key==='Escape'){setOpened(null);setCartOpen(false)}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[]);
 const openProduct=p=>{setOpened(p.id);setCount(1);setMode('photo');setViewerError('');window.scrollTo({top:0,behavior:'instant'})};
 const change=(id,n)=>setCart(prev=>{const next={...prev};const value=Math.max(0,n);if(value)next[id]=value;else delete next[id];return next});
 const startAR=()=>{
  if(!chosen?.url)return;
  const overlay=document.createElement('div');overlay.className='ar-screen';document.body.appendChild(overlay);
  const sessionP=window.isSecureContext&&navigator.xr?navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test'],optionalFeatures:['local-floor','anchors','light-estimation','dom-overlay'],domOverlay:{root:overlay}}):Promise.reject(Error('Seu navegador ou aparelho não oferece suporte à realidade aumentada.'));
  sessionP.catch(()=>{});onEvent('ar_open');setAr({product:chosen,overlay,sessionP});
 };
 const checkout=()=>{
  const phone=tel(restaurant.whatsapp);
  if(!/^55\d{10,11}$/.test(phone)){setMsg('Este estabelecimento ainda não cadastrou um WhatsApp válido.');return;}
  const rows=available.filter(p=>cart[p.id]).map(p=>({name:p.name,quantity:cart[p.id],price:Number(p.price)}));
  if(!rows.length)return;
  const code=onOrder({customerName:clientName.trim(),notes:notes.trim(),items:rows});
  const lines=[`*Pedido — ${restaurant.name}*`,...(code?[`Referência #${code}`]:[]),'',...rows.map(x=>`${x.quantity}x ${x.name} — ${money(x.price*x.quantity)}`),'',`*Total: ${money(total)}*`,...(clientName.trim()?[`Nome: ${clientName.trim()}`]:[]),...(notes.trim()?[`Observações: ${notes.trim()}`]:[]),'','Olá! Quero confirmar este pedido.'];
  onEvent('order_intent');window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`,'_blank','noopener,noreferrer');
 };
 const publicColor=/^#[0-9a-f]{6}$/i.test(restaurant.accentColor||'')?restaurant.accentColor:'#3e4a2b';
 return <div className="savor-client" data-preset={restaurant.themePreset||'classico'} style={{'--sm-olive':publicColor}}>
  <div className="sm-home-hero" style={restaurant.cover?{backgroundImage:`linear-gradient(180deg,rgba(21,20,13,.12),rgba(21,20,13,.82)),url(${restaurant.cover})`}:undefined}>
   <div className="sm-home-top"><div className="sm-wordmark"><span className="sm-logomark">{restaurant.logo?<img src={restaurant.logo} alt=""/>:<UtensilsCrossed size={20}/>}</span><span>{restaurant.name}</span></div><div className="sm-top-btns"><button onClick={()=>setCartOpen(true)} title="Abrir carrinho" aria-label="Carrinho"><ShoppingBag size={21}/>{numItems>0&&<i>{numItems}</i>}</button></div></div>
   <div className="sm-hero-copy"><span className="sm-eyebrow">CARDÁPIO DIGITAL · EXPERIÊNCIA IMERSIVA</span><h1>{restaurant.name}</h1><p>{restaurant.tagline||restaurant.niche||'Conheça nosso cardápio.'}</p><button onClick={()=>document.getElementById('sm-menu-list')?.scrollIntoView({behavior:'smooth'})}>Explorar o cardápio <span><ArrowRight size={18}/></span></button></div>
  </div>
  <div className="sm-body" id="sm-menu-list">
    <div className="sm-handle"/>
    <div className="sm-quicklinks">
      <button onClick={()=>document.getElementById('sm-products')?.scrollIntoView({behavior:'smooth'})}><span><UtensilsCrossed/></span>Cardápio</button>
      <button onClick={()=>setCartOpen(true)}><span><ShoppingBag/></span>Carrinho</button>
      {restaurant.instagram&&<a href={`https://www.instagram.com/${encodeURIComponent(restaurant.instagram.replace(/^@/,''))}/`} target="_blank" rel="noopener noreferrer"><span><Instagram/></span>Instagram</a>}
      {restaurant.address&&<button onClick={()=>{document.getElementById('sm-about')?.scrollIntoView({behavior:'smooth'})}}><span><MapPin/></span>Endereço</button>}
    </div>
    <div className="sm-section-header" id="sm-products"><div><small>ESCOLHA SEUS FAVORITOS</small><h2>Nosso cardápio</h2></div><span>{available.length} {available.length===1?'item':'itens'}</span></div>
    <div className="sm-search"><Search size={18}/><input value={search} placeholder="Pesquisar no cardápio..." onChange={e=>setSearch(e.target.value)} aria-label="Pesquisar produtos"/><SlidersHorizontal size={17}/></div>
    <div className="sm-categories" role="group" aria-label="Categorias">{['Todos',...new Set(available.map(p=>p.cat||'Outros'))].map(c=><button className={cat===c?'on':''} onClick={()=>setCat(c)} key={c}>{c}</button>)}</div>
    <div className="sm-product-grid">{filtered.map(p=><article key={p.id} className="sm-product-card"><button className="sm-card-pic" onClick={()=>openProduct(p)} aria-label={`Ver ${p.name}`}><Image src={p.photo} alt={p.name}/>{p.url&&<span className="sm-card-ar"><Box size={14}/> 3D</span>}</button><div className="sm-card-info"><button onClick={()=>openProduct(p)}><strong>{p.name}</strong><span>{p.description||p.cat||''}</span><b>{money(p.price)}</b></button><button className="sm-add" onClick={()=>change(p.id,(cart[p.id]||0)+1)} aria-label={`Adicionar ${p.name}`}><Plus size={18}/></button></div></article>)}{!filtered.length&&<div className="sm-empty">Nenhum produto encontrado. Tente outra categoria ou pesquisa.</div>}</div>
    <section id="sm-about" className="sm-about"><h2>Sobre o estabelecimento</h2><p>{restaurant.tagline||'Informações fornecidas pelo estabelecimento.'}</p>{restaurant.address&&<p><MapPin size={17}/>{restaurant.address}</p>}{restaurant.instagram&&<p><Instagram size={17}/>{'@'+restaurant.instagram.replace(/^@/,'')}</p>}</section>
  </div>
  {numItems>0&&!cartOpen&&<button className="sm-floating-cart" onClick={()=>setCartOpen(true)}><ShoppingBag size={20}/>{numItems} {numItems===1?'item':'itens'} <b>{money(total)}</b><ChevronRight size={19}/></button>}
  {chosen&&<div className="sm-detail" role="dialog" aria-modal="true" aria-label={`Detalhes de ${chosen.name}`}>
    <div className="sm-detail-top"><button onClick={()=>setOpened(null)} aria-label="Voltar"><ArrowLeft/></button><span>{chosen.cat||'Cardápio'}</span><button onClick={()=>setCartOpen(true)} aria-label="Carrinho"><ShoppingBag/></button></div>
    <div className="sm-detail-image">{mode==='3d'&&chosen.url?<Viewer product={chosen} onError={m=>{setViewerError(m);onEvent('error',m)}}/>:<Image src={chosen.photo} alt={chosen.name}/>}</div>
    {chosen.url&&<div className="sm-view-options"><button className={mode==='photo'?'active':''} onClick={()=>setMode('photo')}><Camera size={16}/> Foto</button><button className={mode==='3d'?'active':''} onClick={()=>setMode('3d')}><Box size={16}/> Modelo 3D</button></div>}
    <div className="sm-detail-copy"><small>{chosen.cat||'ESPECIALIDADE'}</small><h1>{chosen.name}</h1><strong className="sm-price">{money(chosen.price)}</strong><p>{chosen.description}</p>{Array.isArray(chosen.ingredients)&&chosen.ingredients.length>0&&<div><h3>Ingredientes</h3><p>{chosen.ingredients.join(' · ')}</p></div>}{viewerError&&<p role="alert">{viewerError}</p>}</div>
    <div className="sm-detail-actions">{chosen.url&&<button className="sm-ar-action" onClick={startAR}><ScanLine size={20}/> Visualizar na minha mesa (AR)</button>}<div className="sm-purchase"><div><button onClick={()=>setCount(Math.max(1,count-1))}><Minus size={19}/></button><strong>{count}</strong><button onClick={()=>setCount(Math.min(50,count+1))}><Plus size={19}/></button></div><button onClick={()=>{change(chosen.id,(cart[chosen.id]||0)+count);setOpened(null)}}>Adicionar · {money(chosen.price*count)} <ArrowRight size={18}/></button></div></div>
  </div>}
  {cartOpen&&<div className="sm-cart-overlay" onClick={()=>setCartOpen(false)}><div className="sm-cart-drawer" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Carrinho"><div className="sm-cart-head"><div><small>SEU PEDIDO</small><h2>Carrinho</h2></div><button onClick={()=>setCartOpen(false)} aria-label="Fechar carrinho"><X/></button></div>{numItems?available.filter(p=>cart[p.id]).map(p=><div className="sm-cart-row" key={p.id}><Image src={p.photo} alt={p.name}/><div><b>{p.name}</b><small>{money(p.price)} cada</small><div><button onClick={()=>change(p.id,cart[p.id]-1)}><Minus size={16}/></button><strong>{cart[p.id]}</strong><button onClick={()=>change(p.id,cart[p.id]+1)}><Plus size={16}/></button></div></div><strong>{money(p.price*cart[p.id])}</strong></div>):<p className="sm-empty">Seu carrinho está vazio.</p>}
   <div className="sm-cart-total"><span>Total</span><strong>{money(total)}</strong></div><label>Seu nome (opcional)<input maxLength={70} value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Como podemos chamar você?"/></label><label>Observações (opcional)<textarea maxLength={300} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ex.: sem cebola, retirar no local..."/></label>{msg&&<p className="sm-error">{msg}</p>}<button disabled={!numItems} className="sm-checkout" onClick={checkout}><MessageCircle size={19}/> Fazer pedido no WhatsApp <ArrowRight size={18}/></button><p className="sm-cart-note">A mensagem será aberta no WhatsApp. O envio, o pagamento e a confirmação do pedido acontecem com o restaurante.</p>
  </div></div>}
  {ar&&<ARSession product={ar.product} overlay={ar.overlay} sessionP={ar.sessionP} onClose={closeAr} economy={economy} onAdd={id=>change(id,(cart[id]||0)+1)} restaurant={restaurant} onEvent={onEvent}/>}
 </div>
}
