import * as THREE from 'three';

// Cards WebXR em metros: pertencem à mesma âncora do prato e NUNCA à tela.
// Todo texto vem dos produtos/restaurantes cadastrados no Realtime Database.
const price = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const clean = value => String(value || '').replace(/[\u0000-\u001f]/g, ' ').trim();

function rounded(ctx, x, y, w, h, radius) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
}
function drawWrapped(ctx, text, x, y, width, lineHeight, maxLines = 3) {
  const words = clean(text).split(/\s+/).filter(Boolean);
  let line = '', used = 0;
  while (words.length && used < maxLines) {
    let word = words.shift();
    while (ctx.measureText(word).width > width && word.length > 1) {
      words.unshift(word.slice(-1)); word = word.slice(0, -1);
    }
    const proposed = line ? `${line} ${word}` : word;
    if (ctx.measureText(proposed).width > width && line) {
      ctx.fillText(line, x, y + used * lineHeight);
      used++; line = word;
    } else { line = proposed; }
  }
  if (line && used < maxLines) ctx.fillText(line + (words.length ? '…' : ''), x, y + used * lineHeight);
}
function baseCanvas(draw, width, height, worldW, worldH) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), material);
  mesh.renderOrder = 2;
  return { canvas, ctx, mesh, texture, redraw: () => { draw(ctx); texture.needsUpdate = true; } };
}

export function createDishSpatialCard(product) {
  const W = 512, H = 690;
  const category = clean(product.cat) || 'Outros';
  let photo = null, disposed = false;
  const draw = (ctx) => {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.shadowColor = '#1e271f58'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 14;
    rounded(ctx, 10, 10, W - 20, H - 20, 42); ctx.fillStyle = '#637064'; ctx.fill();
    ctx.restore();
    ctx.save(); rounded(ctx, 10, 10, W - 20, H - 20, 42); ctx.clip();
    ctx.fillStyle = '#657269'; ctx.fillRect(10, 10, W - 20, H - 20);
    if (photo) {
      // Cobre a área superior mantendo a imagem proporcional, como object-fit: cover.
      const imageH = 440, scale = Math.max((W - 20) / photo.width, imageH / photo.height);
      const sw = photo.width * scale, sh = photo.height * scale;
      ctx.drawImage(photo, 10 + (W - 20 - sw) / 2, 10 + (imageH - sh) / 2, sw, sh);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, W, 440);
      gradient.addColorStop(0, '#a2aa95'); gradient.addColorStop(1, '#4e6353');
      ctx.fillStyle = gradient; ctx.fillRect(10, 10, W - 20, 440);
      ctx.textAlign = 'center'; ctx.font = '700 76px sans-serif'; ctx.fillStyle = '#ffffffab';
      ctx.fillText('✦', W / 2, 250); ctx.textAlign = 'left';
    }
    const shade = ctx.createLinearGradient(0, 150, 0, H);
    shade.addColorStop(0, '#202a2000'); shade.addColorStop(.42, '#344535ae'); shade.addColorStop(1, '#536555');
    ctx.fillStyle = shade; ctx.fillRect(10, 150, W - 20, H - 150);

    // Substitui a etiqueta "Veg" da referência pela categoria cadastrada.
    ctx.fillStyle = '#efedd7e9'; rounded(ctx, 36, 38, Math.min(360, Math.max(125, category.length * 16 + 48)), 54, 27); ctx.fill();
    ctx.fillStyle = '#2f4434'; ctx.font = '800 24px sans-serif';
    ctx.fillText(category.slice(0, 24), 58, 74);
    ctx.shadowColor = '#1c251b'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff'; ctx.font = '800 48px sans-serif';
    drawWrapped(ctx, clean(product.name) || 'Produto', 40, 460, W - 80, 55, 2);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#f1f3ec'; ctx.font = '500 24px sans-serif';
    drawWrapped(ctx, product.description || 'Conheça este prato.', 40, 558, W - 80, 32, 2);
    ctx.fillStyle = '#fff'; rounded(ctx, 30, H - 100, W - 60, 70, 34); ctx.fill();
    ctx.fillStyle = '#29342e'; ctx.font = '800 27px sans-serif'; ctx.fillText('Adicionar +', 54, H - 56);
    ctx.textAlign = 'right'; ctx.font = '800 24px sans-serif'; ctx.fillText(price(product.price), W - 56, H - 56);
    ctx.restore();
  };
  const card = baseCanvas(draw, W, H, 0.23, 0.31);
  if (product.photo && /^data:image\/|^https?:\/\//i.test(product.photo)) {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (disposed) return;
      // Evita enviar ao WebGL um canvas contaminado por imagem sem CORS.
      try {
        const test = document.createElement('canvas'); test.width = 2; test.height = 2;
        const t = test.getContext('2d'); t.drawImage(img, 0, 0, 2, 2); t.getImageData(0, 0, 1, 1);
        photo = img; card.redraw();
      } catch { /* deixa o gradiente no card */ }
    };
    img.onerror = () => {};
    img.src = product.photo;
  }
  return { mesh: card.mesh, dispose: () => { disposed = true; } };
}

