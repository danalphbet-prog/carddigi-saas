// Normalização de UX. Preço e total nunca saem do cliente como fonte de verdade.
const clean=(value,max=160)=>String(value??'').trim().slice(0,max);
export function normalizeOrder(input){
  const items=input?.items;
  if(!Array.isArray(items)||!items.length||items.length>25)throw Error('Carrinho vazio ou com itens demais.');
  const rows=items.map(p=>{
    const productId=clean(p?.productId,128);
    const quantity=Number(p?.quantity);
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(productId))throw Error('Produto inválido no carrinho.');
    if(!Number.isInteger(quantity)||quantity<1||quantity>50)throw Error('Quantidade inválida.');
    return {productId,quantity};
  });
  if(new Set(rows.map(x=>x.productId)).size!==rows.length)throw Error('Produto repetido no carrinho.');
  return {
    requestId:clean(input.requestId,36),
    customerName:clean(input.customerName,70),
    notes:clean(input.notes,300),
    items:rows
  };
}
