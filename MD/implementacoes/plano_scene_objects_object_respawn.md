# Plano de Implementacao - Scene Creator e Scene Objects

## 1. Objetivo

Substituir a direcao anterior de editar `Actor` e futuros `SceneObject` dentro do cliente jogavel por uma arquitetura nova:

- `client/` continua sendo o jogo;
- `scene-creator/` vira a aplicacao de edicao de cena;
- `server/` continua sendo a autoridade unica;
- `SceneObject` passa a existir como dominio separado de `Actor`;
- toda persistencia de edicao continua passando pelo servidor atual.

O foco deste plano e montar uma ferramenta dedicada para:

- spawnar `SceneObject`;
- spawnar `Actor`;
- selecionar entidades de cena;
- editar posicao, `yaw` e escala;
- desativar/remover entidades;
- persistir tudo no banco de dados;
- manter o jogo principal limpo de ferramentas de edicao.

---

## 2. Decisao arquitetural

### Regra principal

Nao evoluir o editor de cena dentro do cliente jogavel.

Em vez disso:

- remover `lil-gui` e fluxo de edicao do `client/`;
- criar um frontend novo em `scene-creator/`;
- reaproveitar o backend atual para bootstrap e persistencia;
- reaproveitar o maximo possivel dos modulos visuais e contratos ja existentes.

### Autoridade

O `scene-creator` nao acessa o banco diretamente.

Toda leitura e escrita passa pelo `server/`.

Isso evita:

- incoerencia de contrato;
- duplicacao de logica autoritativa;
- segundo canal de escrita fora do backend;
- risco de seguranca desnecessario.

---

## 3. Separacao de dominios

```txt
Actor       = entidade de gameplay
SceneObject = entidade de cenario/composicao visual
```

### Actor

Continua representando:

- NPC;
- container;
- recurso coletavel;
- estrutura funcional;
- entidade com interacao;
- entidade com estado de gameplay.

### SceneObject

Passa a representar:

- pedra decorativa;
- banco;
- poste;
- ruina;
- vegetacao decorativa;
- cerca;
- item de composicao visual sem gameplay.

### Regra

`SceneObject` nao:

- participa de coleta;
- recebe container;
- entra em `interact:start`;
- vira entidade de gameplay.

---

## 4. Mudanca de escopo do cliente jogavel

O `client/` deve permanecer apenas com comportamento de jogo.

### Sai do client

- painel `lil-gui`;
- edicao manual de `Actor`;
- fluxo de spawn para manutencao de cena;
- qualquer ferramenta de autoracao de mapa.

### Fica no client

- bootstrap do mundo;
- renderizacao do mundo;
- leitura de `actors`;
- leitura de `sceneObjects`;
- gameplay normal;
- UI de jogo;
- selecao/interacao apenas do que faz sentido no jogo.

---

## 5. Nova aplicacao `scene-creator`

Criar uma nova pasta na raiz:

```txt
scene-creator/
```

Ela sera um frontend dedicado para manejo de cena.

### Responsabilidades

- carregar o mundo pelo servidor atual;
- renderizar `Actor` e `SceneObject`;
- permitir spawn de ambos;
- permitir selecao de ambos;
- permitir edicao de transform;
- permitir delete/disable;
- oferecer locomocao rapida para operador GM;
- nao carregar HUDs e sistemas de gameplay desnecessarios.

### Nao deve carregar

- fome;
- sede;
- stamina;
- inventario;
- combate;
- research;
- build de gameplay;
- modais de jogo;
- overlays de jogador.

---

## 6. Bootstrap do `scene-creator`

O `scene-creator` deve ler a cena a partir do `server/`.

### Direcao recomendada

Criar um bootstrap especifico de editor, derivado do atual.

Exemplo conceitual:

```txt
GET /world/editor/bootstrap
```

Esse payload deve conter apenas o necessario para edicao:

- instance;
- localTemplate;
- proceduralMap;
- actors;
- sceneObjects;
- catalogos de defs;
- dados minimos do operador GM.

### Nao deve depender

O `scene-creator` nao deve montar o mundo lendo o banco por fora do backend.

