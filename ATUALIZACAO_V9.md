# MEZZIRA V9 — AR espacial sem margem

## O que mudou
- A experiência WebXR mantém a câmera ocupando 100% da tela; o botão **Voltar** está no próprio overlay.
- Card gastronômico e card Instagram são **planos 3D** adicionados ao mesmo grupo da âncora espacial do prato; não são HTMLs móveis acompanhando a câmera.
- Etiqueta superior do card mostra a categoria real do produto (campo `cat` do Firebase), em vez do texto ilustrativo "Veg".
- Card do produto fica ao lado do prato; o Instagram aparece 10 segundos após o posicionamento, mais distante, e permanece no mesmo lugar durante toda a sessão.
- Os cards são orientados uma única vez, no momento da fixação. Você pode olhar para outro lado e retornar sem que eles mudem de lugar. A posição espacial só é válida dentro da sessão AR, não entre visitas.
- A sessão AR é aberta antes do carregamento da malha GLB; em rede lenta há uma mensagem de carregamento específica.
- Botões interativos do overlay são protegidos contra seleção de objetos XR acidental; o encerramento chama `XRSession.end()` e libera renderer, texturas e âncoras.
- O card 3D mostra uma foto real **quando o arquivo permite leitura segura via CORS**; caso contrário usa um gradiente, sem buscar conteúdo fictício.

## Limitações naturais do WebXR
- O rastreamento físico depende de ARCore, câmera, navegador, luz e superfície. Em dispositivos sem `anchors` o sistema mantém a transformação no espaço local durante a sessão, com potencial de deriva.
- A câmera WebXR é gerenciada pelo navegador/sistema operacional e pode solicitar ocupação de tela inteira. O overlay visual fica **sem margem**.
- Os cards não são objetos persistidos entre sessões. Desligar/reabrir AR exige posicionar novamente.
- Para interagir com um card espacial, aponte o **centro da câmera** para o card e toque na tela.

## Atualizar via Termux
```bash
cd ~/mesa-imersiva
unzip -o /sdcard/Download/MEZZIRA_V9_AR_ESPACIAL_TELA_CHEIA.zip -d ~/mesa-imersiva
cd ~/mesa-imersiva/cardapio-imersivo
npm install
npm test
npm run build
git add .
git commit -m "V9 - Cards AR fixos e camera em tela cheia"
git push origin main
```

**Esta atualização é somente do site público no Render**. Não altera o gestor no Firebase Hosting nem as regras do Realtime Database. Faça um backup/commit antes de aplicar, caso tenha mudanças locais não enviadas.
