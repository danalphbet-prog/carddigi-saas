// Carrega o cardápio de public/catalogo.xml (estilo strings.xml de app Android).
// Os arrays exportados são preenchidos na abertura, antes da interface aparecer.
export const RESTAURANT = {};
export const CATEGORIES = [];
export const PRODUCTS = [];

const child = (el, tag) => el.querySelector(`:scope > ${tag}`)?.textContent.trim() ?? '';

export async function loadCatalog(url = '/catalogo.xml') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`não foi possível abrir ${url} (HTTP ${res.status})`);
  const doc = new DOMParser().parseFromString(await res.text(), 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('XML inválido: ' + parseError.textContent.slice(0, 200));

  const r = doc.querySelector('restaurante');
  Object.assign(RESTAURANT, {
    name: r.getAttribute('nome'),
    tagline: r.getAttribute('descricao'),
    cover: r.getAttribute('capa'),
  });

  const categoryName = {};
  CATEGORIES.length = 0;
  CATEGORIES.push('Todos');
  doc.querySelectorAll('categorias > categoria').forEach((c) => {
    const name = c.textContent.trim();
    categoryName[c.getAttribute('id')] = name;
    CATEGORIES.push(name);
  });

  PRODUCTS.length = 0;
  doc.querySelectorAll('produtos > produto').forEach((p) => {
    const id = p.getAttribute('id');
    const cat = categoryName[p.getAttribute('categoria')];
    if (!cat) throw new Error(`produto "${id}" usa uma categoria que não existe`);
    PRODUCTS.push({
      id,
      cat,
      name: child(p, 'nome'),
      description: child(p, 'descricao'),
      url: p.getAttribute('modelo'),
      diameter: Number(p.getAttribute('diametro')),
      roughness: Number(p.getAttribute('rugosidade')),
      price: Number(p.getAttribute('preco')),
      kcal: Number(p.getAttribute('kcal')),
      ingredients: [...p.querySelectorAll('ingredientes > ingrediente')].map((i) => i.textContent.trim()),
      prompt: p.getAttribute('convite'),
      emoji: p.getAttribute('emoji'),
      photo: p.getAttribute('foto'),
    });
  });
  return { RESTAURANT, CATEGORIES, PRODUCTS };
}