---

## 7. Permissao de acesso

O `scene-creator` e as rotas de editor devem exigir permissao especial.

### Direcao recomendada

Usar o mesmo usuario/autenticacao existente e adicionar permissao de editor/GM.

Exemplos conceituais:

```txt
role = PLAYER | GM
```

ou:

```txt
can_edit_world = true
```

### Evitar neste momento

- autenticacao totalmente separada;
- frontend acessando banco direto;
- liberar editor para qualquer usuario autenticado.

---

## 8. Painel do Scene Creator

O painel continua simples, no estilo dropdown/retratil, mas agora dentro do `scene-creator`.

Nao depende mais de `lil-gui` do cliente jogavel.

Pode usar:

- `lil-gui` novamente dentro do `scene-creator`; ou
- uma UI propria simples.

Para MVP, e valido continuar com um painel no estilo do que ja existe hoje.

### Estrutura esperada

```txt
Scene Creator
├── Spawn Object
├── Spawn Actor
└── Selected
```

### Spawn Object

Campos minimos:

- select de `SceneObjectDef`;
- toggle `useCurrentPosition`;
- `posX`;
- `posY`;
- `posZ`;
- botao `OK`.

### Spawn Actor

Campos minimos:

- select de `ActorDef`;
- toggle `useCurrentPosition`;
- `posX`;
- `posY`;
- `posZ`;
- botao `OK`.

### Selected

Campos minimos:

```txt
Kind: OBJECT | ACTOR
ID
Type
Position X/Y/Z
Yaw
Scale X/Y/Z
Delete / Disable
```

---

## 9. Transform padrao

A rotacao deve seguir o padrao atual de `Actor`.

### Decisao

Nao usar `rot_x`, `rot_y`, `rot_z` nesta etapa.

Usar:

- `Position X/Y/Z`
- `Yaw`
- `Scale X/Y/Z`

### Regra

`SceneObject` copia o mesmo contrato operacional de transform do `Actor` no MVP.

Isso reduz:

- mudanca de schema;
- mudanca de renderer;
- mudanca de editor;
- superficie de bugs.

---

## 10. Locomocao do operador GM

O `scene-creator` deve oferecer deslocamento rapido.

### Requisitos

- velocidade alta;
- sem stamina;
- sem fome;
- sem sede;
- sem travas de gameplay;
- util em mapas grandes.

### Opcoes aceitas

#### Opcao A - personagem GM rapido

- controla um personagem no mundo;
- usa mesma nocao espacial do jogo;
- bom para posicionamento por referencia visual.

#### Opcao B - camera livre

- voo livre;
- navegacao rapida;
- melhor para edicao ampla.

### Recomendacao

Implementar de forma incremental:

1. personagem GM rapido no MVP;
2. camera livre como etapa futura se fizer falta.

---

## 11. Modelagem de banco para SceneObject

Criar modelagem separada para `SceneObject`.

### Tabelas

```txt
ga_scene_object_def
ga_scene_object
```

### `ga_scene_object_def`

Representa o catalogo de tipos disponiveis.

Campos minimos sugeridos:

```txt
id
code
name
category
asset_key
default_state_json
is_active
created_at
updated_at
```

### Observacao

Para o MVP, `asset_key` e mais coerente com o projeto atual do que `mesh_template_id` e `render_material_id`, porque o frontend existente ainda resolve muito do visual por `asset_key` e mappings.

### `ga_scene_object`

Representa uma instancia posicionada no mundo.

Campos minimos sugeridos:

```txt
id
scene_object_def_id
instance_id
pos_x
pos_y
pos_z
yaw
scale_x
scale_y
scale_z
state_json
status
rev
created_at
updated_at
```

### Status

Minimo:

- `ACTIVE`
- `DISABLED`

---

## 12. Backend para editor

Criar um modulo de editor dentro do `server/`.

Exemplo conceitual:

```txt
server/service/worldEditorService/
server/service/sceneObjectService/
server/router/worldEditorRouter.js
```

### Responsabilidades do editor backend

