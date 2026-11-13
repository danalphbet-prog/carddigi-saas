# Mezzira V13 — Static Site + API Node.js + Firebase Realtime Database

Versão V13 do SaaS Mezzira. **Um repositório, dois serviços independentes no Render, um Firebase Realtime Database**. Não usa Firestore nem Cloud Functions.

## Organização

```
carddigi-saas-main/
  src/               React / Vite (site público e painéis)
  public/            Imagens de exemplo, estáticos e modelos demonstrativos
  api/
    server.js        API REST, autenticação Firebase e App Check opcional
    lib/
      validation.js  Contratos e validação de inputs
      service.js     Operações de pré-pedido e estoque, sem integração de pagamento
    scripts/
      backfill.mjs   Geração inicial de projeções públicas V13
    tests/           Testes de domínio com banco em memória
    package.json
    package-lock.json
  database.rules.json
  tests/
  V13_IMPLANTACAO.md
```

## Fluxos reais

- Consumidor: carrega `slugIndex` e `publicMenus/{rid}` diretamente do Firebase pelo SDK Web. Este conteúdo não contém `ownerUid`, fotos de referência 3D nem dados administrativos. A API não bloqueia a abertura do cardápio.
- Checkout: `POST /api/v1/orders` recebe apenas IDs, quantidades e notas, autenticação pública opcional por App Check, recalcula os preços do catálogo oficial, gera pedido idempotente e responde com referência. **Somente após a confirmação de gravação** o navegador monta o WhatsApp com preços conferidos no servidor.
- Administração: login permanece no Firebase Authentication (Google ou e-mail). A API verifica o Firebase ID Token, a propriedade do estabelecimento e `platformAdmin`; todo cadastro/edição/exclusão, estoque, publicação, modelo, status do pedido e webhook é gravado pelo Admin SDK no backend.
- Estoque: `null`/sem campo significa ilimitado; número inteiro é limitado. A operação de confirmação/cancelamento é transacional no nó compacto `commerce/{rid}`; `restaurants`, `orders` e `publicMenus` são projeções de leitura para os painéis.
- Gestor: analisa solicitações, publica/pausa cardápios, controla modelos 3D, e pode sincronizar projeções V13 por botão na central.

## API V13

| Método | Rota | Autorização | Uso |
|---|---|---|---|
| `GET` | `/api/v1/health` | Pública | Estado / pré-inicialização do Web Service |
| `POST` | `/api/v1/orders` | Pública (+ App Check opcional) | Criar intenção validada e idempotente |
| `POST` | `/api/v1/events` | Pública (+ App Check opcional) | Telemetria validada / limitada |
| `POST` | `/api/v1/mutate` | Firebase ID Token | Operações do proprietário, gestor, configurações e status |
| `POST` | `/api/v1/admin/publications` | `platformAdmin` | Aprovar/rejeitar publicação |
| `POST` | `/api/v1/admin/slug` | `platformAdmin` | Reservar endereço público |
| `POST` | `/api/v1/admin/toggle-publication` | `platformAdmin` | Suspender/retomar publicação |
| `POST` | `/api/v1/admin/rebuild-public-menus` | `platformAdmin` | Reconstruir projeções públicas |

O endpoint `/mutate` **não** é um proxy arbitrário do Firebase: interpreta uma allowlist de caminhos/ações, aceita apenas campos definidos, confere ownership e não permite alterar `ownerUid`, `published`, `slug`, `status` de aprovação ou privilégios fora dos fluxos dedicados.

## Desenvolvimento local (Termux / Node 20+)

```sh
# Na raiz do repositório
npm ci
npm test
npm run build

# API (terminal separado)
cd api
npm ci
# Credenciais em arquivo FORA do GitHub:
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/carddigi/service-account.json"
export FIREBASE_DATABASE_URL='https://carddigi-default-rtdb.firebaseio.com'
export ALLOWED_ORIGINS='http://localhost:5173'
export PORT=3001
npm start

# Frontend (outro terminal, na raiz)
# Adicione VITE_API_BASE_URL=http://localhost:3001 ao arquivo .env local
npm run dev
```

No Render, `FIREBASE_SERVICE_ACCOUNT_JSON` é uma variável secreta da API. Nunca colocar a credencial em `VITE_*`, no Static Site, no código, em um commit ou no arquivo ZIP.

## Implantação / migração

**Leia [V13_IMPLANTACAO.md](V13_IMPLANTACAO.md) antes de fazer deploy.** É indispensável gerar `publicMenus` para restaurantes V12 já publicados **antes** de trocar as regras do Firebase. Faça backup do banco e das regras antigas. As operações da V12 não funcionam com regras V13 antes de implantar a API.

## Garantias e limitações

- O preço do checkout é sempre verificado no servidor, nunca aceito do front-end.
- O registro de pedido é idempotente pelo UUID do checkout; o WhatsApp só abre depois do sucesso do servidor.
- Estoque de múltiplos itens é validado num só `transaction()` em `commerce/{rid}`. Projeções secundárias são **eventualmente consistentes**, podem precisar de reconciliação quando houver indisponibilidade no Firebase durante a propagação.
- O Web Service **gratuito** do Render pode suspender e atrasar o primeiro checkout. A pré-inicialização no cardápio reduz o risco, mas não garante latência zero. Para vendas comerciais, prefira uma API que não suspenda.
- O limitador de taxa usa memória de uma instância do Node; para várias réplicas e ataques distribuídos, use limiter compartilhado/WAF e ative App Check corretamente.
- A V13 ainda abre WhatsApp: ela **não** confirma envio de mensagem, pagamento, entrega ou cobrança; webhooks são cadastrados, mas não disparados.
- Testes locais cobrem lógica e contrato; valide Firebase Emulator/ambiente real, autenticação, Realtime Database, regras, custos e WebXR antes de produção.
