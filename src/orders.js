// Registro de pré-pedido. A confirmação continua a cargo do WhatsApp/estabelecimento.
import {ref,push,set,serverTimestamp} from 'firebase/database';
import {db} from './firebase.js';
import {normalizeOrder} from './ordersCore.js';
export function createOrderIntent(restaurantId,data) {
  if(!db||!restaurantId) return '';
  const payload=normalizeOrder(data);
  const orderRef=push(ref(db,`orders/${restaurantId}`));
  const code=orderRef.key.slice(-6).toUpperCase().replace(/[^A-Z0-9-]/g,'X');
  void set(orderRef,{...payload,code,status:'initiated',createdAt:serverTimestamp(),updatedAt:serverTimestamp()})
    .catch(err=>{console.warn('Não foi possível registrar o pré-pedido:',err?.code||'Falha de conexão');});
  return code;
}