- bootstrap leve do editor;
- listar `ActorDef`;
- listar `SceneObjectDef`;
- spawnar `Actor`;
- spawnar `SceneObject`;
- atualizar transform;
- deletar/desativar entidade;
- validar permissao GM/editor.

---

## 13. Transporte: HTTP ou socket

Para o `scene-creator`, o mais simples e mais claro e usar API HTTP para operacoes de editor.

### Leitura

- bootstrap por HTTP
- listagem de defs por HTTP

### Escrita

- spawn por HTTP
- update por HTTP
- delete por HTTP

### Observacao

O jogo atual pode continuar usando socket para gameplay.

O `scene-creator` nao precisa reproduzir a estrategia de socket do jogo se HTTP atender bem a ferramenta.

---

## 14. Rotas sugeridas

```txt
GET    /world/editor/bootstrap

GET    /world/editor/actor-defs
POST   /world/editor/actors
PATCH  /world/editor/actors/:id
DELETE /world/editor/actors/:id

GET    /world/editor/object-defs
POST   /world/editor/objects
PATCH  /world/editor/objects/:id
DELETE /world/editor/objects/:id
```

### Regras

- todas exigem autenticacao;
- todas exigem permissao GM/editor;
- `Actor` continua usando dominio de actor;
- `SceneObject` usa dominio proprio;
- `DELETE` pode ser soft delete por `DISABLED`.

---

## 15. Integracao com Actor existente

O editor de actor deve reaproveitar o que ja existe no backend sempre que possivel.

### Reaproveitar

- `ga_actor_def`
- `ga_actor_runtime`
- `createRuntimeActor`
- payload de actor
- loaders existentes

### Evitar

- reescrever fluxo inteiro de actor sem necessidade;
- criar schema paralelo de actor para o editor.

---

## 16. Loader e payload de SceneObject

Criar fluxo proprio para `SceneObject`, inspirado em `Actor`, mas sem regras de gameplay.

### Modulos esperados

```txt
server/service/sceneObjectLoader/
server/service/sceneObjectLoader/payload.js
server/state/sceneObjectsRuntimeStore.js
```

### Payload conceitual

```js
{
  id,
  objectType,
  objectDefCode,
  displayName,
  assetKey,
  instanceId,
  pos: { x, y, z },
  yaw,
  scale: { x, y, z },
  status,
  rev,
  state
}
```

---

## 17. Bootstrap do jogo principal

Mesmo com o editor separado, o jogo principal ainda precisa carregar `SceneObject`.

### Atualizacao esperada

Adicionar ao bootstrap do jogo:

```txt
snapshot.sceneObjects
```

### Objetivo

O `client/` jogavel continua renderizando o cenario corretamente, mesmo sem nenhuma ferramenta de edicao embutida.

---

## 18. Frontend do jogo principal para SceneObject

Criar renderizacao separada para `SceneObject` no `client/`.

### Estrutura sugerida

```txt
client/src/world/entities/objects/
├── ObjectFactory.js
├── ObjectMappings.js
├── DefaultObject.jsx
└── ObjectsLayer.jsx
```

### Principios

- nao misturar com `actors/`;
- nao depender de interacao de actor;
- nao entrar em fluxo de coleta;
- nao poluir gameplay.

---

## 19. Target no jogo principal

`SceneObject` nao deve ser targetavel no cliente jogavel normal.

### Regra

No `client/`:

- `Actor` continua clicavel conforme gameplay;
- `Enemy` continua clicavel;
- `Player` continua clicavel quando fizer sentido;
- `SceneObject` nao entra no fluxo de target de gameplay.

### Importante

O fato de `SceneObject` existir na cena nao significa que ele participa da selecao do jogo.

---

## 20. Target no Scene Creator

No `scene-creator`, `SceneObject` e `Actor` devem ser selecionaveis.

### Regra

O editor precisa distinguir claramente:

```txt
Kind: OBJECT | ACTOR
ID
Type
```

### Nunca fazer

- selecionar por indice de array;
- inferir entidade apenas pelo mesh;
- usar mesma chave sem distinguir dominio.

