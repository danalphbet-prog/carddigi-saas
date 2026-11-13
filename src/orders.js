// V13: só IDs e quantidades são enviados; o backend calcula os preços oficiais.
import {apiRequest} from './api-client.js';
import {normalizeOrder} from './ordersCore.js';
export async function createOrderIntent(restaurantId,input){
  const payload=normalizeOrder(input);
  return apiRequest('orders',{restaurantId,...payload});
}
