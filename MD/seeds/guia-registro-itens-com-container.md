# Guia de Registro de Itens com Container

## Objetivo

Este guia explica como cadastrar itens que carregam container proprio, como:

- mochilas
- cestas
- bolsas
- sacolas
- caixas equipaveis
- qualquer equivalente que abra slots extras para o jogador

A ideia aqui e evitar os problemas que ja aconteceram no projeto:

- container nascer como se fosse slot da mao
- peso nao somar no inventario
- item equipado nao criar o container correto
- item com conteudo ser descartado sem regra
- loader e UI enxergarem metade do estado antigo e metade do novo

## Regra central

Quando um item concede container, ele continua sendo um item comum de equipamento.

Ao mesmo tempo, ele tambem funciona como "chave" para um container proprio do jogador.

Em termos praticos:

- o item mora em `ga_item_def`
- o comportamento fica em `ga_item_def_component`
- o container real mora em `ga_container`
- a propriedade do container fica em `ga_container_owner`
- o conteudo fica em `ga_container_slot`

O container pertence ao jogador que equipou o item, nao ao item isolado.

## Fluxo recomendado

### 1. Criar a definicao do item

Criar ou atualizar:

- `ga_item_def`

Campos esperados:

- `code`
- `name`
- `category`
- `stack_max`
- `unit_weight`
- `era_min_id`
- `is_active`

Regra:

- o item deve ser equipavel no slot correto
- o `code` precisa ser estavel
- o nome exibido pode ser alterado sem quebrar o contrato tecnico

### 2. Marcar o item como equipavel

Criar:

- `ga_item_def_component` com `component_type = EQUIPPABLE`

No `data_json`, registrar:

- `allowedSlots`
- qualquer restricao de encaixe
- qualquer metadado visual ou funcional necessario

Exemplo de ideia:

```json
{
  "allowedSlots": ["HAND_L", "HAND_R"],
  "visualSlot": "HAND",
  "equipPriority": 10
}
```

### 3. Marcar o item como gerador de container

Criar:

- `ga_item_def_component` com `component_type = GRANTS_CONTAINER`

No `data_json`, registrar pelo menos:

- `containerDefCode`
- `slotRolePrefix`
- `slotCount` se o container for criado por definicao externa
- `maxWeight`
- `transferPolicy`

Exemplo:

```json
{
  "containerDefCode": "BASKET",
  "slotRolePrefix": "GRANTED",
  "slotCount": 8,
  "maxWeight": 2.5,
  "transferPolicy": "KEEP_CONTENT_WHEN_DROPPED_BLOCK_IF_NOT_EMPTY"
}
```

Observacao:

- o nome do container pode ser o mesmo do item, mas o contrato tecnico deve ser o container, nao o item
- se o item for antigo ou legado, a migration precisa realinhar o container com o novo formato

### 4. Criar a definicao do container

Criar:

- `ga_container_def`

Campos esperados:

- `code`
- `name`
- `slot_count`
- `max_weight`
- `is_active`

Regra:

- cada item que concede container precisa apontar para uma `ga_container_def`
- nao reutilizar o slot da mao como se fosse o slot do container
- nao hardcodar o numero de slots no front

### 5. Criar o container quando o item for equipado

Quando o item entra em uma mao valida:

1. o servidor cria ou garante o `ga_container`
2. o servidor cria `ga_container_owner` ligando esse container ao jogador
3. o servidor cria os slots vazios em `ga_container_slot`
4. o payload do inventario passa a incluir esse container

Convencao de `slot_role`:

- `GRANTED:<ITEMCODE>:<SLOT_DE_EQUIPAMENTO>`

Exemplo:

- `GRANTED:BASKET:HAND_L`
- `GRANTED:BACKPACK:HAND_R`

Isso ajuda o loader e a UI a reconhecerem que aquele container veio de um item equipado.

## Regras de peso

O peso total do inventario precisa ser a soma dos containers ativos do jogador.

Base atual do sistema:

- `HAND_L` = `2.5`
- `HAND_R` = `2.5`

O container concedido pelo item entra como bonus separado.

Regra importante:

- nao assumir que o item e a mao sao um unico slot
- nao somar peso no front manualmente
- nao congelar o total em valor fixo

Se o jogador equipar o item:

- o container aparece
- o peso maximo aumenta

Se o jogador tirar o item:

- o container some
- o peso maximo volta ao valor anterior

## Regra de descarte e desequipar

Um item que concede container nao deve ser solto no chao se ainda houver itens dentro dele.

Fluxo correto:

- se o container estiver vazio, pode desequipar ou dropar
- se o container tiver conteudo, bloquear a acao e avisar o jogador

O erro precisa ser claro, por exemplo:

- `GRANTED_CONTAINER_NOT_EMPTY`

Nao fazer:

- destruir o container sem mover o conteudo
- deixar slot fantasma preso no runtime
- permitir metade do estado antigo continuar na UI

## Regra de inventario e UI

A UI deve renderizar o container concedido como bloco proprio.

Nao tratar como:

- slot da mao
- duplicacao de equip slot
- card inventado a partir do nome do item

A UI precisa ler do snapshot autoritativo:

- containers ativos
- ownership do container
- slots reais daquele container

Se o item for antigo ou legado, a UI nao deve tentar adivinhar o estado. O servidor precisa reparar isso primeiro.

## Loader e runtime

O loader do inventario precisa reconstruir o estado completo a partir do jogo vivo:

- equipamento do jogador
- containers concedidos
- ownership dos containers
- slots do container

Pontos de atencao:

- criar o container antes de calcular peso
- criar o container antes de montar o payload
- nao usar cleanup agressivo que apague container valido por engano
- nao deixar o runtime ver so a mao e ignorar o container concedido

## Migracao e legado

Quando um item desse tipo mudar de formato, a migration precisa reparar:

- `ga_item_def`
- `ga_item_def_component`
- `ga_container_def`
- `ga_container`
- `ga_container_owner`
- `ga_container_slot`

Legado comum:

- item antigo ficou preso como container da mao
- container foi criado sem timestamp
- ownership ficou apontando para slot antigo
- UI mostrou nome certo, mas o slot tecnico estava errado

Se isso acontecer, o reparo precisa ser feito no banco e no loader juntos.

## Checklist rapido antes de registrar um novo item desse tipo

1. Definir `ga_item_def`
2. Definir `EQUIPPABLE`
3. Definir `GRANTS_CONTAINER`
4. Definir `ga_container_def`
5. Definir `slot_role` do container concedido
6. Garantir criacao de `ga_container_owner`
7. Garantir criacao de `ga_container_slot`
8. Garantir soma de peso no backend
9. Garantir bloqueio de drop/unequip quando o container tiver itens
10. Garantir que a UI leia o snapshot correto

## Regra de ouro

Se o item concede container, o contrato tecnico principal nao e a imagem, nem o nome, nem a mao.

O contrato principal e:

- item equipado
- container do jogador criado por esse item
- peso autoritativo
- slots reais
- descarte seguro

Se essa cadeia quebrar, corrigir no servidor primeiro e depois refletir no front.
