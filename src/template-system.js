/** MEZZIRA V11 — registro de layouts, não renderizações inventadas. */
export const TEMPLATE_FAMILIES = Object.freeze([
  {kind:'grid',name:'Grades',capacity:20},
  {kind:'list',name:'Listas',capacity:20},
  {kind:'detail',name:'Detalhes do produto',capacity:20}
]);
export const TEMPLATE_SLOTS = Object.freeze(TEMPLATE_FAMILIES.flatMap(({kind,capacity}) =>
  Array.from({length:capacity},(_,i)=>Object.freeze({id:`${kind}-${String(i+1).padStart(2,'0')}`,kind,status:'aguardando-layout'}))
));
export const INSTALLED_TEMPLATES = Object.freeze([
  {id:'grid-classico',kind:'grid',name:'Grade atual Savor',status:'installed'},
  {id:'detail-classico',kind:'detail',name:'Detalhe atual Savor',status:'installed'}
]);
const installed = new Map(INSTALLED_TEMPLATES.map(item=>[item.id,item]));
export function resolveTemplates(restaurant={}) {
  const menu=installed.get(restaurant.menuTemplateId);
  const detail=installed.get(restaurant.productDetailTemplateId);
  return {
    menu: menu?.kind==='grid' ? menu.id : 'grid-classico',
    detail: detail?.kind==='detail' ? detail.id : 'detail-classico',
    categoriesSeparated: restaurant.menuCategoryGroups===true
  };
}
export function templateSlot(kind,index){
  return TEMPLATE_SLOTS.find(item=>item.kind===kind&&Number(item.id.slice(-2))===index)||null;
}
