# Contrato para os próximos templates da MEZZIRA

O arquivo `src/template-system.js` contém 60 slots com ID e família definidos. Um slot com `status: aguardando-layout` não deve aparecer como layout selecionável no estabelecimento nem ser renderizado para o cliente.

- Grade (20): `grid-01` a `grid-20`
- Lista (20): `list-01` a `list-20`
- Detalhes (20): `detail-01` a `detail-20`

Layouts ativos hoje: `grid-classico` e `detail-classico`.

Para implementar um novo layout a partir de uma referência, registrar um renderer React real por ID, designar seu tipo e testá-lo com os mesmos campos de produto existentes (`id`, `name`, `cat`, `price`, `photo`, `description`, `ingredients`, `url`, `active`, `stock`). O componente não deve usar dados demonstrativos nem solicitar produtos adicionais ao backend só para desenhar o layout. Rotas, permissões, carrinho, GLB/AR, pedidos e registro de eventos continuam pertencendo ao aplicativo, não ao template.

Ao disponibilizar cada renderização, ampliar a validação de `menuTemplateId` ou `productDetailTemplateId` em `database.rules.json` e adicionar sua opção no painel, mas apenas após teste visual e funcional. Até lá, IDs desconhecidos caem com segurança na apresentação atual da V11.

A opção `menuCategoryGroups` já controla o agrupamento por categoria na grade atual. Ela deve continuar operando nos futuros estilos de lista e grade.
