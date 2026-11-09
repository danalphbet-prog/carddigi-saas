// Não permite que uma sessão Google persistente volte à apresentação comercial.
export const isBusinessRoute = path => path === '/painel' || path.startsWith('/painel/') || path === '/gestor';
export const isMenuRoute = path => path.startsWith('/menu/');
export const shouldRedirectToBusiness = (path, signedIn) =>
  Boolean(signedIn) && !isBusinessRoute(path) && !isMenuRoute(path);
