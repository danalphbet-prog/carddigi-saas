import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XREstimatedLight } from 'three/addons/webxr/XREstimatedLight.js';
import { PRODUCTS, CATEGORIES, RESTAURANT } from './products.js';
import { loadProduct, createFallbackLights, createContactShadow, disposeObject } from './scene.js';
import './style.css';

const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Distâncias em metros entre a câmera e o centro do prato.
const ALERT_DIST = 0.24;

function I({ d }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />;
}
const ICON = {
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  cube: '<path d="M12 2 21 7v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
  ar: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8"/>',
};

function configureRenderer(renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
}

function Photo({ p, className }) {
  const [ok, setOk] = useState(true);
  return <div className={className}>
    {ok ? <img src={p.photo} alt={p.name} loading="lazy" onError={() => setOk(false)} /> : <span className="emoji" aria-hidden="true">{p.emoji}</span>}
  </div>;
}

function Viewer({ product, onError }) {
  const mount = useRef(null);
  useEffect(() => {
    const host = mount.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 30);
    camera.position.set(0.43, 0.32, 0.45);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    configureRenderer(renderer);
    host.appendChild(renderer.domElement);
    createFallbackLights(scene);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.055, 0);
    controls.enableDamping = true;
    controls.minDistance = 0.15;
    controls.maxDistance = 1.2;
    controls.maxPolarAngle = Math.PI * 0.82;
    controls.update();

    let removed = false;
    let object = null;
    loadProduct(product).then((model) => {
      if (removed) { disposeObject(model); return; }
      object = model;
      scene.add(model);
    }).catch((error) => { if (!removed) onError(error.message || 'Falha ao abrir GLB'); });

    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let id;
    const animate = () => { id = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();
    return () => {
      removed = true;
      cancelAnimationFrame(id);
      observer.disconnect();
      controls.dispose();
      disposeObject(object);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [product, onError]);
  return <div className="viewer" ref={mount} aria-label={`Modelo 3D de ${product.name}`} />;
}

function InstagramCard({ restaurant, small = false }) {
  const [confirm, setConfirm] = useState(false);
  const handle = String(restaurant.instagram || '').replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '');
  if (!handle) return null;
  const url = `https://www.instagram.com/${handle}/`;
  return <div className={`insta-glass ${small ? 'floating' : ''}`}>
    {!confirm ? <>
      <div className="insta-head"><strong>◎ Instagram</strong><b>@{handle}</b></div>
      <div className="insta-profile"><div className="insta-avatar">{restaurant.logo ? <img src={restaurant.logo} alt="Logotipo do estabelecimento" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}}/> : (restaurant.instagramName || restaurant.name || 'I').slice(0, 1).toUpperCase()}</div>
      <div><strong>{restaurant.instagramName || restaurant.name}</strong><p>{restaurant.instagramBio || 'Acompanhe nossas novidades e bastidores.'}</p></div></div>
      <div className="insta-link">instagram.com/{handle}</div>
      <div className="insta-actions"><button onClick={() => setConfirm(true)}>Seguir</button><button onClick={() => setConfirm(true)}>Ver perfil</button></div>
    </> : <>
      <div className="insta-confirm-icon">↗</div><h3>Abrir o Instagram?</h3>
      <p>Você poderá voltar ao cardápio depois.</p>
      <div className="insta-actions"><button onClick={() => setConfirm(false)}>Voltar</button><button onClick={() => { window.open(url, '_blank', 'noopener,noreferrer'); setConfirm(false); }}>Continuar</button></div>
    </>}
  </div>;
}

