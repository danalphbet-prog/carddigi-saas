# V4 — interface pública e login Google

## Mudanças
- O texto visível para consumidores e restaurantes não divulga infraestrutura, nomes de provedores de banco ou URL de repositórios.
- O painel do gestor não aparece nos menus públicos ou do estabelecimento. O acesso direto `/gestor` continua existindo **e exige a custom claim `platformAdmin`**; ocultar links não é mecanismo de segurança.
- Autenticação Google utiliza popup aberto pelo clique, sem fallback automático para redirect no Render.
- Mensagens de erros de autenticação foram traduzidas e não mostram mensagens internas da SDK.
- O banco Realtime Database, as fotos 512×512 Base64 e os modelos 3D via URL permanecem como na V3.

## Para corrigir `auth/configuration-not-found` **no projeto real**
1. Abra https://console.firebase.google.com/project/carddigi/authentication/providers
2. Em **Sign-in method**, habilite **Google**, escolha e-mail de suporte quando solicitado e salve.
3. Em **Authentication > Settings > Authorized domains**, adicione `mezeira.onrender.com` (sem `https://`).
4. Em Render, confirme variáveis `VITE_FIREBASE_*` apontando para `carddigi` e faça deploy.
5. Teste em janela anônima. No Chrome Android, não bloqueie janelas pop-up para este site.

O botão só funcionará depois de configurar o provedor Google no console. O código não consegue habilitá-lo sozinho. Nenhuma regra foi afrouxada para contornar a autenticação.

## Atualizar código no Termux
Extraia o ZIP na pasta que já está versionada com Git, revise e execute `git add . && git commit -m "V4 interface e login" && git push origin main`. O Render com auto deploy publicará o commit.

## Verificações
`npm test` verifica também as mensagens públicas; `npm run build` requer `npm install` e rede para obter dependências.
