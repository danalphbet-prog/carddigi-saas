# Checklist de integração V3
1. Configurar login Google no projeto `carddigi`, permitir domínio e entrar como restaurante.
2. Criar restaurante e confirmar JSON em `restaurants/{rid}`.
3. Carregar JPG 2000×900; prévia deve ficar 512×512 e o campo `photo` deve iniciar com `data:image/webp;base64,`.
4. Salvar produto e inspecionar `restaurants/{rid}/products/{pid}/photo` e `referencePhotos` no Realtime Database (nenhum Storage).
5. Testar imagem fora do limite, arquivo falso e envio de 5 referências.
6. Abrir o cardápio público e verificar que a foto aparece sem Authentication quando publicado.
7. Tentar cadastrar GLB com restaurante (deve estar bloqueado). Gestor publica URL `.glb` no catálogo.
8. Usar outro login Google e confirmar que não pode alterar os dados alheios.
9. Confirmar que pessoa deslogada não pode ler restaurante não publicado.
10. Validar abertura do WhatsApp, câmera AR e posicionamento em dispositivo compatível.
