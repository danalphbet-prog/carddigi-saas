# MEZEIRA V8 — PERSONALIZAÇÃO + AR MAIS RESPONSIVO

## Novidades

- 5 paletas fechadas com cores legíveis (Oliva & creme, Areia & café, Terracota, Oceano, Grafite & sálvia)
- 6 fontes Google selecionáveis pelo estabelecimento, com prévia
- Foco/efeito azul substituído por foco visível na cor da paleta (acessível por teclado)
- Nome do produto no topo do detalhe e no título principal; categoria, calorias e descrição na área de informações; ingredientes em tags
- Mensagem de apresentação do WhatsApp configurável, sem omitir o resumo do pedido
- 5 promoções rotativas a cada 3 segundos, ativadas/desativadas pelo estabelecimento; sem dados fictícios
- Hero com `background-size: cover`, posicionamento X/Y por arrastar e sliders no painel
- Tela de integrações salva uma URL HTTPS em `/integrations/{restaurantId}` PRIVADO; **NÃO dispara webhook nesta versão**
- AR: retículo liberado após 2 resultados consistentes, tolerância à inclinação, segundo raio levemente apontado para a mesa quando suportado, instruções de movimento lento e manutenção da âncora espacial

## Banco de dados

As configurações do cardápio ficam em `restaurants/{rid}`. A URL de webhook vai para `integrations/{rid}`, legível somente ao titular ou gestor via regras. Atualize as regras existentes com o arquivo `database.rules.json`, após fazer backup. Sem publicar as regras da V8, salvar URLs de integração pode falhar.

**Nunca envie segredo de API ou token privado como parte da URL**. A execução futura de webhooks exige backend confiável (Cloud Functions/servidor), assinatura, retries e validação de destino. O navegador **não** envia pedidos para a URL configurada.

## Termux — atualizar o código do site no Render

1. Faça backup do projeto e de dados importantes.
2. Baixe o ZIP e execute:

```bash
cd ~/mesa-imersiva
unzip -o /sdcard/Download/MEZEIRA_V8_PERSONALIZACAO_AR.zip -d ~/mesa-imersiva
cd ~/mesa-imersiva/cardapio-imersivo
npm install
npm test
npm run build
```

3. Se os testes e o build passarem, publique **apenas este repositório Render**:

```bash
git add .
git commit -m "V8 - personalizacao cardapio e melhoria AR"
git push origin main
```

4. Depois de verificar o backup e as regras, use `firebase deploy --only database --project carddigi` na pasta `cardapio-imersivo` para aplicar as regras V8. O comando **não publica o Hosting** e não altera o serviço do Render. Se você mantém regras mais recentes, compare e una as alterações antes de sobrescrevê-las.

## Testes

`npm test`: 25 testes aprovados no ambiente de geração.
As sintaxes JS/JSX foram analisadas por TypeScript e o CSS por PostCSS. A instalação de dependências foi bloqueada no ambiente de geração; portanto, o `npm run build` de produção e o teste real no Android/ARCore devem ser executados no seu Termux.

## Requisitos AR

- Navegador compatível com WebXR Hit Test (normalmente Chrome Android), HTTPS, permissão de câmera e aparelho com Serviços do Google Play para AR/ARCore compatível.
- Mesmo com melhorias, um tampo muito liso, reflexivo ou escuro pode demorar. Aponte para uma superfície com textura, iluminada e mova o celular lentamente (não sacuda).
- Não há posicionamento fictício se o ARCore não enviar nenhum ponto de colisão: o prato só é fixado em uma detecção real.
