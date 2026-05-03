# Plano de Implementação — Sistema Separado de Scene Objects e Object Respawn

## 1. Objetivo

Implementar um sistema novo e independente para objetos de cenário, separado do sistema de Actors.

O objetivo é permitir que o painel de debug/editor do mundo consiga:

- spawnar objetos decorativos/ambientais no cenário;
- spawnar actors de gameplay pelo mesmo painel, mas por fluxo separado;
- selecionar entidades colocadas no mundo;
- exibir claramente o tipo e o ID da entidade selecionada;
- editar posição, rotação e escala;
- persistir essas alterações no banco de dados;
- carregar os objetos salvos no bootstrap do mundo;
- renderizar os objetos em uma camada própria no frontend.

Este sistema deve ser construído sem transformar `Actor` em um repositório genérico de tudo que aparece no mapa.

---

## 2. Princípio arquitetural

A separação conceitual deve ser rígida:

```txt
Actor  = entidade de gameplay
Object = entidade de composição visual/cenário
```

### Actor

Actors continuam representando entidades que podem ter papel de gameplay, por exemplo:

- NPC;
- baú;
- árvore coletável;
- rocha minerável;
- ponto de extração;
- entidade com container;
- entidade com interação;
- entidade com estado funcional.

Actors podem participar de lógicas de interação, coleta, regras de recurso, containers e eventos autoritativos.

### Object / Scene Object

Objects representam objetos de cenário, por exemplo:

- pedra decorativa;
- banco;
- poste;
- cerca;
- tronco;
- vegetação decorativa;
- placa;
- ruína;
- item ambiental sem interação.

Objects não devem usar a lógica de Actor.

Objects não devem possuir container.

Objects não devem participar de coleta.

Objects não devem ser tratados como entidades de gameplay.

Objects podem ter colisão futuramente, mas isso deve ser tratado como propriedade estrutural do objeto de cena, não como interação de Actor.

---

## 3. Motivo da separação

Não reutilizar Actors para objetos decorativos.

Motivos:

1. Evita confusão visual e semântica para o jogador.
2. Evita misturar objetos interativos com objetos não interativos.
3. Evita carregar o sistema de Actors com entidades que não precisam de gameplay.
4. Evita poluir runtime, eventos e stores com objetos estáticos.
5. Mantém o backend autoritativo e organizado por domínio.
6. Permite evoluir o editor de mundo sem comprometer coleta, NPCs, containers ou combate.

Mesmo que um Object e um Actor pareçam visualmente similares, eles devem ter assets separados sempre que isso evitar ambiguidade.

Exemplo:

```txt
Pedra minerável    -> Actor
Pedra decorativa   -> Object
Árvore coletável   -> Actor
Árvore decorativa  -> Object
```

A implementação deve favorecer essa leitura clara.

---

## 4. Nome do painel no debug/editor

No topo do painel atual existe uma seção expansível relacionada ao debug do mundo.

Criar uma nova seção expansível acima ou junto das seções atuais, usando o mesmo padrão visual e comportamental já existente no painel.

Nome da seção:

```txt
Object Respawn
```

A seção deve abrir e fechar no mesmo estilo das seções atuais.

O nome foi escolhido para deixar claro que esta área serve para invocar/spawnar entidades de edição no mundo.

---

## 5. Estrutura esperada do painel `Object Respawn`

A seção deve conter dois blocos separados:

```txt
Object Respawn
├── Spawn Object
└── Spawn Actor
```

### 5.1 Spawn Object

Bloco responsável por criar objetos de cenário.

Deve conter:

- select/lista de tipos de objects disponíveis;
- botão para spawnar o object selecionado;
- ao spawnar, o object deve aparecer próximo ao jogador;
- o object criado deve ficar automaticamente selecionado;
- o painel deve exibir o ID da instância criada.

### 5.2 Spawn Actor

Bloco responsável por criar actors.

Deve conter:

- select/lista de tipos de actors disponíveis;
- botão para spawnar o actor selecionado;
- ao spawnar, o actor deve aparecer próximo ao jogador;
- o actor criado deve ficar automaticamente selecionado;
- o painel deve exibir o ID da instância criada.

Importante: o painel pode compartilhar a mesma interface visual, mas a lógica de criação, persistência e atualização deve ser separada.

---

## 6. Seleção de entidade

Quando uma entidade for selecionada no editor, o painel deve exibir claramente:

