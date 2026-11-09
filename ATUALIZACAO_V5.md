# Mesa Imersiva SaaS — V5 (login persistente e gestão)

## Comportamento de login solicitado
- Ao abrir `/`, `/entrar`, ou navegar de volta para essas rotas, o aplicativo **aguarda o Firebase Authentication restaurar a sessão** antes de decidir que página mostrar.
- Se a sessão Google ainda estiver ativa, substitui a URL atual por `/painel`, sem mostrar a apresentação comercial. Isso também vale ao tocar em **Voltar** no Android.
- As rotas públicas `/menu/...` continuam acessíveis, mesmo se alguém estiver logado. `/gestor` só abre com custom claim `platformAdmin: true`.
- `signInWithPopup` configura persistência local do navegador. O login pode expirar se o navegador limpar seus dados, se o usuário sair ou se a sessão for revogada.

## Estabelecimento
- Layout de gestão branco com identidade verde-oliva.
- Nome, nicho, descrição, Instagram, WhatsApp, logotipo, capa e cor de destaque.
- Produtos com foto e referências 512×512 WebP Base64 no Realtime Database; biblioteca 3D associada por `modelId`.
- Solicitações de modelos com acompanhamento da produção.
- Botão **Solicitar publicação**, habilitado ao ter WhatsApp válido e pelo menos um produto ativo. A solicitação não torna o cardápio público.
- Após aprovação pelo gestor, aparece o endereço legível `https://mezeira.onrender.com/menu/pizzaria-paulista-A7K2` (exemplo; sufixo gerado automaticamente).
- Área **Pedidos** registra pré-pedidos com itens, total, nome e observações opcionais do cliente, e permite alterar manualmente o status (aguardando, confirmado, preparo, concluído ou cancelado). Esse registro **não comprova** se a mensagem foi enviada ou paga no WhatsApp; a confirmação é responsabilidade do estabelecimento.

## Gestor
- `/gestor`: solicitações de publicação (aprovar/devolver), restaurantes, biblioteca de GLBs, solicitações AR, gráficos de visitas/intenção de pedido, eventos de saída, erros e apresentação do SaaS.
- O gestor pode entrar no painel de qualquer restaurante e modificar seus dados e produtos.
- Publicações antigas da V4 com `published: true` e sem `slug` podem receber um endereço legível em **Restaurantes → Gerar link público**, sem recriar o cadastro.
- Apenas o gestor escreve `published`, `publicationStatus`, `slug` e `slugIndex`, conforme as regras V5.

## Atualização obrigatória do Firebase
O **código frontend sozinho não basta**. Antes de usar aprovação, métricas ou endereços públicos, atualize as regras de **Realtime Database** para o arquivo `database.rules.json` desta V5.

Pelo Console: Firebase `carddigi` → Realtime Database → **Regras** → substituir o conteúdo pelo arquivo `database.rules.json` → **Publicar**.

Alternativamente, com Firebase CLI autenticada no Termux:

```bash
cd ~/mesa-imersiva/cardapio-imersivo
npx firebase-tools login --no-localhost
npx firebase-tools deploy --only database --project carddigi
```

Não confunda Firebase Authentication com regras do Realtime Database. Sua conta de gestor continua precisando do custom claim `platformAdmin: true` concedido via Admin SDK em ambiente privado.

## Publicar no Render
**Static Site**: root directory vazio (se `package.json` está na raiz), build `npm install && npm run build`, publish `dist`. Defina as variáveis `VITE_FIREBASE_*` do projeto `carddigi` em Render → Environment.

Em **Redirects/Rewrites**: source `/*`, destination `/index.html`, action **Rewrite**. Isso evita erro de rota inexistente ao abrir `/painel`, `/gestor` e `/menu/...` diretamente.

## Atualizar via Termux e GitHub
Baixe o ZIP V5 na pasta Downloads do Android e execute:

```bash
cd ~/mesa-imersiva/cardapio-imersivo
unzip -o /sdcard/Download/MESA_IMERSIVA_SAAS_V5_GESTAO_PERSISTENTE.zip -d ~/mesa-imersiva
cd ~/mesa-imersiva/cardapio-imersivo
npm install
npm test
npm run build
git add .
git commit -m "V5 - login persistente, aprovacoes e dashboard"
git push origin main
```

O Render pode reconstruir automaticamente ao receber o push se o Auto Deploy estiver ativo. O comando `git push` **não aplica regras** do Firebase; execute a etapa Realtime Database acima.

## Segurança e limitações
- Os controles de permissão estão nas regras RTDB, não só no painel React. Não basta ocultar botões.
- A versão atual registra eventos e pré-pedidos diretamente do navegador sem login no cardápio; as regras validam formato e só permitem criação para estabelecimentos publicados. Antes de escalar, habilite e teste App Check, antifraude/rate-limit no backend e uma estratégia de agregação para não acumular eventos sem limite.
- Eventos de saída podem se perder ao fechar a aba ou ficar sem conexão. Gráficos e erros são telemetria de melhor esforço, não auditoria perfeita.
- Regras Realtime Database e autorização de gestor precisam ser testadas em contas separadas antes de lançar o SaaS comercialmente.
- O projeto está entregue como código-fonte. Testes locais de JavaScript passaram; **o build Vite e os testes contra o Firebase de produção não foram executados neste ambiente**.
