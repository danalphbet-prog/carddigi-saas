// Estilos fechados: contraste de texto, fundo e ações é preservado.
export const MENU_PALETTES = Object.freeze([
  {id:'oliva',name:'Oliva & creme',accent:'#3e4a2b',cream:'#f7f2ea',cream2:'#efe7db',ink:'#251d17',muted:'#776a5c',onAccent:'#ffffff'},
  {id:'areia',name:'Areia & café',accent:'#755039',cream:'#fff9f0',cream2:'#eee1d1',ink:'#30231b',muted:'#76695f',onAccent:'#ffffff'},
  {id:'terracota',name:'Terracota',accent:'#9b3d2a',cream:'#fff6f1',cream2:'#f1dfd5',ink:'#32221e',muted:'#79675e',onAccent:'#ffffff'},
  {id:'oceano',name:'Oceano',accent:'#26536c',cream:'#f5f9fa',cream2:'#e3edf0',ink:'#1b2c35',muted:'#60727b',onAccent:'#ffffff'},
  {id:'grafite',name:'Grafite & sálvia',accent:'#41534b',cream:'#f8f9f4',cream2:'#e6eae1',ink:'#25322c',muted:'#64716a',onAccent:'#ffffff'}
]);
export const MENU_FONTS = Object.freeze([
  {id:'dm-sans',name:'DM Sans',css:"'DM Sans',sans-serif"},
  {id:'manrope',name:'Manrope',css:"Manrope,sans-serif"},
  {id:'poppins',name:'Poppins',css:"Poppins,sans-serif"},
  {id:'inter',name:'Inter',css:"Inter,sans-serif"},
  {id:'lora',name:'Lora',css:"Lora,serif"},
  {id:'playfair',name:'Playfair Display',css:"'Playfair Display',serif"}
]);
export function paletteById(id){return MENU_PALETTES.find(p=>p.id===id)||MENU_PALETTES[0]}
export function fontById(id){return MENU_FONTS.find(f=>f.id===id)||MENU_FONTS[0]}
export function clampCover(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):50}
export function checkoutIntro(value){return String(value||'Olá! Gostaria de confirmar meu pedido.').trim().slice(0,400)}
export function getPromotions(restaurant){
 if(restaurant?.promotionsEnabled!==true)return [];
 return (Array.isArray(restaurant.promotions)?restaurant.promotions:[]).filter(p=>p&&typeof p.title==='string'&&p.title.trim()).slice(0,5).map(p=>({title:p.title.slice(0,90),detail:String(p.detail||'').slice(0,180)}));
}
