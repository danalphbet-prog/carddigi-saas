// Endereços públicos legíveis, sem exibir o identificador interno do banco.
export function slugBase(name) {
  return String(name || 'estabelecimento').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
    .slice(0,64).replace(/-+$/g,'') || 'estabelecimento';
}
export function randomCode(length=4) {
  const symbols = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = new Uint32Array(length);
  if (!globalThis.crypto?.getRandomValues) throw Error('O navegador não permite criar um endereço seguro.');
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, n => symbols[n % symbols.length]).join('');
}
export function makePublicSlug(name) {return `${slugBase(name)}-${randomCode()}`;}
export function publicMenuPath(restaurant) {
  return restaurant?.slug ? `/menu/${encodeURIComponent(restaurant.slug)}` : null;
}
export function isPublicSlug(value) {
  return /^[a-z0-9](?:[a-z0-9-]{0,64}[a-z0-9])?-[A-Z2-9]{4}$/.test(String(value || ''));
}