---

## 21. Reaproveitamento de codigo

O ponto central desta arquitetura e reaproveitar codigo entre `client/` e `scene-creator`.

### Reaproveitar sempre que possivel

- assets;
- factories;
- mappings;
- helpers de leitura de payload;
- normalizadores;
- helpers de posicionamento;
- leitura de terreno;
- contrato de bootstrap.

### Evitar

- copiar e colar `ActorFactory`;
- copiar e colar `pickTargetFromHitObject` sem modularizar;
- manter duas versoes diferentes do mesmo normalizer;
- duplicar contratos de payload.

### Direcao recomendada

Extrair modulos compartilhaveis para uma area comum do frontend.

Exemplo conceitual:

```txt
shared-world/
```

ou reorganizar trechos do `client/src/world` para importacao segura pelos dois frontends.

---

## 22. Ordem de implementacao

### Fase A - Backend base

1. Criar tabelas `ga_scene_object_def` e `ga_scene_object`
2. Criar models Sequelize
3. Criar seeds iniciais de `SceneObjectDef`
4. Criar loader/payload/runtime store de `SceneObject`
5. Incluir `sceneObjects` no bootstrap do jogo

### Fase B - Jogo principal

1. Renderizar `sceneObjects` no `client/`
2. Garantir que nao entram no target de gameplay
3. Remover fluxo antigo de edicao do cliente jogavel

### Fase C - Backend de editor

1. Criar rotas de editor
2. Criar bootstrap leve do editor
3. Criar spawn/update/delete de actor e object
4. Validar permissao GM/editor

### Fase D - Nova aplicacao `scene-creator`

1. Scaffold da nova aplicacao
2. Integracao com bootstrap do backend
3. Render da cena
4. Painel de spawn e selecao
5. Edicao de transform
6. Delete/disable
7. Locomocao GM

### Fase E - Limpeza final

1. Remover `lil-gui` do `client/`
2. Remover socket de edicao do jogo principal
3. Revisar imports compartilhados
4. Validar fluxo completo de persistencia

---

## 23. Criterios de aceite

O plano sera considerado implementado corretamente se:

- existir uma aplicacao `scene-creator/` separada;
- o `scene-creator` usar o `server/` atual para leitura e escrita;
- `SceneObject` existir como dominio separado de `Actor`;
- o jogo principal carregar `sceneObjects` no bootstrap;
- o jogo principal renderizar `sceneObjects`;
- o jogo principal nao expor ferramentas de edicao de cena;
- o jogo principal nao permitir target de `SceneObject` no gameplay;
- o `scene-creator` permitir target de `SceneObject` e `Actor`;
- o `scene-creator` permitir spawn de `SceneObject` e `Actor`;
- o `scene-creator` permitir editar `Position`, `Yaw` e `Scale`;
- o `scene-creator` persistir no banco pelo backend atual;
- o `scene-creator` permitir delete/disable;
- as rotas de editor exigirem permissao GM/editor;
- o `client/` nao depender mais de `lil-gui` para manutencao de cena.

---

## 24. O que nao fazer

Nao fazer:

```txt
- acessar o banco diretamente do frontend do scene-creator
- manter o jogo principal como editor de cena improvisado
- salvar SceneObject em ga_actor_runtime
- liberar editor para qualquer conta autenticada
- duplicar payloads sem necessidade
- copiar factories inteiras para outro frontend sem modularizar
- deixar o client jogavel continuar com painel de edicao
- misturar SceneObject com fluxos de coleta/interacao
```

---

## 25. Resultado esperado

Ao final:

- o jogo principal fica focado em gameplay;
- o `scene-creator` vira a ferramenta de manutencao e composicao de cena;
- `Actor` continua sendo dominio de gameplay;
- `SceneObject` passa a compor o cenario de forma persistente;
- a equipe pode editar mapa e entidades sem poluir o cliente do jogo;
- a arquitetura fica preparada para futuro empacotamento do jogo sem levar o editor junto.

Regra final:

```txt
client/        = jogar
scene-creator/ = editar cena
server/        = autoridade unica
```
