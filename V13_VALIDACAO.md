# Validação local — Mezzira V13

- Testes de contratos, UI estrutural, projeção pública, validação de preços, idempotência, autorização, estoque e cancelamento: **50 aprovados** (`npm test`).
- Sintaxe ES Modules da API: verificada com `node --check`.
- Sintaxe JSX alterada: analisada com TypeScript (`tsc --allowJs --jsx preserve --noEmit --noResolve`) sem erros de sintaxe.
- Regras do Firebase: JSON válido, testes para separação privada/pública e bloqueio de escrita direta.

## Limites da validação

Não houve acesso ao Firebase de produção nem às credenciais do Admin SDK. A instalação do `npm ci` do frontend não foi concluída por indisponibilidade de pacotes/rede no ambiente de execução, portanto **não foi possível executar um build Vite real nem testar o Web Service Render**. Antes de publicar, execute no Termux `npm ci`, `npm run build`, `cd api && npm ci`, e confirme no Firebase Emulator ou projeto de testes os fluxos e regras. O serviço API deve ser implantado antes de fechar as regras do banco.

## Consistência de dados

`commerce/{rid}` é a fonte transacional de estoques e pedidos. O sistema mantém réplicas de leitura em `restaurants/{rid}/products`, `orders/{rid}` e `publicMenus/{rid}`. Se ocorrer falha entre a transação e a atualização das réplicas, o backend deve reconciliar o estado; os testes com mock não substituem testes de falha parcial do Firebase. Esta versão é uma base funcional para homologação, não uma implantação validada em produção.
