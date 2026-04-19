# Implementacao de Estamina

## Objetivo

Definir em um unico lugar a mecânica completa de estamina do jogo.

A estamina cobre:

- movimento
- combate
- coleta
- craft
- leitura de vitais e regeneracao
- feedback visual de falha por falta de energia

## Papel do sistema

Estamina nao e apenas uma barra de recurso.

Ela e o custo autoritativo de acao do personagem.

O jogo usa a estamina para:

- limitar sequencias de acao
- modular o ritmo do jogador
- alimentar o balanceamento de combate e sobrevivencia
- controlar o custo de coleta sem ferramenta
- sustentar o consumo gradual de jobs e processos mais longos

## Fonte da verdade

- o servidor decide o valor final
- o cliente apenas exibe o estado confirmado
- o runtime do jogador deve refletir o que foi persistido
- a persistencia continua em `ga_user_stats`
- nenhuma interface deve recalcular a estamina sozinha

## Estrutura atual

### Runtime

O runtime do jogador precisa conseguir ler e sincronizar:

- `staminaCurrent`
- `staminaMax`
- `vitals.stamina`
- `combat.staminaCurrent`
- `combat.staminaMax`
- `stats.staminaCurrent`
- `stats.staminaMax`

### Persistencia

O estado persistido usa:

- `ga_user_stats.stamina_current`
- `ga_user_stats.stamina_max`

### Leitura tolerante

As leituras precisam aceitar:

- campos diretos do runtime
- campos em `stats`
- campos em `combat`
- campos persistidos no snapshot

Isso e importante porque o jogo ja tem fluxos diferentes escrevendo vitais em tempos diferentes.

## Comportamentos ja existentes

### Movimento

O tick de movimento ja consulta vitais, fome e stamina para compor drenagem e regeneracao.

O arquivo central e [server/state/movement/stamina.js](/D:/JS-Projects/Youtube/server/state/movement/stamina.js), com apoio dos helpers em:

- [server/state/movement/stamina/runtimeVitals/readers.js](/D:/JS-Projects/Youtube/server/state/movement/stamina/runtimeVitals/readers.js)
- [server/state/movement/stamina/runtimeVitals/syncers.js](/D:/JS-Projects/Youtube/server/state/movement/stamina/runtimeVitals/syncers.js)
- [server/state/movement/stamina/vitalsTick.js](/D:/JS-Projects/Youtube/server/state/movement/stamina/vitalsTick.js)

### Combate

Ataques ja consomem estamina antes da acao ser confirmada.

O padrao atual esta em [server/service/combatSystem/stamina.js](/D:/JS-Projects/Youtube/server/service/combatSystem/stamina.js):

- distingue ataque melee e ranged
- valida stamina antes de aplicar custo
- atualiza runtime quando o jogador esta online
- cai para `ga_user_stats` quando o runtime nao estiver carregado

### Fome

Fome nao e estamina, mas influencia a regeneracao e a leitura das barras.

A relacao ja existe em:

- [server/service/autoFoodService.js](/D:/JS-Projects/Youtube/server/service/autoFoodService.js)
- [server/state/movement/stamina/hunger.js](/D:/JS-Projects/Youtube/server/state/movement/stamina/hunger.js)
- [MD/implementacoes/implementacao-sistema-de-fome.md](/D:/JS-Projects/Youtube/MD/implementacoes/implementacao-sistema-de-fome.md)

### Craft

O craft usa estamina como custo de execucao e nao como custo instantaneo simples.

O modulo de craft ja documenta esse comportamento em [MD/implementacoes/modulo-skills-craft.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-skills-craft.md), onde o gasto e pensado como consumo gradual ao longo do job.

## Regras por fluxo

### Combate

- cada ataque consome estamina
- a validacao acontece antes de confirmar a acao
- se faltar estamina, a acao falha

### Coleta

- coleta manual sem ferramenta consome `1` ponto de estamina por acao
- a validacao acontece no servidor
- se faltar estamina, a coleta nao conclui
- a coleta continua sendo autoritativa

### Craft

- o custo e gradual
- o servidor valida skill, research, itens e stamina
- se faltar stamina no meio do job, a primeira versao prefere pausar em vez de destruir o fluxo

### Movimento e regen

- o sistema de movimento pode ler a estamina para ajustar custo e velocidade
- a regeneracao deve sempre respeitar o valor persistido e o runtime

## Fluxo padrao de implementacao

Quando uma acao gastar estamina:

1. ler o valor atual do runtime ou do banco
2. validar se ha estamina suficiente
3. subtrair o custo
4. sincronizar runtime e persistencia
5. marcar stats como sujos quando necessario
6. devolver um payload serializavel para o cliente

Esse padrao ja aparece em combate e agora tambem em coleta manual.

## Coleta manual sem ferramenta

O fluxo de coleta usa [server/service/actorCollectService.js](/D:/JS-Projects/Youtube/server/service/actorCollectService.js).

O comportamento fechado ficou assim:

- validar actor, container e item
- validar peso
- mover o item
- consumir `1` stamina
- premiar XP de gathering quando aplicavel
- atualizar runtime e inventario
- emitir o evento de feedback para o cliente

Se a estamina nao estiver disponivel:

- a coleta e bloqueada
- o item nao deve ficar em estado parcial
- o cliente recebe aviso de alerta fora do inventario

## Mensagem para o cliente

Se a acao falhar por estamina:

- o jogo deve mostrar aviso fora do modal de inventario
- a mensagem deve soar como alerta, nao como texto neutro
- o feedback deve vir do evento confirmado pelo servidor

Para coleta, o aviso precisa ser distinto de erro de peso.

## Padroes de erro

Erros de stamina devem ser tratados como falha de energia, nao como falha de inventario.

Erros comuns desse grupo:

- `INSUFFICIENT_STAMINA`
- `PLAYER_STATS_NOT_FOUND`

Erros de outro tipo continuam separados:

- `CARRY_WEIGHT_LIMIT`
- `PLAYER_INVENTORY_FULL`
- `ACTOR_NOT_FOUND`

## Observacoes para evolucao

- qualquer nova acao que gaste energia deve seguir o mesmo padrao
- ferramentas futuras podem alterar custo, mas nao a regra de validacao central
- o cliente nunca deve recalcular a estamina por conta propria
- se o jogo criar ferramentas de coleta, o custo manual pode ser diferenciado por ferramenta sem mudar a base do sistema

## Resultado esperado

Com essa base:

- combate continua gastando stamina por acao
- movimento continua lendo e atualizando vitais corretamente
- craft pode consumir stamina em etapas
- coleta manual sem ferramenta passa a gastar `1` stamina por item coletado
- o jogador recebe aviso claro quando nao houver energia suficiente
