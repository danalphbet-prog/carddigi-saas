import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XREstimatedLight } from 'three/addons/webxr/XREstimatedLight.js';
import { loadProduct, createFallbackLights, createContactShadow, disposeObject } from './scene.js';
import { createDishSpatialCard, createInstagramSpatialCard, faceCardOnce } from './ar-cards.js';
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
  const [socialConfirm, setSocialConfirm] = useState(false);

  useEffect(() => {
    let destroyed = false, session = null, renderer = null, xrLight = null, anchor = null;
    let hitTestSource = null, lowerHitTestSource = null, viewerSpace = null, hitCandidate = null, controller = null, onSelect = null, model = null;
    let dishCard = null, socialCard = null, modelReady = false;
    let last = '';
    const say = (v) => { if (!destroyed && v !== last) { last = v; setStatus(v); } };
    let closing = false;
    // Desativa a sessão ANTES de desmontar o overlay para evitar câmera presa.
    actions.current.exit = async () => {
      if (closing) return;
      closing = true;
      say('Fechando câmera…');
      if (session) {
        let timeoutId;
        try {
          await Promise.race([
            session.end().catch(() => {}),
            new Promise(resolve => { timeoutId = setTimeout(resolve, 1800); })
          ]);
        } finally { clearTimeout(timeoutId); }
      }
      if (!destroyed) closeRef.current();
    };
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
    let stableFrames = 0, hasSmoothed = false, lastSurfaceAt = 0;
    const MIN_HITS = 2; // Dispensa os seis quadros exigidos na versão anterior.
    const MIN_UP_DOT = 0.82; // Mesa quase horizontal, com pequena tolerância à inclinação.
    let nextSocial = 0, socialOn = false;
    const smoothPos = new THREE.Vector3(), observedPos = new THREE.Vector3();
    const smoothQuat = new THREE.Quaternion(), observedQuat = new THREE.Quaternion();
    const selectRay = new THREE.Raycaster();
    const selectOrigin = new THREE.Vector3(), selectDirection = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);

    const makeHitSource = async () => {
      hitTestSource?.cancel?.();
      lowerHitTestSource?.cancel?.();
      hitTestSource = null; lowerHitTestSource = null;
      hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      // Segundo raio levemente inclinado para baixo; permite mirar a mesa
      // sem inclinar tanto o telefone, se a implementação WebXR aceitar XRRay.
      if (typeof XRRay !== 'undefined') {
        try {
          lowerHitTestSource = await session.requestHitTestSource({
            space: viewerSpace,
            offsetRay: new XRRay({ x:0, y:0, z:0 },{ x:0, y:-0.22, z:-1, w:0 })
          });
        } catch { lowerHitTestSource = null; } // Mantém o raio principal.
      }
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
      dwellStart = 0; stableFrames = 0; hasSmoothed = false; lastSurfaceAt = 0; socialOn = false; if (socialCard) socialCard.mesh.visible = false; setSocialConfirm(false);
      try { await makeHitSource(); } catch { /* o loop continua tentando */ }
      say('Superfície recalculada. Aponte para a mesa.');
    };

    const startupNotice = setTimeout(() => {
      say('A câmera está demorando a abrir. Você pode tocar em Voltar e tentar novamente.');
    }, 12000);
    const beforeXRSelect = event => {
      if (event.target?.closest?.('button,a,input')) event.preventDefault();
    };
    overlay.addEventListener('beforexrselect', beforeXRSelect);

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
        // O usuário já pediu a sessão no clique. NÃO aguardar download do GLB
        // antes de instalar a câmera: isso causava o travamento em 'Abrindo câmera...'.
        session = await sessionP;
        if (destroyed) { await session.end().catch(() => {}); return; }
        session.addEventListener('end', () => { if (!destroyed) closeRef.current(); }, { once: true });
        await renderer.xr.setSession(session);
        clearTimeout(startupNotice);
        viewerSpace = await session.requestReferenceSpace('viewer');
        await makeHitSource();
        // Cards 3D pertencem à MESMA âncora do prato (nunca CSS sobre a câmera).
        dishCard = createDishSpatialCard(product);
        dishCard.mesh.position.set(Math.max(0.19, product.diameter * 0.60 + 0.12), 0.16, 0);
        pusher.add(dishCard.mesh);
        if (restaurant?.instagram) {
          socialCard = createInstagramSpatialCard(restaurant);
          socialCard.mesh.position.set(dishCard.mesh.position.x + 0.27, 0.18, 0);
          socialCard.mesh.visible = false;
          pusher.add(socialCard.mesh);
        }
        say('Câmera aberta. Preparando o modelo 3D…');
        loadProduct(product).then(loaded => {
          if (destroyed) { disposeObject(loaded); return; }
          model = loaded;
          pusher.add(createContactShadow(product.diameter), model);
          modelReady = true;
          say('Aponte para uma mesa iluminada.');
        }).catch(err => {
          if (destroyed) return;
          say('Falha ao carregar modelo 3D. Volte e tente novamente.');
          onEvent('error', 'Falha ao carregar GLB no AR: ' + (err?.message || 'erro desconhecido'));
        });

        controller = renderer.xr.getController(0);
        scene.add(controller);
        onSelect = async (event) => {
          if (placement.visible) {
            // Preferir o raio real do toque XR; câmera central só como fallback.
            const ref = renderer.xr.getReferenceSpace();
            const touchPose = ref && event?.frame && event?.inputSource?.targetRaySpace
              ? event.frame.getPose(event.inputSource.targetRaySpace, ref)
              : null;
            if (touchPose) {
              const t = touchPose.transform;
              selectOrigin.set(t.position.x, t.position.y, t.position.z);
              selectDirection.set(0, 0, -1).applyQuaternion(new THREE.Quaternion(
                t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w
              ));
            } else {
              const xrCam = renderer.xr.getCamera(camera);
              xrCam.updateMatrixWorld(true);
              xrCam.getWorldPosition(selectOrigin);
              xrCam.getWorldDirection(selectDirection);
            }
            selectRay.set(selectOrigin, selectDirection);
            if (socialCard?.mesh.visible && selectRay.intersectObject(socialCard.mesh, false).length) {
              setSocialConfirm(true);
            } else if (dishCard && selectRay.intersectObject(dishCard.mesh, false).length) {
              setAsk(true);
            }
            return;
          }
          if (!modelReady) { say('Carregando o prato 3D. Tente novamente em instantes.'); return; }
          if (!reticle.visible || !hitCandidate || stableFrames < MIN_HITS) return;
          const hit = hitCandidate;
          placement.matrix.copy(reticle.matrix);
          placement.visible = true;
          reticle.visible = false;
          setPlaced(true);
          say('Prato fixado na superfície. Caminhe ao redor para observar.');
          // Orientação é congelada uma única vez, no instante em que a âncora nasce.
          const xrCam = renderer.xr.getCamera(camera);
          xrCam.updateMatrixWorld(true);
          xrCam.getWorldPosition(selectOrigin);
          faceCardOnce(dishCard.mesh, selectOrigin, placement.matrix);
          if (socialCard) faceCardOnce(socialCard.mesh, selectOrigin, placement.matrix);
          nextSocial = performance.now() + 10000;
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
                const hits = [...frame.getHitTestResults(hitTestSource), ...(lowerHitTestSource ? frame.getHitTestResults(lowerHitTestSource) : [])];
                for (const hit of hits) {
                  const pose = hit.getPose(ref);
                  if (!pose) continue;
                  hitMatrix.fromArray(pose.transform.matrix);
                  surfaceRotation.setFromRotationMatrix(hitMatrix);
                  surfaceUp.set(0, 1, 0).applyQuaternion(surfaceRotation);
                  if (surfaceUp.y < MIN_UP_DOT) continue;
                  observedPos.setFromMatrixPosition(hitMatrix);
                  observedQuat.setFromRotationMatrix(hitMatrix);
                  if (!hasSmoothed || smoothPos.distanceTo(observedPos) > 0.14) {
                    smoothPos.copy(observedPos);
                    smoothQuat.copy(observedQuat);
                    stableFrames = 1;
                    hasSmoothed = true;
                  } else {
                    const delta = smoothPos.distanceTo(observedPos);
                    // Movimentos normais da mão não invalidam a mesa detectada.
                    stableFrames = delta < 0.15 ? Math.min(20, stableFrames + 1) : 1;
                    smoothPos.lerp(observedPos, 0.3);
                    smoothQuat.slerp(observedQuat, 0.25);
                  }
                  reticle.matrix.compose(smoothPos, smoothQuat, one);
                  reticle.visible = stableFrames >= MIN_HITS;
                  lastSurfaceAt = performance.now();
                  hitCandidate = hit;
                  break;
                }
                if (!hitCandidate) { stableFrames = 0; hasSmoothed = false; }
                if (modelReady) say(reticle.visible ? 'Mesa detectada ✓ Toque na tela para fixar o prato.' : hitCandidate ? 'Mesa encontrada! Segure por um instante…' : lastSurfaceAt && performance.now()-lastSurfaceAt<3500 ? 'Perdemos a mesa de vista. Aponte novamente.' : 'Aponte para uma mesa iluminada e mova o celular lentamente em um pequeno arco.');
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
                // Instagram aparece após alguns segundos e PERMANECE fixo no espaço.
                // Nunca ocultar porque saiu do campo de visão, nunca posicionar na tela.
                if (socialCard && !socialOn && time >= nextSocial) {
                  socialOn = true;
                  socialCard.mesh.visible = true;
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
        clearTimeout(startupNotice);
        say('Não foi possível abrir o AR: ' + (err.message || err) + '. Toque em Voltar para tentar novamente.');
        onEvent('error','Falha na realidade aumentada: '+(err?.message || 'Erro desconhecido')); 
      }
    };
    init();

    const onResize = () => renderer?.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => {
      destroyed = true;
      clearTimeout(startupNotice);
      overlay.removeEventListener('beforexrselect', beforeXRSelect);
      window.removeEventListener('resize', onResize);
      actions.current.recalc = null;
      actions.current.exit = null;
      renderer?.setAnimationLoop(null);
      if (controller && onSelect) controller.removeEventListener('select', onSelect);
      hitTestSource?.cancel?.();
      lowerHitTestSource?.cancel?.();
      anchor?.delete?.();
      if (session) session.end?.().catch(() => {});
      else Promise.resolve(sessionP).then(late => late?.end?.().catch(() => {})).catch(() => {});
      xrLight?.dispose?.();
      scene.environment = null;
      dishCard?.dispose?.();
      disposeObject(pusher); // modelos e texturas dos cards
      disposeObject(reticle);
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [product, overlay, sessionP, economy, restaurant]);

  return createPortal(<>
    <div className="ar-canvas" ref={hostRef} />
    <div className="ar-top">
      <button className="ghost" onClick={() => actions.current.exit?.()} aria-label="Fechar AR">Voltar</button>
      <div><strong>{product.name}</strong><span>{light}</span></div>
    </div>
    <div className="ar-bottom">
      <p aria-live="polite">{status}</p>
      {!placed&&<p className="hint">Dica: uma mesa com textura e boa iluminação é detectada mais facilmente. Evite balançar o celular.</p>}
      {placed && <p className="hint">Prato e informações fixos no ambiente. Aponte para os cards e toque para interagir.</p>}
      <button className="ar-btn" onClick={() => actions.current.recalc?.()}>Recalcular superfície</button>
    </div>
    {socialConfirm && <div className="ar-ask" role="dialog" aria-label="Abrir Instagram">
      <p>Abrir o Instagram de {restaurant?.name || 'este estabelecimento'}?</p>
      <button className="ar-btn" onClick={() => {
        const handle = String(restaurant?.instagram || '').replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '');
        if (handle) window.open(`https://www.instagram.com/${handle}/`, '_blank', 'noopener,noreferrer');
        setSocialConfirm(false);
      }}>Abrir Instagram ↗</button>
      <button className="ar-ghost" onClick={() => setSocialConfirm(false)}>Continuar no AR</button>
    </div>}
    {tooClose && !ask && <div className="ar-alert" role="alert">Muito perto. Afaste o celular do prato.</div>}
    {ask && <div className="ar-ask" role="dialog" aria-label="Adicionar ao carrinho">
      <p>{product.prompt}</p>
      <button className="ar-btn" onClick={() => { addRef.current?.(product.id); setAsk(false); setStatus('Adicionado ao carrinho ✓'); }}>Adicionar ao carrinho</button>
      <button className="ar-ghost" onClick={() => setAsk(false)}>Agora não</button>
    </div>}
  </>, overlay);
}


export {Viewer, ARSession};