```txt
Selected
Kind: OBJECT | ACTOR
ID: número da instância
Type: código/tipo da entidade
```

Exemplo para Object:

```txt
Selected
Kind: OBJECT
ID: 43
Type: DECOR_ROCK_01
```

Exemplo para Actor:

```txt
Selected
Kind: ACTOR
ID: 12
Type: NPC_BASIC
```

Isso é necessário porque podem existir várias instâncias iguais no mapa.

Exemplo: se existirem 50 pedras, o editor precisa mostrar exatamente que a pedra selecionada é a instância `43`, evitando que o usuário altere a instância errada.

---

## 7. Edição de transform

O painel deve permitir editar o transform da entidade selecionada.

Campos mínimos:

```txt
Position X
Position Y
Position Z

Rotation X
Rotation Y
Rotation Z

Scale X
Scale Y
Scale Z
```

O mesmo bloco visual de transform pode ser usado para Object e Actor, desde que a aplicação da alteração use fluxos separados.

```txt
Se Kind = OBJECT -> salvar em tabela/API de objects
Se Kind = ACTOR  -> salvar em tabela/API de actors
```

Escala default pode seguir o padrão atual do projeto.

Não implementar regra especial de escala se o projeto já possui padrão definido.

---

## 8. Spawn próximo ao jogador

Ao clicar para spawnar Object ou Actor, a entidade deve nascer próxima ao jogador.

A entidade não deve nascer exatamente no centro do player.

A posição inicial deve usar a posição atual do jogador como referência e aplicar um pequeno offset seguro.

A implementação pode usar o padrão já existente no projeto para posição, direção, câmera ou player runtime.

O objetivo é evitar spawn em cima do player e reduzir risco de bug visual ou colisão.

---

## 9. Frontend — estrutura separada para Objects

Criar uma nova pasta separada para Objects.

Sugestão:

```txt
cliente/src/World/entities/objects/
```

Estrutura esperada:

```txt
objects/
├── ObjectsLayer.jsx
├── ObjectFactory.js
├── ObjectMappings.js
├── DefaultObject.jsx
└── objectCatalog.js
```

A estrutura pode variar conforme o padrão atual do projeto, mas deve respeitar os seguintes princípios:

- não colocar objects dentro da pasta de actors;
- não reutilizar `ActorsLayer` como camada de objects;
- não misturar factory de Actor com factory de Object;
- não misturar mappings de Actor com mappings de Object;
- não usar lógica de interação de Actor para Object;
- não tratar Object como Actor no frontend.

A camada de render deve ser independente:

```jsx
<ObjectsLayer objects={snapshot.sceneObjects} />
<ActorsLayer actors={snapshot.actors} />
```

A ordem pode seguir o padrão atual do `GameCanvas`.

---

## 10. Assets de Objects

Objects devem ter assets próprios.

Não usar assets de Actor para Objects quando isso puder causar confusão de leitura para o jogador.

A implementação deve deixar o catálogo de Objects separado do catálogo/mapping de Actors.

O Codex deve usar os padrões já existentes do projeto para carregar/renderizar assets, mas mantendo a separação lógica.

Não hardcodar Objects dentro da lógica de Actors.

---

## 11. Banco de dados — modelagem necessária

Criar um sistema de banco separado para Objects, inspirado no padrão usado por Actor, mas sem carregar regras de gameplay que pertencem a Actor.

A modelagem deve conter pelo menos:

```txt
ga_scene_object_def
ga_scene_object
```

O nome pode ser ajustado se o projeto já tiver uma convenção mais específica, mas a intenção é:

```txt
Definição do objeto  -> catálogo/tipo
Instância do objeto  -> objeto colocado no mundo
```

---

## 12. Tabela `ga_scene_object_def`

Tabela de definição/catálogo dos objetos disponíveis para spawn.

Representa o tipo do objeto.

Exemplos:

```txt
DECOR_ROCK_01
WOOD_BENCH_01
LAMP_POST_01
FENCE_WOOD_01
TREE_DECORATIVE_01
```

Campos sugeridos:

```txt
id
code
name
category
status
mesh_template_id
render_material_id
default_state_json
created_at
updated_at
```

### Regras

- `code` deve ser único.
- `status` deve permitir ativar/desativar defs sem apagar histórico.
- `mesh_template_id` deve apontar para o sistema visual/asset já usado pelo projeto, se aplicável.
- `render_material_id` deve seguir o padrão visual já existente, se aplicável.
- `default_state_json` pode guardar metadados leves do objeto, sem virar regra de gameplay.

