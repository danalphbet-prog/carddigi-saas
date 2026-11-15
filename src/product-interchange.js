// Mezzira: interoperabilidade de produtos. Sem bibliotecas, rede ou execução de código importado.
export const PRODUCT_FORMAT_VERSION = 1;
export const MAX_PRODUCTS_PER_FILE = 100;
export const MAX_PRODUCT_FILE_BYTES = 30 * 1024 * 1024;
export const PRODUCT_KEYS = Object.freeze([
  'name', 'description', 'cat', 'price', 'prompt', 'photo', 'referencePhotos',
  'ingredients', 'kcal', 'diameter', 'roughness', 'emoji', 'stock', 'active', 'modelId'
]);

export const EXAMPLE_PRODUCT = Object.freeze({
  name: 'Pizza Margherita',
  description: 'Massa artesanal, molho de tomate, mussarela e manjericão.',
  cat: 'Pizzas',
  price: 49.90,
  prompt: 'Quer adicionar esta pizza ao pedido?',
  photo: '',
  referencePhotos: [],
  ingredients: ['Massa artesanal', 'Molho de tomate', 'Mussarela', 'Manjericão'],
  kcal: 720,
  diameter: 0.30,
  roughness: 0.76,
  emoji: '🍕',
  stock: null,
  active: true,
  modelId: ''
});

const defaults = Object.freeze({
  name: '', description: '', cat: 'Pratos', price: 0,
  prompt: 'Gostaria de adicionar ao pedido?', photo: '', referencePhotos: [],
  ingredients: [], kcal: 0, diameter: 0.22, roughness: 0.76,
  emoji: '🍽️', stock: null, active: true, modelId: ''
});
const safeObject = o => o && typeof o === 'object' && !Array.isArray(o);
const error = (message, index) => {throw new Error(index == null ? message : 'Produto ' + (index + 1) + ': ' + message);};
function textValue(value, max, name, index, required = false) {
  if (typeof value !== 'string' || value.length > max) error(name + ' deve ser texto com no máximo ' + max + ' caracteres.', index);
  const result = value.trim();
  if (required && !result) error(name + ' é obrigatório.', index);
  return result;
}
function numberValue(value, min, max, name, index, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    error(name + ' deve ser um número entre ' + min + ' e ' + max + '.', index);
  return value;
}
function safePhoto(value, index) {
  const image = textValue(value, 190000, 'Foto', index);
  if (image && !/^data:image\/(?:webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))
    error('Fotos devem ser WebP/JPEG em Base64, no formato data:image/webp;base64,... (ou vazias).', index);
  return image;
}

/** Campos seguem o contrato de api/lib/validation.js da V13.1. */
export function normalizeProduct(input, index = null) {
  if (!safeObject(input)) error('Cada produto deve ser um objeto.', index);
  const unknown = Object.keys(input).filter(k => !PRODUCT_KEYS.includes(k));
  if (unknown.length) error('Campo não reconhecido: ' + unknown.join(', '), index);
  const v = {...defaults, ...input};
  const out = {
    name: textValue(v.name, 120, 'name', index, true),
    description: textValue(v.description, 1200, 'description', index),
    cat: textValue(v.cat, 70, 'cat', index, true),
    price: numberValue(v.price, 0, 100000, 'price', index),
    prompt: textValue(v.prompt, 200, 'prompt', index),
    photo: safePhoto(v.photo, index),
    referencePhotos: [], ingredients: [],
    kcal: numberValue(v.kcal, 0, 100000, 'kcal', index, true),
    diameter: numberValue(v.diameter, 0.05, 2, 'diameter', index),
    roughness: numberValue(v.roughness, 0, 1, 'roughness', index),
    emoji: textValue(v.emoji, 10, 'emoji', index),
    stock: v.stock === null ? null : numberValue(v.stock, 0, 1000000, 'stock', index, true),
    active: v.active,
    modelId: textValue(v.modelId, 128, 'modelId', index)
  };
  if (typeof v.active !== 'boolean') error('active deve ser true ou false.', index);
  if (!Array.isArray(v.referencePhotos) || v.referencePhotos.length > 5) error('referencePhotos deve ter até 5 imagens.', index);
  out.referencePhotos = v.referencePhotos.map(x => safePhoto(x, index)).filter(Boolean);
  const ingredients = typeof v.ingredients === 'string' ? v.ingredients.split(/\r?\n/) : v.ingredients;
  if (!Array.isArray(ingredients) || ingredients.length > 25) error('ingredients deve ser lista de até 25 itens.', index);
  out.ingredients = ingredients.map(x => textValue(x, 90, 'Ingrediente', index)).filter(Boolean);
  // Arredondamento igual à API, mas reprova preços com mais de 2 decimais no arquivo.
  if (Math.abs(out.price * 100 - Math.round(out.price * 100)) > 1e-7) error('price admite no máximo duas casas decimais.', index);
  out.price = Math.round(out.price * 100) / 100;
  return out;
}

function validateCatalog(obj) {
  if (!safeObject(obj)) error('A raiz do arquivo deve ser um objeto.');
  if (obj.version !== PRODUCT_FORMAT_VERSION) error('Versão do arquivo incompatível; use version: 1.');
  if (obj.schema !== undefined && obj.schema !== 'mezzira.products') error('schema incompatível.');
  if (Object.keys(obj).some(k => !['schema', 'version', 'products'].includes(k))) error('A raiz aceita somente schema, version e products.');
  if (!Array.isArray(obj.products) || !obj.products.length || obj.products.length > MAX_PRODUCTS_PER_FILE)
    error('Inclua entre 1 e ' + MAX_PRODUCTS_PER_FILE + ' produtos.');
  return obj.products.map((p, i) => normalizeProduct(p, i));
}

