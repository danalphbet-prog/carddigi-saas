import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XREstimatedLight } from 'three/addons/webxr/XREstimatedLight.js';
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
    }).catch(() => { if (!removed) onError('Não foi possível carregar a visualização 3D.'); });

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
function ARSession({ product, overlay, sessionP, onClose, economy, onAdd, restaurant, onEvent=()=>{} }) {
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
        onEvent('error','Falha na realidade aumentada: '+(err?.message || 'Erro desconhecido')); 
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


export {Viewer, ARSession};