Não criar campos de coleta, container, recurso ou interação nessa tabela.

---

## 13. Tabela `ga_scene_object`

Tabela de instâncias colocadas no mundo.

Cada linha representa um objeto específico posicionado em uma instância do mapa.

Exemplo:

```txt
Pedra decorativa #43 na instância 1
Banco #12 na instância 1
Poste #5 na instância 2
```

Campos sugeridos:

```txt
id
scene_object_def_id
instance_id

pos_x
pos_y
pos_z

rot_x
rot_y
rot_z

scale_x
scale_y
scale_z

status
state_json

created_at
updated_at
```

### Regras

- `scene_object_def_id` referencia `ga_scene_object_def.id`.
- `instance_id` referencia `ga_instance.id`.
- posição, rotação e escala devem ser persistidas.
- `status` deve permitir pelo menos `ACTIVE` e `DISABLED`.
- `state_json` deve ser reservado para dados leves e versionáveis, sem substituir colunas principais.
- cada instância precisa ter ID próprio, pois o editor deve mostrar e manipular a instância exata.

---

## 14. Campos de colisão

A implementação pode preparar campos de colisão se isso encaixar bem no padrão atual.

Sugestão mínima:

Na definição:

```txt
default_collision_kind
default_collision_radius
```

Na instância:

```txt
collision_kind
collision_radius
```

Ou alternativamente:

```txt
collision_json
```

A colisão não deve ser confundida com interação.

Uma pedra decorativa pode ser bloqueante sem ser coletável.

Para o MVP, colisão pode ser apenas armazenada/declarada se ainda não houver aplicação autoritativa no movimento.

Não criar física complexa nesta etapa se o projeto ainda não exige isso.

---

## 15. Backend — models Sequelize

Criar models Sequelize para as novas tabelas seguindo o padrão atual do projeto.

Models esperados:

```txt
GaSceneObjectDef
GaSceneObject
```

Associações esperadas:

```txt
GaSceneObjectDef.hasMany(GaSceneObject)
GaSceneObject.belongsTo(GaSceneObjectDef)

GaInstance.hasMany(GaSceneObject)
GaSceneObject.belongsTo(GaInstance)
```

Se o projeto usar `GaMeshTemplate` e `GaRenderMaterial` para visual, associar também:

```txt
GaSceneObjectDef.belongsTo(GaMeshTemplate)
GaSceneObjectDef.belongsTo(GaRenderMaterial)
```

Ou equivalente conforme padrão atual.

---

## 16. Backend — migrations

Criar migrations para:

```txt
ga_scene_object_def
ga_scene_object
```

As migrations devem respeitar o estilo do projeto:

- nomes de tabela com prefixo `ga_`;
- timestamps conforme padrão atual;
- `underscored`;
- índices nos campos de busca;
- FK com `onUpdate` e `onDelete` coerentes;
- `code` único em def;
- índices por `instance_id`, `status`, `scene_object_def_id`.

Índices mínimos sugeridos:

```txt
ga_scene_object_def:
- unique(code)
- status
- category

ga_scene_object:
- instance_id
- scene_object_def_id
- status
- instance_id + status
```

---

## 17. Backend — seed inicial

Criar seed inicial com alguns Objects de teste.

Exemplos:

```txt
DECOR_ROCK_01
DECOR_ROCK_02
WOOD_BENCH_01
LAMP_POST_01
```

O seed deve seguir o padrão do projeto.

Não misturar seed de Actor com seed de Object.

---

## 18. Backend — service de Objects

Criar service próprio para Objects.

Sugestão:

```txt
server/service/sceneObjectService.js
```

Responsabilidades:

- listar defs disponíveis;
- carregar objects ativos da instância;
- criar object próximo ao jogador;
- atualizar transform de object;
- desativar/deletar object;
- montar payload de sceneObjects para o snapshot.

O service não deve depender de lógica de Actor.

O service não deve chamar regras de coleta.

O service não deve criar container.

---

## 19. Backend — integração com bootstrap

Atualizar o bootstrap do mundo para incluir:

```txt
snapshot.sceneObjects
```

O payload deve conter as instâncias ativas de Objects da instância atual.

Formato conceitual:

```js
{
  id,
  objectType,
  defId,
  pos,
  rot,
  scale,
  status,
  visual,
  state
}
```

