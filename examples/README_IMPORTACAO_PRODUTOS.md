# Mezzira V13.2 — produtos em JSON e XML

Na área **Estabelecimento → Produtos** você encontra **Importar catálogo**, **Exportar JSON**, **Exportar XML** e **Baixar modelo JSON/XML**. No formulário **Novo produto / Editar produto**, a opção **Arquivo do produto** importa um único registro para preencher o formulário (não salva automaticamente), permite exportar o conteúdo digitado e baixar os modelos.

## Estrutura dos arquivos

- JSON: `{ "schema": "mezzira.products", "version": 1, "products": [ { ... } ] }`.
- XML: `<?xml version="1.0" encoding="UTF-8"?><mezzira version="1"><products><product>...</product></products></mezzira>`.
- Arrays JSON `ingredients` e `referencePhotos` se tornam `<ingredients><item>...</item></ingredients>` e `<referencePhotos><url>...</url></referencePhotos>` no XML.
- Aceita até **100 produtos por arquivo**, até **30 MB**. Se o catálogo superar 100 produtos, selecione e exporte os lotes numerados separadamente. A importação só cria itens novos, sem sobrescrever, sem excluir, sem atualizar preços existentes. Nomes + categorias repetidos (ignorando maiúsculas e espaços externos) são pulados. O botão **Confirmar importação** faz as gravações **pela API V13** após a prévia.

## Campos

| Campo JSON / tag XML | Tipo | Regras e finalidade |
|---|---|---|
| `name` | texto, obrigatório | Título do produto (até 120 caracteres). |
| `description` | texto | Descrição detalhada (até 1.200 caracteres). |
| `cat` | texto | Categoria (até 70 caracteres, ex. Pizzas). |
| `price` | número | Preço em reais, de 0 a 100000, máximo 2 casas decimais. Use ponto: `49.90`. |
| `prompt` | texto | Mensagem exibida no convite AR após aproximação do aparelho (até 200 caracteres). |
| `photo` | texto | Imagem principal, vazia `""` ou JPEG/WebP Base64 `data:image/webp;base64,...`. |
| `referencePhotos` | lista de texto | Até 5 imagens adicionais para solicitar um modelo 3D, no mesmo formato Base64. |
| `ingredients` | lista de texto | Até 25 ingredientes, cada um com até 90 caracteres. |
| `kcal` | inteiro | Calorias, de 0 a 100000. |
| `diameter` | número | Diâmetro estimado em metros para apresentação AR, entre 0.05 e 2. |
| `roughness` | número | Rugosidade visual 3D, de 0 a 1. |
| `emoji` | texto | Ícone ilustrativo, até 10 caracteres. |
| `stock` | inteiro ou `null` | `null` = ilimitado; `0` = esgotado; números positivos = saldo limitado. Em XML, `<stock></stock>` = ilimitado. |
| `active` | booleano | `true`/`false` no JSON e no XML; define visibilidade no cardápio. |
| `modelId` | texto | ID opcional do modelo 3D ativo no catálogo global (até 128 caracteres). |

`name`, `price` e `active` são obrigatórios na API, mas o importador pode completar automaticamente os valores padrão de `active` e de campos opcionais. O JSON/XML contém o modelo de exemplo completo. Campos internos como `id`, `ownerUid`, `stockRevision`, `modelStatus`, `createdAt`, `updatedAt` não são importados/exportados; são geridos pelo servidor.

**Imagens:** Na V13, o banco de produtos recebe somente fotos JPEG/WebP em Base64 de até 190.000 caracteres por foto, não URLs `https://...`. Uma forma prática de obter o Base64 é cadastrar a fotografia pelo formulário e exportar o produto, pois o sistema já converte para WebP. A foto fica dentro do arquivo e não depende de link externo. Os arquivos XML com DOCTYPE/ENTITY são rejeitados. O JSON não é executado como código.

## Aplicação

Execute na pasta raiz do repositório **carddigi-saas**, onde está o `package.json`:

```bash
node /sdcard/Download/mezzira_v13_2_produtos_patch.mjs --check
node /sdcard/Download/mezzira_v13_2_produtos_patch.mjs
npm test
npm run build
git add package.json package-lock.json src/platform.jsx src/StudioPanel.jsx src/product-interchange.js src/ProductFileTools.jsx src/product-file-tools.css tests/product-interchange.test.mjs examples/README_IMPORTACAO_PRODUTOS.md examples/mezzira-modelo-produtos.json examples/mezzira-modelo-produtos.xml
git commit -m "V13.2: importar e exportar produtos JSON/XML"
git push origin main
```

O patch exige Mezzira **V13.1.0** e verifica as assinaturas antes de alterar o projeto; `--check` apenas valida. Não requer dependências extras, Firebase Functions nem Firestore. `git push` aciona seu deploy conforme as configurações existentes.
