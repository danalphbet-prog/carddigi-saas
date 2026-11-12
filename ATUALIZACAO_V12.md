# MEZZIRA V12 — Loja, estoque e temas completos

Esta entrega foi construída sobre o projeto V11 com a atualização V11.1 da tela de carregamento, **sem conectar-se ao Firebase de produção**.

## Interface de gestão

- **Loja** é uma página única contendo dados do estabelecimento, contatos, imagem de capa, logo, WhatsApp, enquadramento de capa, temas e grupos de fontes.
- Foram removidas do menu as abas independentes **Aparência**, **Contatos** e **Estabelecimento**.
- As outras páginas (Produtos, Estoque, Promoções, Integrações, Pedidos, Modelos e Relatórios) permanecem independentes.

## Estoque

- A escolha agora é explícita: **Ilimitado** ou **Limitado por quantidade**.
- Ao selecionar Ilimitado e salvar, `stock: null` é enviado pela atualização do Realtime Database; no SDK RTDB, isso **remove o campo anterior**. A ausência de `stock` significa ilimitado para o cardápio, sem número fictício.
- `0` em estoque limitado continua indicando produto esgotado.
- A edição de produtos e a página Estoque aceitam voltar de saldo 2 para Ilimitado.

## Aparência

- Cinco temas completos: Oliva, Areia, Terracota, Oceano e Grafite.
- Cada tema configura cor de fundo, superfície dos cards, contraste de fonte, bordas, ícones, botões, categorias, cabeçalhos e carrinho.
- A capa tem `object-fit: cover` e ajuste de foco por cinco botões ou arraste. Imagens de quaisquer proporções preenchem a área **com recorte** quando necessário. Não se promete mostrar 100% da foto sem recortar.
- Os cinco grupos de fontes da V11 continuam preservados.

## Publicação

Extraia o ZIP sobre o projeto existente. O pacote não contém `.env` nem credenciais privadas. No Termux:

```bash
cd ~/mesa-imersiva
unzip -o /sdcard/Download/MEZZIRA_V12_LOJA_TEMAS_ESTOQUE.zip -d ~/mesa-imersiva
cd ~/mesa-imersiva/cardapio-imersivo
npm install
npm test
npm run build
```

Após validar o resultado, publique no repositório que alimenta o Render:

```bash
git add .
git commit -m 'V12 - Loja, estoque ilimitado e temas completos'
git push origin main
```

Atenção: verifique sua branch (`git branch --show-current`) antes do push. O projeto Firebase permanece `carddigi`. **Não é necessário substituir as regras do Realtime para esses campos já existentes na V11**, mas verifique as regras publicadas no seu projeto antes de testar a gravação. Esta versão não altera o painel do gestor no Firebase Hosting, o AR nem os registros de restaurantes.

## Validação

Testes locais Node.js executados. Sintaxe JSX verificada por TypeScript transpileModule. Build Vite completo não executado neste ambiente, porque as dependências não estão instaladas no cache local do npm. Teste visual no Android e gravação no Realtime Database ainda pendentes.