// A sessão WebXR é pedida no clique (gesto do usuário). O overlay DOM é criado antes disso.
function ARSession({ product, overlay, sessionP, onClose, economy, onAdd, restaurant }) {
  const hostRef = useRef(null);
  const actions = useRef({});
  const [light, setLight] = useState('Luz padrão');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [status, setStatus] = useState('Abrindo câmera…');
  const [placed, setPlaced] = useState(false);
  const addRef = useRef(onAdd);
  addRef.current = onAdd;
  const [tooClose, setTooClose] = useState(false);
  const [ask, setAsk] = useState(false);
  const [socialShown, setSocialShown] = useState(false);
  const socialRef = useRef(null);

  useEffect(() => {
    let destroyed = false, session = null, renderer = null, xrLight = null, anchor = null;
    let hitTestSource = null, viewerSpace = null, hitCandidate = null, controller = null, onSelect = null, model = null;
    let last = '';
    const say = (v) => { if (!destroyed && v !== last) { last = v; setStatus(v); } };
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const placement = new THREE.Group();
    placement.matrixAutoUpdate = false;
    placement.visible = false;
    scene.add(placement);
    const pusher = new THREE.Group();
    placement.add(pusher);
    const fallback = createFallbackLights(scene, 'ar');


    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.078, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xc6e47b, side: THREE.DoubleSide, toneMapped: false })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    const hitMatrix = new THREE.Matrix4();
    const surfaceRotation = new THREE.Quaternion();
    const surfaceUp = new THREE.Vector3();
    const camPos = new THREE.Vector3(), dishPos = new THREE.Vector3();
    let dwellStart = 0, promptShown = false, nearNow = false;
    let stableFrames = 0, hasSmoothed = false;
    let nextSocial = 0, socialUntil = 0, socialOn = false, socialVariant = 0;
    const smoothPos = new THREE.Vector3(), observedPos = new THREE.Vector3();
    const smoothQuat = new THREE.Quaternion(), observedQuat = new THREE.Quaternion();
    const socialWorld = new THREE.Vector3(), socialClip = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);

    const makeHitSource = async () => {
      hitTestSource?.cancel?.();
      hitTestSource = null;
      hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    };
    // Recalcular: descarta a superfície fixada e a âncora, e refaz o hit-test do zero.
    actions.current.recalc = async () => {
      if (!session) return;
      anchor?.delete?.();
      anchor = null;
      hitCandidate = null;
      placement.visible = false;
      reticle.visible = false;
      setPlaced(false);
      pusher.position.set(0, 0, 0);
      dwellStart = 0; stableFrames = 0; hasSmoothed = false; socialOn = false; setSocialShown(false);
      try { await makeHitSource(); } catch { /* o loop continua tentando */ }
      say('Superfície recalculada. Aponte para a mesa.');
    };

    const init = async () => {
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
        configureRenderer(renderer);
        if (economy) renderer.setPixelRatio(1);
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        renderer.xr.setReferenceSpaceType('local');
        hostRef.current.appendChild(renderer.domElement);
        xrLight = new XREstimatedLight(renderer, !economy);
        xrLight.addEventListener('estimationstart', () => {
          if (destroyed) return;
          fallback.visible = false;
          scene.add(xrLight);
          scene.environment = xrLight.environment || null;
          setLight('Luz ambiente estimada ✓');
        });
        xrLight.addEventListener('estimationend', () => {
          scene.remove(xrLight);
          scene.environment = null;
          fallback.visible = true;
          if (!destroyed) setLight('Luz padrão');
        });
        model = await loadProduct(product);
        if (destroyed) { disposeObject(model); return; }
        pusher.add(createContactShadow(product.diameter), model);

        session = await sessionP;
        if (destroyed) { await session.end().catch(() => {}); return; }
        session.addEventListener('end', () => { if (!destroyed) closeRef.current(); }, { once: true });
        await renderer.xr.setSession(session);
        viewerSpace = await session.requestReferenceSpace('viewer');
        await makeHitSource();

        controller = renderer.xr.getController(0);
        scene.add(controller);
        onSelect = async () => {
          if (placement.visible || !reticle.visible || !hitCandidate || stableFrames < 6) return;
          const hit = hitCandidate;
          placement.matrix.copy(reticle.matrix);
          placement.visible = true;
          reticle.visible = false;
          setPlaced(true);
          say('Prato fixado na superfície. Caminhe ao redor para observar.');
          nextSocial = performance.now() + 11500;
          if (typeof hit.createAnchor === 'function') {
            try {
              const created = await hit.createAnchor();
              if (destroyed || !placement.visible) { created.delete?.(); return; }
              anchor = created;
            } catch { /* sem âncora: a posição fica fixa na sessão */ }
          }
        };
        controller.addEventListener('select', onSelect);

        let tick = 0;
        renderer.setAnimationLoop((_, frame) => {
          if (economy && tick++ % 2) return;
          if (frame) {
            const ref = renderer.xr.getReferenceSpace();
            if (ref) {
              if (placement.visible && anchor) {
                const pose = frame.getPose(anchor.anchorSpace, ref);
                if (pose) placement.matrix.fromArray(pose.transform.matrix);
              }
              if (!placement.visible && hitTestSource) {
                reticle.visible = false;
                hitCandidate = null;
                for (const hit of frame.getHitTestResults(hitTestSource)) {
                  const pose = hit.getPose(ref);
                  if (!pose) continue;
                  hitMatrix.fromArray(pose.transform.matrix);
                  surfaceRotation.setFromRotationMatrix(hitMatrix);
                  surfaceUp.set(0, 1, 0).applyQuaternion(surfaceRotation);
                  if (surfaceUp.y < 0.92) continue;
                  observedPos.setFromMatrixPosition(hitMatrix);
                  observedQuat.setFromRotationMatrix(hitMatrix);
                  if (!hasSmoothed || smoothPos.distanceTo(observedPos) > 0.14) {
                    smoothPos.copy(observedPos);
                    smoothQuat.copy(observedQuat);
                    stableFrames = 1;
                    hasSmoothed = true;
                  } else {
                    const delta = smoothPos.distanceTo(observedPos);
                    stableFrames = delta < 0.035 ? Math.min(20, stableFrames + 1) : 0;
                    smoothPos.lerp(observedPos, 0.19);
                    smoothQuat.slerp(observedQuat, 0.16);
                  }
                  reticle.matrix.compose(smoothPos, smoothQuat, one);
                  reticle.visible = stableFrames >= 6;
                  hitCandidate = hit;
                  break;
                }
                if (!hitCandidate) { stableFrames = 0; hasSmoothed = false; }
                say(reticle.visible ? 'Superfície estável ✓ Toque na mesa para fixar.' : hitCandidate ? 'Confirmando a superfície… mantenha o celular estável.' : 'Mova o celular devagar até uma mesa bem iluminada.');
              }
            }
            if (placement.visible && ref) {
              const vp = frame.getViewerPose(ref);
              if (vp) {
                const t = vp.transform.position;
                camPos.set(t.x, t.y, t.z);
                dishPos.setFromMatrixPosition(placement.matrix);
                const dist = camPos.distanceTo(dishPos);
                // Nunca mova o prato em função da distância: a âncora deve ficar no local real.
                // Alerta visual e convite ao carrinho.
                const near = dist < ALERT_DIST;
                if (near !== nearNow) { nearNow = near; setTooClose(near); }
                const time = performance.now();
                if (restaurant?.instagram && !near && !promptShown && time > nextSocial && !socialOn) {
                  socialOn = true;
                  socialVariant++;
                  socialUntil = time + 8000;
                  setSocialShown(true);
                }
                if (socialOn && (time > socialUntil || near)) {
                  socialOn = false;
                  nextSocial = time + 28000 + Math.random() * 18000;
                  setSocialShown(false);
                }
                if (socialOn && socialRef.current) {
                  const xrCam = renderer.xr.getCamera(camera);
                  const renderCam = xrCam.cameras?.[0] || xrCam;
                  socialWorld.set(socialVariant % 2 ? product.diameter * 0.90 : 0, product.diameter * (socialVariant % 2 ? 0.85 : 1.35), 0).applyMatrix4(placement.matrix);
                  socialClip.copy(socialWorld).project(renderCam);
                  const show = socialClip.z > -1 && socialClip.z < 1 && Math.abs(socialClip.x) < 0.94 && Math.abs(socialClip.y) < 0.86;
                  socialRef.current.style.opacity = show ? '1' : '0';
                  socialRef.current.style.left = `${Math.max(135, Math.min(window.innerWidth - 135, (socialClip.x + 1) * window.innerWidth / 2))}px`;
                  socialRef.current.style.top = `${Math.max(100, Math.min(window.innerHeight - 180, (1 - socialClip.y) * window.innerHeight / 2))}px`;
                }
                if (near && !promptShown) {
                  const now = performance.now();
                  if (!dwellStart) dwellStart = now;
                  if (now - dwellStart > 1500) { promptShown = true; setAsk(true); }
                } else if (!near) {
                  dwellStart = 0;
                }
              }
            }
          }
          renderer.render(scene, camera);
        });
      } catch (err) {
        say('Não foi possível abrir a AR: ' + (err.message || err));
      }
    };
    init();

    const onResize = () => renderer?.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => {
      destroyed = true;
      window.removeEventListener('resize', onResize);
      actions.current.recalc = null;
      renderer?.setAnimationLoop(null);
      if (controller && onSelect) controller.removeEventListener('select', onSelect);
      hitTestSource?.cancel?.();
      anchor?.delete?.();
      session?.end?.().catch(() => {});
      xrLight?.dispose?.();
      scene.environment = null;
      disposeObject(model);
      disposeObject(reticle);
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [product, overlay, sessionP, economy, restaurant]);

  return createPortal(<>
    <div className="ar-canvas" ref={hostRef} />
    <div className="ar-top">
      <button className="ghost" onClick={onClose} aria-label="Fechar AR">Voltar</button>
      <div><strong>{product.name}</strong><span>{light}</span></div>
    </div>
    <div className="ar-bottom">
      <p aria-live="polite">{status}</p>
      {placed && <p className="hint">Prato fixado. Circule ao redor para ver de todos os lados.</p>}
      <button className="ar-btn" onClick={() => actions.current.recalc?.()}>Recalcular superfície</button>
    </div>
    {Boolean(restaurant?.instagram) && <div ref={socialRef} className="ar-social-position" style={{display: socialShown && !ask ? 'block' : 'none'}}><InstagramCard restaurant={restaurant} small /></div>}
    {tooClose && !ask && <div className="ar-alert" role="alert">Muito perto. Afaste o celular do prato.</div>}
    {ask && <div className="ar-ask" role="dialog" aria-label="Adicionar ao carrinho">
      <p>{product.prompt}</p>
      <button className="ar-btn" onClick={() => { addRef.current?.(product.id); setAsk(false); setStatus('Adicionado ao carrinho ✓'); }}>Adicionar ao carrinho</button>
      <button className="ar-ghost" onClick={() => setAsk(false)}>Agora não</button>
    </div>}
  </>, overlay);
}

