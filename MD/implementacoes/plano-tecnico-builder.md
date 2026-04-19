# Plano Tecnico - Builder

## Objetivo

Este documento registra a implementacao do sistema de `builder` do jogo.

O builder e a camada de construcao do mundo:

- posiciona projetos no chao
- exige materiais
- consome recursos
- executa progresso no servidor
- conclui a estrutura depois do tempo

O primeiro caso real e o `Primitive Shelter`.

Este plano tambem depende conceitualmente de:

- [modulo-research.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-research.md)
- [modulo-skills-craft.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-skills-craft.md)

Motivo:

- muitos builders vao exigir materiais craftados
- muitos materiais vao exigir research antes de liberar o craft
- o builder deve ser a etapa final da cadeia, nao a primeira

## Estado Atual

Hoje o sistema ja trabalha com:

- colocacao autoritativa do projeto no mundo
- cancelamento validado no servidor
- requisicoes de construcao pelo socket
- progresso de construcao processado no tick
- XP de builder ao concluir
- requisitos checados apenas nas maos
- visual de projeto no mundo para os outros jogadores

Arquivos centrais:

- [server/service/buildService.js](/D:/JS-Projects/Youtube/server/service/buildService.js)
- [server/service/buildProgressService.js](/D:/JS-Projects/Youtube/server/service/buildProgressService.js)
- [server/socket/handlers/buildHandler/register.js](/D:/JS-Projects/Youtube/server/socket/handlers/buildHandler/register.js)
- [client/src/world/scene/TargetBuildCard.jsx](/D:/JS-Projects/Youtube/client/src/world/scene/TargetBuildCard.jsx)
- [client/src/world/build/requirements.js](/D:/JS-Projects/Youtube/client/src/world/build/requirements.js)
- [server/migrations/20260419210000-seed-primitive-shelter-build-actor.js](/D:/JS-Projects/Youtube/server/migrations/20260419210000-seed-primitive-shelter-build-actor.js)
- [server/migrations/20260419223000-update-primitive-shelter-build-config.js](/D:/JS-Projects/Youtube/server/migrations/20260419223000-update-primitive-shelter-build-config.js)

## Problema Que O Builder Resolve

Antes do builder, qualquer construcao futura corria o risco de virar:

- hardcode no front
- hardcode no server
- estado local sem persistencia
- cancelamento visual sem efeito real
- requisito contado de forma errada

O builder cria um fluxo unico para todas as construcoes futuras.

## Modelo Mental

O fluxo do builder e este:

1. o jogador abre a janela de construcao
2. escolhe um projeto
3. posiciona o projeto no mundo
4. o servidor cria o actor do projeto
5. o projeto nasce em `PLANNED`
6. o jogador clica em `Build`
7. o servidor valida os requisitos
8. o servidor consome os itens
9. o estado muda para `RUNNING`
10. o tick do mundo acompanha o tempo
11. ao final, o servidor marca como `COMPLETED`
12. a construcao passa a existir como parte do mundo

Antes desse fluxo, pode existir uma cadeia anterior de preparo:

1. study/research libera o conhecimento
2. craft produz os componentes ou ferramentas
3. o jogador leva os itens para as maos
4. o builder consome e inicia a obra

## Estados Do Builder

### `PLANNED`

Significa que o projeto existe, mas ainda nao foi iniciado.

Nesse estado:

- pode cancelar
- pode validar requisitos
- pode iniciar a construcao

### `RUNNING`

Significa que a construcao ja comecou.

Nesse estado:

- o progresso roda no servidor
- o cliente apenas acompanha o estado
- o cancelamento nao deve agir como se fosse o estado inicial

### `COMPLETED`

Significa que a construacao terminou.

Nesse estado:

- o projeto nao deve voltar para `PLANNED`
- o estado fica persistido
- o servidor pode trocar o visual ou liberar interacoes futuras

## Regras De Requisito

O builder atual usa uma regra simples e importante:

- contar apenas itens equipados nas maos
- ignorar containers
- ignorar inventario guardado fora de `HAND_L` e `HAND_R`

Isso combina com a filosofia geral do projeto:

- research define se o jogador sabe fazer algo
- craft define se ele consegue produzir o item
- builder define se ele consegue transformar os itens em estrutura no mundo

Por que:

- evita falsa aprovacao de craft
- evita inconsistencias entre cliente e servidor
- segue o mesmo padrao de outras acoes autoritativas do jogo

## Configuracao Atual Do Primitive Shelter

Parametro atual:

- `buildKind = PRIMITIVE_SHELTER`
- `structureName = Primitive Shelter`
- `constructionState = PLANNED`
- `constructionDurationMs = 180000`
- `buildRequirements = [{ itemCode: "GRAVETO", quantity: 1 }]`
- `buildSkillCode = SKILL_BUILDING`
- `buildXpReward = 50`
- `canCancel = true`
- `canBuild = true`

## Fluxo Tecnico

### 1. Posicionamento

O cliente pede a posicao.

O servidor:

- valida permissao
- cria o actor runtime
- grava o estado inicial do projeto
- replica para os outros jogadores

### 2. Inicio Da Construcao

Quando o jogador clica em `Build`:

- o servidor checa os requisitos
- o servidor checa o estado atual
- o servidor consome os itens
- o servidor muda o estado para `RUNNING`
- o servidor registra o inicio e o tempo total
- o servidor recompensa XP de builder

### 3. Progresso

O progresso e calculado no servidor por tempo decorrido.

Nao deve depender de:

- animacao do front
- estado local do navegador
- contagem por frame do cliente

### 4. Conclusao

Quando o tempo termina:

- o servidor marca `COMPLETED`
- o actor continua existindo no mundo
- os outros jogadores enxergam o resultado confirmado

## Integracao Com O Frontend

O frontend faz apenas:

- abrir a janela de builder
- mostrar os requisitos
- mostrar o estado do projeto
- enviar intents de `place`, `start` e `cancel`

O frontend nao faz:

- validar regra final
- concluir construcao sozinho
- decidir se o item existe sem o servidor

## Integracao Com O Banco

O builder precisa existir como definicao persistida.

Hoje isso vive no contrato de `ga_actor_def` e no `default_state_json` do actor.

Se no futuro houver variacoes diferentes de builder, o ideal e:

- um `code` por tipo de construcao
- um `default_state_json` por tipo
- um seed ou migration por mudanca estrutural

## Como O Sistema Deve Evoluir

### Fase 1

Manter o `Primitive Shelter` como primeiro builder.

### Fase 2

Criar novos builders com o mesmo contrato:

- fogueira
- mesa de trabalho
- parede
- outras estruturas simples

### Fase 3

Separar melhor:

- construcao por mao
- construcao por mesa
- construcao com mais ingredientes

### Fase 4

Adicionar:

- progresso com mais etapas
- animacao de obra
- bonus de skill
- upgrades de construcao

## Riscos

- deixar requisito so no front
- permitir cancelamento fora de `PLANNED`
- contar item de container como se estivesse na mao
- concluir o projeto sem o tick do servidor
- criar builder novo sem seed clara

## Regra De Ouro

Se o builder existe, ele precisa ter:

- definicao
- posicao ou projeto
- estado
- requisito
- progresso
- conclusao autoritativa

Sem isso, a construcao vira so um efeito visual.
