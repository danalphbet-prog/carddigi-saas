# Mesa Imersiva — SaaS V6

Aplicativo React/Vite com três experiências separadas:

- **Landing page** (`/`): apresentação, quem somos e como funciona. Sessões autenticadas são redirecionadas a `/painel`.
- **Login** (`/entrar`): Google ou e-mail e senha (cadastrar, entrar e redefinir senha).
- **Área do restaurante** (`/painel`, `/painel/restaurante/:id`): cadastro de estabelecimentos, produtos, estoque opcional, fotos, aparência, contatos, pedidos, biblioteca AR e solicitação de publicação.
- **Painel do gestor** (`/gestor`): permissões `platformAdmin`, análise/aprovação de publicação, cadastro GLB, solicitações AR, eventos e erros.
- **Cardápio público** (`/menu/nome-AB12`): itens e informações do estabelecimento diretamente do Realtime Database, categorias, fotos, detalhes, modelos 3D, AR e carrinho enviado ao WhatsApp.

## Fonte dos dados

Nenhuma informação de restaurante, produto ou estatística é criada como demonstração. O app consulta **Firebase Authentication + Realtime Database** no projeto `carddigi`. Fotografias são compactadas localmente para **WebP 512×512** e gravadas como strings Base64 no Realtime. Arquivos GLB ficam em hospedagem HTTPS externa e são vinculados por URL, somente pelo gestor. O antigo XML demonstrativo e os HTMLs fornecidos estão na pasta `references/` e **não são utilizados** para alimentar o sistema.

Dados reais: `restaurants`, `restaurants/{id}/products`, `modelCatalog`, `modelRequests`, `publicationRequests`, `slugIndex`, `orders`, `analytics` e `settings/site`. O gráfico só exibe eventos realmente registrados; ausência de registros é apresentada como zero.

## Firebase: configuração obrigatória

1. Firebase Console → projeto `carddigi` → **Authentication** → Sign-in method: habilitar **Google** e **Email/Password**.
2. Authentication → Settings → Authorized domains: autorizar seu domínio exato no Render (ex.: `mezeira.onrender.com`).
3. Realtime Database → Rules: publicar o conteúdo atualizado de `database.rules.json`. **Faça backup das regras antigas antes de substituí-las**. Mudanças na hospedagem não aplicam essas regras automaticamente.
4. Permissão `platformAdmin` somente em servidor seguro, através do script administrativo já presente. Nunca colocar chave privada no frontend, GitHub ou Render Static Site.
5. Copie `.env.example` para `.env` e confirme as variáveis `VITE_FIREBASE_*`. Valores `VITE_*` são visíveis no navegador por definição e jamais devem conter segredos de serviço.

## Termux

```bash
pkg install -y nodejs git unzip
cd ~/mesa-imersiva/cardapio-imersivo
npm install
npm test
npm run build
npm run dev
```

Abra `http://localhost:5173`. Para atualizar no GitHub: `git add . && git commit -m "V6 - Layout Savor e login por email" && git push origin main`.

## Render (Static Site)

- Root Directory: **vazio** quando a raiz do GitHub contém `package.json`; caso contrário a subpasta correspondente.
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment: variáveis `VITE_FIREBASE_*` iguais às de `.env.example`.
- Redirects/Rewrites: **Source:** `/*`, **Destination:** `/index.html`, **Action:** `Rewrite`.
- Salve as variáveis e faça novo deploy. A política de segurança/roles continua controlada pelo Firebase.

## Fluxos importantes

- O usuário se autentica com Google ou e-mail/senha. A sessão permanece salva no navegador.
- O restaurante cria itens e solicita publicação; o gestor verifica dados e aprova. O link público legível só fica online após aprovação.
- O gestor cadastra GLBs externos. O restaurante escolhe um modelo ativo no editor de itens, ou envia fotos para solicitar um novo.
- O consumidor não precisa de login; pode abrir qualquer cardápio aprovado. Ao clicar em Finalizar, é criado um **pré-pedido** e abre-se uma mensagem no WhatsApp. Isso não confirma envio, pagamento ou aceite pelo restaurante.
- Estoque é opcional; saldo zero impede a exibição no novo cardápio. Produtos antigos sem saldo continuam disponíveis sem perda dos dados.

## Limitações e validação

O app depende de navegador, WebXR/ARCore e superfície bem iluminada para AR. O AR é recurso de disponibilidade dependente do dispositivo e da qualidade do rastreamento. O card flutuante do Instagram aparece ocasionalmente quando o estabelecimento informou a rede social.

Os testes automatizados verificam regras/estruturas básicas, não substituem teste real de login, regras do banco, pedidos ou dispositivos AR. Os arquivos de modelos GLB não estão inclusos.
