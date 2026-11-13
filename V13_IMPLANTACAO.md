# Mezzira V13 — Implantação no mesmo GitHub e em dois serviços Render

## 0. Preparação obrigatória

1. Faça backup do Firebase Realtime Database (Export JSON no Console) e salve uma cópia das regras atualmente publicadas.
2. Preserve as credenciais do Admin SDK fora do repositório, na área secreta de Environment do Web Service Render ou no arquivo seguro do Termux.
3. Planeje uma janela curta de migração: o novo site precisa de `publicMenus` já preenchido. **Não aplique `database.rules.json` da V13 antes de gerar as projeções e implantar a API.**
4. Confirme que o token `platformAdmin` existe na conta gestora no Firebase Authentication. O código não cria novos administradores via navegador.

## 1. GitHub: único repositório

Mantenha frontend e API no mesmo repositório. A pasta `api/` tem `package.json` e `package-lock.json` próprios. O GitHub recebe **somente código**, nunca segredos.

```sh
cd ~/mesa-imersiva/cardapio-imersivo
# Copie os arquivos da V13 para ESTA pasta, sem apagar arquivos pessoais não pertencentes ao projeto.
git add -A
git commit -m 'Mezzira V13 - API Node e proteção de pedidos'
git push origin main
```

O ZIP da V13 inclui a versão completa dos arquivos do repositório analisado (não inclui `.git`); atualize a sua cópia local antes de `git add`.

## 2. Render: novo Web Service da API (mesmo repositório)

| Campo | Valor |
|---|---|
| Tipo | Web Service |
| Nome | `mezzira-api` (exemplo, escolha um nome livre) |
| Repository | o mesmo GitHub do Mezzira |
| Branch | `main` |
| Root Directory | `api` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Runtime | Node.js 20+ |
| Health Check Path | `/api/v1/health` |

Environment no Web Service:

| Variável | Configuração |
|---|---|
| `FIREBASE_DATABASE_URL` | URL do Realtime Database, como `https://carddigi-default-rtdb.firebaseio.com` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo da conta de serviço, **secret** |
| `ALLOWED_ORIGINS` | domínio HTTPS real do Static Site, ex.: `https://SEU-SITE.onrender.com`; múltiplos domínios separados por vírgula |
| `ENFORCE_APP_CHECK` | `false` no primeiro deploy; mude para `true` só após configurar reCAPTCHA Enterprise/App Check e testar token no browser |
| `PORT` | geralmente não definir: o Render fornece automaticamente |

`GOOGLE_APPLICATION_CREDENTIALS` é alternativa ao JSON inline em servidores que montam arquivos seguros; não é necessário usar as duas opções.

Após o deploy, abra `https://SEU-SERVICO-API.onrender.com/api/v1/health`, que deve responder JSON com `version: 13`.

## 3. Gere `publicMenus` antes de mudar o frontend

Se usar Termux com o arquivo de conta de serviço que você já mantém fora do projeto:

```sh
cd ~/mesa-imersiva/cardapio-imersivo/api
npm ci
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/carddigi/service-account.json"
export FIREBASE_DATABASE_URL='https://carddigi-default-rtdb.firebaseio.com'
npm run migrate:public
```

O script lê `restaurants`, gera as projeções `publicMenus` e inicializa `commerce` nos estabelecimentos publicados. É idempotente para o catálogo existente (não zera estoque do `commerce` já migrado). **Verifique o conteúdo público para assegurar que ele não contém `referencePhotos` nem `ownerUid`** antes de prosseguir.

Alternativa: depois de implantar o frontend V13, entre em `/gestor` e clique em **Sincronizar catálogos V13**. Isso causa uma janela de indisponibilidade do catálogo até terminar o primeiro processamento, portanto o script acima é preferível.

## 4. Render: mantenha o site como Static Site

| Campo | Valor |
|---|---|
| Tipo | Static Site |
| Repository / Branch | mesmo repositório e `main` |
| Root Directory | vazio (raiz) |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Rewrite | `/*` → `/index.html` |

Mantenha todas as variáveis públicas `VITE_FIREBASE_*` já usadas no Static Site e adicione:

```env
VITE_API_BASE_URL=https://SEU-SERVICO-API.onrender.com
```

**Não inclua `/api/v1` na variável**, pois o cliente acrescenta esse trecho automaticamente. Nenhum segredo `FIREBASE_SERVICE_ACCOUNT_JSON` deve existir no Static Site.

Depois, force o deploy do Static Site e teste: login, cadastro, edição, loja, cardápio público, criação de pré-pedido e painel do gestor.

## 5. Agora troque as regras do Firebase

Somente depois que API e frontend V13 estiverem acessíveis e as projeções existirem:

1. Firebase Console → Realtime Database → Rules.
2. Faça backup das regras V12.
3. Cole `database.rules.json` da V13 e publique, ou `firebase deploy --only database` com CLI configurada no projeto certo.
4. Teste que requisições Web SDK do navegador **não conseguem gravar** `restaurants`, `orders`, `analytics`, `modelCatalog` ou `publicMenus`, mas a API ainda consegue pelo Admin SDK.
5. Teste com usuário proprietário, outro proprietário, gestor, visitante anônimo e estabelecimento suspenso.

## 6. Checklist de aceitação em produção

- [ ] `/api/v1/health` responde 200 no Render.
- [ ] Static Site abre mesmo com API em suspensão.
- [ ] Cardápio publicado usa somente `publicMenus`, nunca `restaurants` diretamente.
- [ ] Fotos de referência privadas não aparecem no JSON público.
- [ ] Criar/editar/excluir produtos salva por `POST /api/v1/mutate` com Bearer Firebase ID Token.
- [ ] Usuário A não altera a loja B (403).
- [ ] Ao enviar preço falso no pedido, o servidor recalcula com o valor oficial.
- [ ] Retry do checkout com o mesmo `requestId` devolve o mesmo pedido.
- [ ] Pré-pedido que falhar na API **não abre WhatsApp como sucesso**.
- [ ] Confirmar pedido desconta saldo limitado uma vez; cancelar depois devolve.
- [ ] Saldo ilimitado continua ilimitado.
- [ ] Gerenciar fontes, temas, promoções, contatos e webhooks não usa escrita direta Web SDK.
- [ ] Gestor publica, pausa, retoma, aprova AR e sincroniza catálogos.
- [ ] Regras RTDB bloqueiam escrita direta do navegador; leituras autenticadas continuam.
- [ ] Testar primeiro checkout após 15 minutos de inatividade da API gratuita.

## Cuidados conhecidos

A API free do Render pode suspender após inatividade; aquecer em background reduz chance de atraso no checkout, mas não elimina o problema. O site estático continua disponível. A política de rate-limit por IP é por instância, não uma proteção anti-DDoS distribuída. A transação de estoque é forte no nó `commerce/{rid}`, mas atualização de projeções em outros nós pode exigir reconciliação após falha de rede. Consulte logs antes de operar em escala e prefira infraestrutura sem cold start para comércio.