export function createInstagramSpatialCard(restaurant) {
  const name = clean(restaurant.instagramName || restaurant.name || 'Estabelecimento');
  const handle = clean(restaurant.instagram).replace(/^@/, '').replace(/[^\w.]/g, '');
  const bio = clean(restaurant.instagramBio || 'Novidades e bastidores do nosso cardápio.');
  const draw = ctx => {
    const W = 512, H = 550;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.shadowColor = '#29152150'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#f9f7f3'; rounded(ctx, 10, 10, W - 20, H - 20, 42); ctx.fill();
    ctx.restore();
    const gradient = ctx.createLinearGradient(30, 25, W - 30, 140);
    gradient.addColorStop(0, '#cd477a'); gradient.addColorStop(.55, '#8c55a6'); gradient.addColorStop(1, '#e7a34e');
    ctx.fillStyle = gradient; rounded(ctx, 32, 34, W - 64, 9, 5); ctx.fill();
    ctx.fillStyle = '#312b33'; ctx.font = '800 36px sans-serif'; ctx.fillText('◎ Instagram', 35, 103);
    ctx.fillStyle = '#f4e6eb'; rounded(ctx, 32, 142, 90, 90, 45); ctx.fill();
    ctx.fillStyle = '#b93b68'; ctx.textAlign = 'center'; ctx.font = '800 54px sans-serif';
    ctx.fillText(name.slice(0, 1).toUpperCase(), 77, 205); ctx.textAlign = 'left';
    ctx.font = '800 33px sans-serif'; ctx.fillStyle = '#312b33';
    drawWrapped(ctx, name, 144, 186, 330, 39, 2);
    ctx.fillStyle = '#86516d'; ctx.font = '600 27px sans-serif'; ctx.fillText(`@${handle}`.slice(0, 26), 35, 288);
    ctx.fillStyle = '#695b66'; ctx.font = '500 26px sans-serif';
    drawWrapped(ctx, bio, 35, 344, W - 70, 34, 3);
    const cta = ctx.createLinearGradient(35, 0, W - 35, 0);
    cta.addColorStop(0, '#c72b79'); cta.addColorStop(1, '#e27942');
    ctx.fillStyle = cta; rounded(ctx, 32, 439, W - 64, 75, 20); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '800 30px sans-serif';
    ctx.fillText('VER PERFIL  ↗', W / 2, 487);
  };
  const card = baseCanvas(draw, 512, 550, 0.19, 0.205);
  return { mesh: card.mesh, handle };
}

// O ângulo é calculado SOMENTE ao fixar o prato, não a cada frame.
// Assim, nenhum card acompanha ou gira em direção à câmera depois.
export function faceCardOnce(card, cameraWorldPosition, placementMatrix) {
  const localCamera = cameraWorldPosition.clone().applyMatrix4(placementMatrix.clone().invert());
  card.rotation.y = Math.atan2(localCamera.x - card.position.x, localCamera.z - card.position.z);
}
