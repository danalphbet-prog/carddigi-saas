# MEZZIRA V11 — Tipografias, templates e prévia 3D

Esta é uma atualização do **site público + painel do estabelecimento (Render)**. Não substitui o painel separado do gestor no Firebase Hosting. É construída a partir dos arquivos da V9 e do patch V10, com as modificações da V11.

## Implementado

- Cinco grupos de Google Fonts: Luxuoso, Moderno, Descontraído, Editorial, Compacto. Grupos incluem fonte do título, corpo e ênfase/itálico.
- Persistência no Realtime Database: `restaurants/$rid/menuFontGroup` e `menuCategoryGroups`.
- Escolha de separação dos produtos por categoria no painel do estabelecimento.
- Biblioteca com 60 slots reservados: 20 grades, 20 listas e 20 páginas de detalhe. **Slots reservados não são novos visuais implementados.** Os únicos renders ativos são a grade Savor e a página de detalhe Savor, que permanecem intactos. Os nomes/IDs ficam preparados em `src/template-system.js`.
- IDs persistidos para layouts atuais: `menuTemplateId: grid-classico`, `productDetailTemplateId: detail-classico` ao salvar a aparência. Restaurantes já existentes, sem esses campos, usam os mesmos estilos antigos.
- Prévia de GLB: acompanhamento de carregamento (porcentagem quando possível), renderização aproximada de 30 FPS, menor pixel ratio e pausa quando a prévia sai do campo visível. Sem iniciar uma segunda sessão AR ao mesmo tempo.
- Detecção de superfície: entre os dois raios disponíveis, favorece a superfície espacialmente mais consistente. O limiar de inclinação permanece em 0,82 para não favorecer paredes.
- O AR preserva o fluxo da V10 e o Instagram permanece inativo na câmera.

## Não implementado nesta versão

- Os 60 novos layouts visuais de grade/lista/detalhe. Eles serão adicionados quando forem fornecidas as referências.
- Detecção de marcador físico/círculo de três pontos. É uma opção futura, mas ainda requer estudo de suporte e contraste do marcador.
- Melhoria garantida de download na rede: um GLB de 7–9 MB ainda depende da velocidade do servidor e do aparelho.

## Instalação pelo Termux

```bash
cd ~/mesa-imersiva
unzip -o /sdcard/Download/MEZZIRA_V11_TEMPLATES_FONTES_AR.zip -d ~/mesa-imersiva
cd ~/mesa-imersiva/cardapio-imersivo
npm install
npm test
npm run build
```

Se o build passar, publique no GitHub/Render:

```bash
git add .
git commit -m "V11 - Templates, fontes e desempenho 3D"
git push origin main
```

**Firebase Realtime Database:** faça backup das regras existentes, revise as diferenças no arquivo `database.rules.json` e atualize-as no Console ou com:

```bash
firebase deploy --only database --project carddigi
```

Atenção: este último comando publica regras do banco, e **não** altera o Firebase Hosting do gestor. Nunca rode `firebase deploy` sem `--only` a partir da pasta pública se não quiser publicar também o Hosting.

## Observações de segurança

- Nenhum dado ou restaurante fictício foi importado para o SaaS; o que aparece são dados existentes do Realtime.
- O projeto não inclui seu `.env` com credenciais privadas ou chave de conta de serviço.
- As mudanças dependem de deploy e devem ser testadas no Android com GLBs reais. Nenhuma versão pode prometer melhoria universal de detecção de superfície, já que ARCore/WebXR depende da iluminação, textura e navegador.

## Validação local

36 testes Node aprovados. Arquivos JSX revisados com o parser TypeScript, sem erros sintáticos. O build Vite não foi executado neste ambiente porque as dependências necessárias não estão em cache e a instalação não pôde ser concluída.