export function Menu({ restaurant = RESTAURANT, products = PRODUCTS, categories = CATEGORIES }) {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('verde-theme') || 'dark'; } catch { return 'dark'; } });
  const [economy, setEconomy] = useState(() => { try { return localStorage.getItem('verde-luz') === 'economica'; } catch { return false; } });
  const [cat, setCat] = useState('Todos');
  const [openId, setOpenId] = useState(null);
  const [mode, setMode] = useState('3d');
  const [qty, setQty] = useState(1);
  const [sheet, setSheet] = useState(null);
  const [cart, setCart] = useState({});
  const [ar, setAR] = useState(null);
  const [viewError, setViewError] = useState('');
  const onViewError = useCallback((m) => setViewError(m), []);
  const closeAR = useCallback(() => setAR(null), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('verde-theme', theme); } catch { /* sem armazenamento */ }
  }, [theme]);
  useEffect(() => {
    try { localStorage.setItem('verde-luz', economy ? 'economica' : 'alta'); } catch { /* sem armazenamento */ }
  }, [economy]);
  useEffect(() => {
    if (!ar) return;
    const overlay = ar.overlay;
    return () => overlay.remove();
  }, [ar]);

  const visibleProducts = products.filter((p) => p.active !== false);
  const product = visibleProducts.find((p) => p.id === openId);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = visibleProducts.reduce((s, p) => s + (cart[p.id] || 0) * p.price, 0);
  const incItem = useCallback((id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 })), []);
  const setItemQty = (id, n) => setCart((c) => { const x = { ...c }; if (n <= 0) delete x[id]; else x[id] = n; return x; });

  const openItem = (p) => { setOpenId(p.id); setMode('3d'); setQty(1); setViewError(''); window.scrollTo(0, 0); };

  // Chamado direto no clique: cria o overlay e pede a sessão AR no mesmo gesto, sem tela intermediária.
  const startAR = () => {
    const overlay = document.createElement('div');
    overlay.className = 'ar-screen';
    document.body.appendChild(overlay);
    let sessionP;
    if (!window.isSecureContext || !navigator.xr) {
      sessionP = Promise.reject(new Error('AR exige Chrome Android compatível, HTTPS ou localhost.'));
    } else {
      sessionP = navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['local-floor', 'anchors', 'light-estimation', 'dom-overlay'],
        domOverlay: { root: overlay },
      });
    }
    sessionP.catch(() => {});
    setAR({ product, overlay, sessionP });
  };

  const sheetCart = (
    <>
      <h2>Carrinho</h2>
      {count ? <ul className="cart-list">{visibleProducts.filter((p) => cart[p.id]).map((p) => (
        <li key={p.id}>
          <div><strong>{p.name}</strong><small>{fmt(p.price)}</small></div>
          <div className="qty">
            <button onClick={() => setItemQty(p.id, cart[p.id] - 1)} aria-label={`Diminuir ${p.name}`}>−</button>
            <span>{cart[p.id]}</span>
            <button onClick={() => setItemQty(p.id, cart[p.id] + 1)} aria-label={`Aumentar ${p.name}`}>+</button>
          </div>
        </li>))}</ul> : <p className="muted">Seu carrinho está vazio.</p>}
      <div className="total"><span>Total</span><strong>{fmt(total)}</strong></div>
      <label className="checkout-label">Seu nome (opcional)<input id="customer-name" placeholder="Ex.: Ana" maxLength={70} /></label>
      <label className="checkout-label">Observações (opcional)<textarea id="customer-notes" placeholder="Ex.: sem cebola, retirar no balcão…" maxLength={350} rows={2} /></label>
      <button className="btn primary" disabled={!count} onClick={() => {
        const phone = String(restaurant.whatsapp || '').replace(/\D/g, '');
        if (phone.length < 12 || phone.length > 13 || !phone.startsWith('55')) { alert('O restaurante ainda não configurou um WhatsApp válido com DDI 55.'); return; }
        const name = document.getElementById('customer-name')?.value.trim();
        const notes = document.getElementById('customer-notes')?.value.trim();
        const lines = visibleProducts.filter((p) => cart[p.id]).map((p) => `${cart[p.id]}x ${p.name} — ${fmt(p.price * cart[p.id])}`);
        const text = [`*Pedido — ${restaurant.name}*`, '', ...lines, '', `*Total: ${fmt(total)}*`, ...(name ? [`Nome: ${name}`] : []), ...(notes ? [`Observações: ${notes}`] : []), '', 'Olá! Gostaria de confirmar este pedido.'].join('\n');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      }}>Fazer pedido no WhatsApp</button>
      <p className="checkout-note">O pedido será preparado como mensagem no WhatsApp; o envio e a confirmação acontecem lá.</p>
    </>
  );
  const sheetSettings = (
    <>
      <h2>Configurações</h2>
      <div className="setting">
        <div><strong>Tema</strong><small>{theme === 'dark' ? 'Escuro' : 'Claro'}</small></div>
        <div className="seg2" role="group" aria-label="Tema">
          <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}>Escuro</button>
          <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')} aria-pressed={theme === 'light'}>Claro</button>
        </div>
      </div>
      <div className="setting">
        <div><strong>Qualidade da luz na AR</strong><small>{economy ? 'Econômica: 30 fps e menos processamento' : 'Alta: iluminação completa do ambiente'}</small></div>
        <div className="seg2" role="group" aria-label="Qualidade da luz">
          <button className={!economy ? 'on' : ''} onClick={() => setEconomy(false)} aria-pressed={!economy}>Alta</button>
          <button className={economy ? 'on' : ''} onClick={() => setEconomy(true)} aria-pressed={economy}>Econômica</button>
        </div>
      </div>
    </>
  );

  return <div className="app">
    <header className="topbar">
      <button className="icon-btn" onClick={() => setSheet('settings')} aria-label="Configurações"><I d={ICON.gear} /></button>
      <span className="top-title">{restaurant.name}</span>
      <button className="icon-btn" onClick={() => setSheet('cart')} aria-label={`Carrinho, ${count} itens`}>
        <I d={ICON.cart} />{count > 0 && <b>{count}</b>}
      </button>
    </header>

    <section className="hero">
      <div className="cover" role="img" aria-label={restaurant.name}
        style={{ backgroundImage: `url(${restaurant.cover}), linear-gradient(135deg,#2e3d2a,#121a0f)` }} />
      <h1>{restaurant.name}</h1>
      {restaurant.niche && <span style={{display:'block',fontSize:12,letterSpacing:1,fontWeight:700,opacity:.7,marginTop:5}}>{restaurant.niche}</span>}
      <p>{restaurant.tagline}</p>
      {restaurant.instagram && <div className="social-menu-link"><span>◎</span><a href={`https://www.instagram.com/${encodeURIComponent(restaurant.instagram.replace(/^@/, ''))}/`} target="_blank" rel="noopener noreferrer">Siga @{restaurant.instagram.replace(/^@/, '')}</a></div>}
    </section>

    <nav className="cats" aria-label="Categorias">
      {categories.map((c) => <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)} aria-pressed={c === cat}>{c}</button>)}
    </nav>

    <main className="menu">
      {categories.filter((c) => c !== 'Todos' && (cat === 'Todos' || cat === c)).map((c) => {
        const items = visibleProducts.filter((p) => p.cat === c);
        if (!items.length) return null;
        return <section key={c}>
          <h2>{c}</h2>
          {items.map((p) => <button key={p.id} className="row" onClick={() => openItem(p)}>
            <div className="row-info">
              <strong>{p.name}</strong>
              <p>{p.description}</p>
              <span className="price">{fmt(p.price)}</span>
              <small>{p.kcal} kcal</small>
            </div>
            <Photo p={p} className="thumb" />
          </button>)}
        </section>;
      })}
    </main>

    {product && <div className="item" role="dialog" aria-modal="true" aria-label={product.name}>
      <div className="item-bar">
        <button className="icon-btn" onClick={() => setOpenId(null)} aria-label="Voltar ao cardápio"><I d={ICON.back} /></button>
        <span>{product.cat}</span>
        <span className="spacer" />
      </div>
      <div className="item-body">
        <div className="media">
          {mode === '3d' && product.url
            ? <Viewer key={product.id} product={product} onError={onViewError} />
            : <Photo p={product} className="photo" />}
          <div className="seg" role="group" aria-label="Modo de visualização">
            {product.url && <button className={mode === '3d' ? 'on' : ''} onClick={() => setMode('3d')} aria-pressed={mode === '3d'}><I d={ICON.cube} />3D</button>}
            <button className={mode === 'photo' ? 'on' : ''} onClick={() => setMode('photo')} aria-pressed={mode === 'photo'}><I d={ICON.image} />Imagem</button>
          </div>
          {mode === '3d' && viewError && <p className="error">Erro ao carregar o modelo: {viewError}</p>}
        </div>
        <div className="info">
          <h1>{product.name}</h1>
          <p className="desc">{product.description}</p>
          <div className="facts">
            <div><small>Calorias</small><strong>{product.kcal} kcal</strong></div>
            <div><small>Preço unitário</small><strong>{fmt(product.price)}</strong></div>
          </div>
          <h3>Ingredientes</h3>
          <p className="ingr">{product.ingredients.join(', ')}.</p>
        </div>
      </div>
      <div className="item-actions">
        <div className="qty">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir quantidade">−</button>
          <span>{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} aria-label="Aumentar quantidade">+</button>
        </div>
        <button className="btn primary" onClick={() => { setItemQty(product.id, (cart[product.id] || 0) + qty); setOpenId(null); }}>
          Adicionar · {fmt(product.price * qty)}
        </button>
        {product.url ? <button className="btn outline ar-cta" onClick={startAR}><I d={ICON.ar} />Ver na minha mesa (AR)</button> : <p className="ar-wait">Modelo 3D/AR em preparação.</p>}
      </div>
    </div>}

    {ar && <ARSession key={ar.product.id} product={ar.product} overlay={ar.overlay} sessionP={ar.sessionP} onClose={closeAR} economy={economy} onAdd={incItem} restaurant={restaurant} />}

    {sheet && <div className="scrim" onClick={() => setSheet(null)}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        {sheet === 'cart' ? sheetCart : sheetSettings}
      </div>
    </div>}
  </div>;
}


