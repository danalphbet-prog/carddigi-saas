// Preparação de imagens para Firebase Realtime Database, sem Firebase Storage.
// O processamento acontece no navegador antes da gravação do JSON.
export const PHOTO_SIDE = 512;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_BASE64_CHARS = 190_000; // ~142 KB de dados compactados, incluindo prefixo
export const MAX_REFERENCE_PHOTOS = 5;

export function isPhotoDataUrl(value) {
  return typeof value === 'string' && value.length <= MAX_BASE64_CHARS
    && /^data:image\/(?:webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function loadPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(Error('Não foi possível ler a imagem.')); };
    img.src = url;
  });
}

// Ajusta sem deformar ou cortar o alimento. Os espaços são preenchidos
// com fundo neutro para manter exatamente 512 × 512 pixels.
export async function preparePhoto(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type))
    throw Error('Escolha uma fotografia JPG, PNG ou WebP.');
  if (file.size > MAX_UPLOAD_BYTES) throw Error('A fotografia original deve ter no máximo 10 MB.');
  const img = await loadPhoto(file);
  if (!img.naturalWidth || !img.naturalHeight) throw Error('Imagem sem dimensões válidas.');
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIDE; canvas.height = PHOTO_SIDE;
  const context = canvas.getContext('2d', {alpha:false});
  if (!context) throw Error('Este navegador não suporta a conversão da imagem.');
  context.fillStyle = '#f7f5f1';
  context.fillRect(0, 0, PHOTO_SIDE, PHOTO_SIDE);
  const ratio = Math.min(PHOTO_SIDE / img.naturalWidth, PHOTO_SIDE / img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(img, Math.floor((PHOTO_SIDE-w)/2), Math.floor((PHOTO_SIDE-h)/2), w, h);
  // Reduz a qualidade progressivamente se a imagem ultrapassar o limite
  // imposto pelas regras do Realtime Database.
  for (const quality of [.82, .72, .62, .52, .42, .32]) {
    const url = canvas.toDataURL('image/webp', quality);
    if (url.startsWith('data:image/webp;base64,') && isPhotoDataUrl(url)) {
      return {url, width:PHOTO_SIDE, height:PHOTO_SIDE, format:'webp',
        bytes: Math.floor((url.length-url.indexOf(',')-1)*.75)};
    }
  }
  throw Error('Foto ainda muito grande depois da compressão. Use uma imagem com menos detalhes.');
}