O formato final deve seguir os padrões reais do projeto.

O importante é que o frontend consiga renderizar os objects sem consultar lógica de Actor.

---

## 20. Backend — rotas/API do editor

Criar rotas separadas para editor de Objects e Actors.

Sugestão conceitual:

```txt
GET    /world/editor/object-defs
POST   /world/editor/objects
PATCH  /world/editor/objects/:id
DELETE /world/editor/objects/:id

GET    /world/editor/actor-defs
POST   /world/editor/actors
PATCH  /world/editor/actors/:id
DELETE /world/editor/actors/:id
```

Os nomes finais podem seguir o padrão já existente no projeto.

### Regras importantes

- Spawn de Object usa service de Object.
- Spawn de Actor usa service de Actor.
- Update de Object altera `ga_scene_object`.
- Update de Actor altera `ga_actor`.
- Delete pode ser hard delete ou status `DISABLED`, conforme padrão atual do projeto.
- Preferir status `DISABLED` se o projeto já usa esse padrão para manter histórico/consistência.

---

## 21. Permissão de editor

As rotas do editor não devem ficar abertas para qualquer jogador comum.

Implementar ou reaproveitar uma validação mínima de permissão.

Regras mínimas:

```txt
usuário autenticado
usuário autorizado a usar ferramenta de editor/debug
```

Se o projeto ainda não tiver sistema de role/admin, deixar a validação preparada no service/router conforme padrão atual, sem espalhar bypass pelo código.

---

## 22. Frontend — services

Criar service separado para o editor, se ainda não existir.

Sugestão:

```txt
cliente/src/services/WorldEditor.js
```

Responsabilidades:

- buscar object defs;
- buscar actor defs;
- criar object;
- criar actor;
- atualizar transform;
- deletar/desativar entidade.

Não misturar isso no service de bootstrap normal se isso sujar o contrato do jogo.

---

## 23. Frontend — estado de seleção

Criar ou reaproveitar um estado de seleção que diferencie claramente:

```js
{
  kind: "OBJECT" | "ACTOR",
  id: number,
  type: string
}
```

Nunca depender apenas do tipo visual.

Nunca selecionar por índice de array.

Sempre selecionar por ID persistido.

---

## 24. Frontend — userData dos meshes

Todo mesh criado para Object deve receber `userData` próprio.

Exemplo conceitual:

```js
mesh.userData = {
  kind: "OBJECT",
  id,
  objectType
}
```

Actor deve continuar usando seu próprio `userData`.

Exemplo conceitual:

```js
mesh.userData = {
  kind: "ACTOR",
  id,
  actorType
}
```

O sistema de clique/seleção deve conseguir distinguir os dois.

---

## 25. Frontend — renderização de Objects

Criar `ObjectsLayer`.

Responsabilidades:

- receber `snapshot.sceneObjects`;
- criar/remover meshes conforme payload;
- usar `ObjectFactory`;
- aplicar posição, rotação e escala;
- manter `userData` correto;
- não registrar handlers de interação de Actor;
- não emitir eventos de coleta/interação.

---

## 26. Frontend — `ObjectFactory`

Criar factory própria para Objects.

Responsabilidades:

- resolver o visual do object;
- aplicar fallback visual se necessário;
- criar mesh;
- aplicar transform;
- retornar objeto pronto para a cena.

Não importar factory de Actors como base rígida.

Pode reaproveitar helpers genéricos se eles forem realmente genéricos, mas não acoplar Object ao domínio de Actor.

---

## 27. Fluxo de Spawn Object

Fluxo esperado:

```txt
1. Usuário abre Object Respawn.
2. Usuário escolhe um Object no select.
3. Usuário clica em Spawn Object.
4. Frontend envia request ao backend.
5. Backend valida usuário/permissão.
6. Backend calcula posição próxima ao jogador.
7. Backend cria registro em ga_scene_object.
8. Backend retorna payload do novo object.
9. Frontend adiciona object ao snapshot local ou força refresh controlado.
10. Frontend seleciona automaticamente o novo object.
11. Painel mostra Kind OBJECT, ID e Type.
```

---

## 28. Fluxo de Spawn Actor

Fluxo esperado:

```txt
1. Usuário abre Object Respawn.
2. Usuário escolhe um Actor no select.
3. Usuário clica em Spawn Actor.
4. Frontend envia request ao backend.
5. Backend valida usuário/permissão.
6. Backend calcula posição próxima ao jogador.
7. Backend cria registro em ga_actor, usando padrão atual de Actor.
8. Backend retorna payload do novo actor.
9. Frontend adiciona actor ao snapshot local ou força refresh controlado.
10. Frontend seleciona automaticamente o novo actor.
11. Painel mostra Kind ACTOR, ID e Type.
```

---

## 29. Fluxo de edição de transform

Fluxo esperado:

```txt
1. Usuário seleciona Object ou Actor na cena.
2. Painel mostra Kind, ID e Type.
3. Usuário altera posição, rotação ou escala.
4. Frontend envia PATCH para rota correta.
5. Backend valida bounds/entidade/permissão.
6. Backend persiste alteração.
7. Frontend atualiza snapshot local com retorno confirmado.
```

Não deixar o cliente ser fonte definitiva da posição salva.

O cliente envia intenção de edição.

O backend confirma o estado persistido.

---

## 30. Snapshot local após criação/edição

Após criar ou editar Object/Actor, o frontend pode:

1. aplicar o payload retornado diretamente no snapshot local; ou
2. solicitar resync/bootstrap parcial.

Preferir aplicar o payload retornado se o padrão atual do projeto já trabalha com atualização local confirmada.

Não deixar o objeto existir somente no Three.js sem persistência.

---

## 31. Exclusão/desativação

O painel deve permitir remover/desativar a entidade selecionada.

A ação deve mostrar o ID e o tipo da entidade selecionada.

Exemplo:

```txt
Delete OBJECT #43 — DECOR_ROCK_01
Delete ACTOR #12 — NPC_BASIC
```

Evitar botões genéricos que possam apagar a entidade errada.

Se o projeto já usa `status = DISABLED`, preferir seguir esse padrão.

---

## 32. Duplicação

Implementar duplicação se for simples dentro do fluxo.

Fluxo:

```txt
1. Seleciona Object ou Actor.
2. Clica Duplicate.
3. Backend cria nova entidade com mesmo tipo e transform semelhante.
4. Nova entidade recebe pequeno offset.
5. Nova entidade vira a seleção atual.
```

Se for muito custoso, deixar preparado para uma segunda etapa.

---

## 33. Critérios de aceite

A implementação será considerada correta se:

- existir sistema de Objects separado de Actors;
- existir pasta própria no frontend para Objects;
- existir modelagem/tabelas separadas no banco para Objects;
- Objects forem carregados no bootstrap em `snapshot.sceneObjects` ou equivalente;
- Objects forem renderizados por camada própria;
- o painel tiver seção expansível `Object Respawn`;
- o painel tiver select separado para Object;
- o painel tiver select separado para Actor;
- Spawn Object criar uma instância persistida;
- Spawn Actor continuar usando domínio de Actor;
- entidade criada aparecer próxima ao jogador;
- entidade criada ficar automaticamente selecionada;
- painel mostrar `Kind`, `ID` e `Type`;
- alterações de posição/rotação/escala forem persistidas no banco;
- seleção por clique diferenciar `OBJECT` e `ACTOR`;
- nenhum Object depender de lógica de coleta, container ou interação de Actor.

---

## 34. O que não fazer

Não fazer:

```txt
- colocar Objects dentro de actors/
- usar ActorFactory para Objects de forma acoplada
- salvar Objects em ga_actor
- criar container para Object decorativo
- tratar pedra decorativa como actor coletável
- misturar select de Object e Actor em um único tipo indistinto
- selecionar entidades por índice de array
- spawnar entidade sem persistir no banco
- deixar o cliente como fonte final da posição salva
- hardcodar lógica de gameplay em Object
```

---

## 35. Resultado esperado

Ao final, o editor deve permitir montar cenário visual de forma segura e persistente.

O usuário deve conseguir:

```txt
1. abrir o painel;
2. expandir Object Respawn;
3. escolher um Object decorativo;
4. spawnar esse Object perto do player;
5. ver o ID exato do Object selecionado;
6. mover, rotacionar e escalar;
7. salvar a alteração no banco;
8. escolher um Actor em outro select;
9. spawnar esse Actor separadamente;
10. editar Actor sem misturar com Object.
```

A arquitetura final deve manter a separação:

```txt
Objects constroem cenário.
Actors executam gameplay.
```

Essa é a regra principal da implementação.