const XML_SCALARS = PRODUCT_KEYS.filter(k => k !== 'ingredients' && k !== 'referencePhotos');
const xmlEscape = value => String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const xmlElem = (key, value, indent) => indent + '<' + key + '>' + xmlEscape(value) + '</' + key + '>';
function productXml(product) {
  const lines = ['    <product>'];
  for (const key of PRODUCT_KEYS) {
    if (key === 'ingredients' || key === 'referencePhotos') {
      const tag = key === 'ingredients' ? 'item' : 'url';
      lines.push('      <' + key + '>');
      for (const value of product[key]) lines.push(xmlElem(tag, value, '        '));
      lines.push('      </' + key + '>');
    } else lines.push(xmlElem(key, product[key] === null ? '' : product[key], '      '));
  }
  lines.push('    </product>');
  return lines.join('\n');
}

export function serializeProducts(products, format = 'json') {
  if (!Array.isArray(products) || !products.length || products.length > MAX_PRODUCTS_PER_FILE)
    error('A exportação aceita entre 1 e ' + MAX_PRODUCTS_PER_FILE + ' produtos por arquivo.');
  const normalized = products.map((p, i) => normalizeProduct(Object.fromEntries(PRODUCT_KEYS.filter(k => Object.hasOwn(p, k)).map(k => [k, p[k]])), i));
  if (format === 'json') return JSON.stringify({schema: 'mezzira.products', version: 1, products: normalized}, null, 2) + '\n';
  if (format === 'xml') return '<?xml version="1.0" encoding="UTF-8"?>\n<mezzira version="1">\n  <products>\n' + normalized.map(productXml).join('\n') + '\n  </products>\n</mezzira>\n';
  error('Formato inválido: use json ou xml.');
}

function childElements(element) {return Array.from(element.children || []);}
function onlyChild(parent, tag, required = true) {
  const matches = childElements(parent).filter(n => n.tagName === tag);
  if (matches.length > 1 || (required && matches.length !== 1)) error('XML inválido: tag ' + tag + ' duplicada ou ausente.');
  return matches[0] || null;
}
function textOf(element) {
  if (childElements(element).length) error('XML inválido: campos de texto não podem conter outras tags.');
  return element.textContent || '';
}
function parseXmlProduct(element) {
  if (element.tagName !== 'product') error('XML inválido: esperado product.');
  const obj = {};
  for (const node of childElements(element)) {
    const key = node.tagName;
    if (!PRODUCT_KEYS.includes(key) || Object.hasOwn(obj, key)) error('Tag XML inválida ou duplicada: ' + key);
    if (key === 'ingredients' || key === 'referencePhotos') {
      const tag = key === 'ingredients' ? 'item' : 'url';
      obj[key] = childElements(node).map(n => {
        if (n.tagName !== tag) error('Tag inválida na lista ' + key + ': ' + n.tagName);
        return textOf(n);
      });
    } else {
      const raw = textOf(node).trim();
      if (['price', 'kcal', 'diameter', 'roughness'].includes(key)) obj[key] = raw === '' ? NaN : Number(raw);
      else if (key === 'stock') obj[key] = raw === '' ? null : Number(raw);
      else if (key === 'active') obj[key] = raw === 'true' ? true : raw === 'false' ? false : raw;
      else obj[key] = raw;
    }
  }
  return obj;
}
export function parseProducts(text, format) {
  if (typeof text !== 'string' || !text.trim()) error('Arquivo vazio.');
  if (text.length > MAX_PRODUCT_FILE_BYTES) error('Arquivo muito grande (limite de 30 MB).');
  if (format === 'json') {
    let obj;
    try {obj = JSON.parse(text);} catch {error('JSON inválido: confira vírgulas, chaves e aspas.');}
    return validateCatalog(obj);
  }
  if (format !== 'xml') error('Aceito somente JSON e XML.');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text)) error('XML com DOCTYPE ou entidades externas não é permitido.');
  if (typeof DOMParser === 'undefined') error('Este navegador não suporta leitura de XML.');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) error('XML inválido.');
  const root = doc.documentElement;
  if (!root || root.tagName !== 'mezzira' || root.getAttribute('version') !== '1') error('O XML deve usar <mezzira version="1">.');
  const parent = onlyChild(root, 'products');
  if (childElements(root).length !== 1) error('XML inválido: raiz aceita somente products.');
  const entries = childElements(parent);
  if (entries.some(n => n.tagName !== 'product')) error('XML inválido: products aceita somente product.');
  return validateCatalog({version: 1, products: entries.map(parseXmlProduct)});
}

export async function readProductsFile(file) {
  if (!file || !/\.(?:json|xml)$/i.test(file.name)) error('Escolha um arquivo .json ou .xml.');
  if (file.size > MAX_PRODUCT_FILE_BYTES) error('Arquivo muito grande (limite de 30 MB).');
  return parseProducts(await file.text(), /\.xml$/i.test(file.name) ? 'xml' : 'json');
}
export function downloadProducts(products, format, filename) {
  const content = serializeProducts(products, format);
  const blob = new Blob([content], {type: format === 'xml' ? 'application/xml;charset=utf-8' : 'application/json;charset=utf-8'});
  const uri = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = uri; a.download = filename || 'mezzira-produtos.' + format;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(uri), 2000);
}
export function productKey(p) {return String(p.name || '').trim().normalize('NFKC').toLocaleLowerCase('pt-BR') + '\u0000' + String(p.cat || 'Pratos').trim().normalize('NFKC').toLocaleLowerCase('pt-BR');}
