# Guia de Registro de Builder

## Objetivo

Este guia explica como registrar um projeto de construcao no jogo, que aqui chamamos de `builder`.

O primeiro caso real do projeto e o `Primitive Shelter`, mas o padrao deve servir para qualquer futura construcao:

- abrigo primitivo
- fogueira
- mesa de trabalho
- parede
- telhado
- qualquer estrutura colocada no mundo e concluida por etapas

O objetivo do guia e evitar que cada nova construcao vire uma excecao improvisada.

Este guia conversa diretamente com:

- [guia-registro-skills-craft.md](/D:/JS-Projects/Youtube/MD/seeds/guia-registro-skills-craft.md)
- [modulo-skills-craft.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-skills-craft.md)
- [guia-registro-research.md](/D:/JS-Projects/Youtube/MD/seeds/guia-registro-research.md)
- [modulo-research.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-research.md)

Motivo:

- a maior parte dos builders futuros vai depender de itens craftados
- esses itens podem depender de research antes de liberar o craft
- o builder nao deve nascer como atalho fora da cadeia normal de progressao

## O que e um Builder

Um builder nao e um item comum do inventario.

Ele e um actor/projeto do mundo que passa por etapas:

1. o jogador posiciona a construcao no chao
2. o servidor cria um projeto `PLANNED`
3. o jogador inicia a construcao com os requisitos corretos
4. o servidor consome os itens exigidos
5. o projeto muda para `RUNNING`
6. o servidor conclui o projeto quando o tempo termina

O builder precisa ser autoritativo no servidor.

E, na pratica, ele costuma depender desta cadeia:

1. research libera conhecimento
2. craft produz o item ou as pecas
3. o builder consome os itens corretos
4. o servidor inicia e conclui a construcao

## Fonte da Verdade

A fonte da verdade do builder deve morar em:

- `ga_actor_def` para a definicao do tipo
- `ga_actor_spawn` para a colocacao no mapa, quando for um spawn fixo
- `ga_actor_runtime` ou equivalente runtime para o estado do projeto em execucao
- `state_json` do actor para o estado do projeto

Regra central:

- o front so solicita intenções
- o servidor valida, consome, cria, atualiza e conclui
- o cliente apenas renderiza o snapshot confirmado

## Seed Padrao

O builder deve nascer por seed ou migration com pelo menos estes dados:

- `code`
- `name`
- `actor_kind`
- `visual_hint`
- `default_state_json`
- `is_active`

Se o builder tiver spawn fixo no mapa, a seed tambem precisa criar:

- `ga_actor_spawn`

## Exemplo Atual

O exemplo em producao hoje e o `PRIMITIVE_SHELTER`.

Estado base esperado:

- `buildKind = PRIMITIVE_SHELTER`
- `structureName = Primitive Shelter`
- `constructionState = PLANNED`
- `constructionStartedAtMs = null`
- `constructionCompletedAtMs = null`
- `constructionProgressMs = 0`
- `constructionDurationMs = 180000`
- `buildRequirements = [{ itemCode: "GRAVETO", quantity: 1 }]`
- `buildSkillCode = SKILL_BUILDING`
- `buildXpReward = 50`
- `canCancel = true`
- `canBuild = true`
- `footprint` definido

## Regras de Registro

### 1. O builder precisa ter um codigo estavel

Use sempre um codigo unico e fixo.

Exemplo:

- `PRIMITIVE_SHELTER`

Nao trocar o codigo depois que a seed entrar em uso.

### 2. O builder precisa declarar o tempo de construcao

O tempo base precisa ficar no state padrao.

Exemplo:

- `constructionDurationMs = 180000`

### 3. O builder precisa declarar os requisitos

Os requisitos devem ficar no `default_state_json` do actor.

Exemplo:

```json
{
  "buildRequirements": [
    {
      "itemCode": "GRAVETO",
      "quantity": 1
    }
  ]
}
```

Regra importante:

- so contam itens nas maos, `HAND_L` e `HAND_R`
- itens guardados em containers nao contam para iniciar a construcao

### 4. O builder precisa declarar a recompensa

A construcao precisa apontar para a skill e para a XP final.

Exemplo:

- `buildSkillCode = SKILL_BUILDING`
- `buildXpReward = 50`

### 5. O builder precisa declarar a area visual

Mesmo sem asset proprio, o builder precisa ter:

- `footprint.width`
- `footprint.height`

Isso ajuda:

- selecao no mundo
- cancelamento
- posicionamento
- futura troca por asset real

## Fluxo de Seed

### Passo 1: criar a definicao do actor

Criar ou atualizar a linha em `ga_actor_def`.

Campos esperados:

- `code`
- `name`
- `actor_kind`
- `visual_hint`
- `default_state_json`
- `is_active`

### Passo 2: decidir se ha spawn fixo

Se o builder for um ponto fixo do mapa:

- criar `ga_actor_spawn`
- apontar para o `actor_def`
- registrar `instance_id`
- registrar posicao

Se o builder for projetado pelo jogador:

- nao criar spawn fixo
- criar apenas o projeto runtime quando a acao acontecer

### Passo 3: definir o contrato de estado

O `default_state_json` precisa refletir o que o servidor sabe processar.

Campos ja usados no projeto:

- `constructionState`
- `constructionStartedAtMs`
- `constructionCompletedAtMs`
- `constructionProgressMs`
- `constructionDurationMs`
- `buildRequirements`
- `buildSkillCode`
- `buildXpReward`
- `canCancel`
- `canBuild`
- `footprint`

## Regras de Cancelamento

O cancelamento so faz sentido enquanto o projeto estiver em `PLANNED`.

Depois que a construcao comecar:

- o projeto deixa de ser apenas marca no chao
- o servidor passa a controlar o progresso
- o cancelamento precisa obedecer o estado autoritativo

## Regras de Consumo

O builder inicial usa apenas:

- `GRAVETO`

Se no futuro uma construcao exigir mais itens:

- atualizar `buildRequirements`
- manter a contagem por mao
- nao somar itens de container automaticamente

Se os itens vierem de craft:

- registrar o craft primeiro
- registrar o unlock de research, se necessario
- so depois registrar o builder

## Checklist de um Builder Novo

Antes de criar um novo builder, conferir:

- o codigo e estavel
- o tempo de construcao esta no state
- os requisitos estao no state
- a recompensa de XP esta declarada
- o cancelamento respeita o estado
- o front nao decide sozinho a conclusao
- o server consegue concluir depois do tempo

## Regra de Ouro

Se o builder exige algo do jogador, isso precisa existir no banco e no servidor antes de virar card bonito no front.

O front nunca deve ser a fonte da verdade do builder.
