# Atualização V5 → V6 — carddigi

1. Faça backup do Realtime Database e do repositório antes de atualizar.
2. Extraia o ZIP V6 por cima da pasta do projeto, sem remover `.env`.
3. Execute `npm install && npm test && npm run build` e envie o commit ao GitHub.
4. No Render, mantenha `Static Site`, build `npm install && npm run build`, publicação `dist`, Rewrites `/*` → `/index.html` (Rewrite).
5. Em `Firebase Authentication`, habilite Google **e Email/Password**. Cadastre o domínio oficial do Render entre os domínios autorizados.
6. Atualize as regras do Realtime com `database.rules.json` (inclui validação de estoque). Isso NÃO é feito pelo deploy do Render.
7. Verifique login com conta existente; seus restaurantes/produtos permanecem no banco. Verifique conta nova por e-mail e senha.
8. Teste a edição de produto, estoque, fotografia WebP Base64, solicitação de publicação, aprovação via gestor e link público.
9. Confirme cadastro de URL GLB pelo gestor, vinculação pelo restaurante e AR em aparelho compatível.

A nova interface Savor é integrada aos mesmos registros JSON da V5. Os dois HTMLs fornecidos foram mantidos em `references/` apenas como referência visual; os pedidos, números e alimentos fictícios das demos nunca são importados ao banco nem usados no cardápio público.

**Importante:** sem configurar o provedor Email/Password no Firebase, o novo acesso por senha retorna `auth/operation-not-allowed`. **Importante:** somente inserir o novo código no Render não altera as permissões de gestor no Firebase.
