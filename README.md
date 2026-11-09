# MESA IMERSIVA SAAS V5 — Gestão + Firebase `carddigi` + fotos Base64

**LEIA PRIMEIRO: `ATUALIZACAO_V5.md`** (regras de publicação, login persistente e atualização no Render).

## Serviços
- **Firebase Authentication (Google)**: login no painel de restaurante e gestor.
- **Firebase Realtime Database**: todos os dados estruturados em JSON. Não usa Firestore nem Storage.
- **Fotos de produtos, capa, logotipo e fotos de referência**: convertidas no navegador para **512 × 512 px WebP**, em **Base64** (`data:image/webp;base64,...`), e gravadas **diretamente no Realtime Database** dentro dos registros do estabelecimento ou do produto.
- **GLBs**: arquivos mantidos fora do Firebase, em GitHub Pages / servidor HTTPS, gerenciados pelo gestor. No Realtime fica apenas a URL `.glb`.
- **Pré-pedidos**: a intenção de pedido (itens, valor e nome/observações opcionais) é registrada no Realtime e o WhatsApp é aberto. O restaurante pode acompanhar e mudar os status manualmente; não há confirmação automática de pagamento ou envio pela plataforma.

## 1. Configurar Firebase no console
1. Entre em https://console.firebase.google.com/project/carddigi/overview
2. Authentication > Sign-in method > **Google** > Ativar. Se necessário, configure e-mail de suporte.
3. Authentication > Settings > Authorized domains: inclua o domínio do site, ou localhost para teste. **Nunca inclua um domínio que você não controla**.
4. Realtime Database: confirme a instância **carddigi-default-rtdb**. Publique `database.rules.json` (se possível via Firebase CLI). O projeto não usa Cloud Firestore.
5. Configure Firebase App Check (opcional, recomendado para produção) antes de ativar enforcement; utilize a chave pública `VITE_FIREBASE_APPCHECK_SITE_KEY`.

## 2. Executar
```bash
npm install
npm run dev
```
O arquivo `.env` já vem com a configuração web pública que você forneceu, e `.env.example` serve como referência. **Não publique credenciais privadas de serviço no código**. A configuração web `apiKey` não é uma senha de administrador, mas exige regras de banco restritivas.

## 3. Publicar
```bash
npm run build
npx firebase-tools login
npx firebase-tools use carddigi
npx firebase-tools deploy --only database,hosting
```
Após deploy, adicione o domínio do Hosting em Authentication > Domínios autorizados. Se seu plano de hospedagem não é Firebase Hosting, configure HTTPS e fallback de SPA de acordo com o provedor.

## 4. Atribuir papel do gestor
Somente o ambiente seguro com **Firebase Admin SDK** pode conceder o custom claim `platformAdmin: true`.
```bash
# Configure uma credencial de serviço em local privado e protegido (NUNCA no frontend/GitHub)
GOOGLE_APPLICATION_CREDENTIALS=/caminho/seguro/conta-servico.json \
  node scripts/promote-admin.mjs seu@email.com
```
Depois faça logout e login novamente. Não use regras públicas de escrita para habilitar o gestor.

## 5. Fluxo
1. Restaurante se autentica pelo Google, cria seu estabelecimento, informa nome, nicho, endereço, descrição, WhatsApp e Instagram.
2. Cadastra pratos, categorias, preços, fotos; ao escolher uma foto, ela é **processada localmente**, exibida em prévia e só é gravada em JSON no Realtime quando o usuário clica em **Salvar**.
3. Biblioteca global de modelos: o gestor cadastra modelos `.glb` e URLs GitHub Pages em `/gestor`; restaurante escolhe entre os ativos ou solicita novo modelo a partir das fotos (prazo de referência de 7 dias).
4. O gestor vê requisições, produz e publica GLBs na hospedagem externa, atribui um modelo à solicitação; a URL fica no catálogo global e o produto armazena o `modelId`.
5. Consumidor acessa `/menu/nome-do-restaurante-A7K2` (endereço aprovado pelo gestor, sufixo ilustrativo), vê a foto e AR 3D quando há modelo, monta carrinho e envia pedido ao WhatsApp.

## Limites importantes de Base64
- Cada foto: 512×512 WebP, Base64 com **até 190.000 caracteres** (em média até ~140 KB codificados em bytes), limite aplicado em cliente e regras de banco.
- No máximo 5 referências por produto. Evite dezenas de fotos por prato, pois Base64 aumenta o tamanho transmitido e o Realtime sincroniza os dados JSON; muitas imagens encarecem downloads e deixam o cardápio lento.
- O processamento preserva todo o conteúdo da foto com faixas neutras se não for quadrada. O arquivo original não é salvo.
- **Não existe pagamento nem assinatura automática implementada**. A proposta é um fluxo de catálogo; se for necessário cobrar o estabelecimento, checkout e controle de plano são trabalhos posteriores.
- A autenticação e as regras devem ser testadas com usuários distintos antes de produção. O App Check pode adicionar proteção contra abuso, mas não substitui segurança do RTDB.
