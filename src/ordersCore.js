const clean=(value,max=160)=>String(value||'').trim().slice(0,max);
export function normalizeOrder(input) {
  const items=(input?.items||[]).slice(0,25).map(p=>({
    name:clean(p.name,90),
    quantity:Math.max(1,Math.min(50,Math.trunc(Number(p.quantity)||1))),
    price:Math.max(0,Math.min(100000,Number(p.price)||0)),
  })).filter(p=>p.name);
  if(!items.length)throw Error('Carrinho vazio.');
  const total=items.reduce((sum,p)=>sum+p.quantity*p.price,0);
  if(!Number.isFinite(total)||total>1000000)throw Error('O valor do carrinho excede o limite permitido.');
  return {customerName:clean(input.customerName,70),notes:clean(input.notes,300),items,total:Math.round(total*100)/100};
}
