# Sistema de Status - Contrato Tecnico

## Objetivo

Fechar a base tecnica do sistema de status antes de qualquer implementacao de regra.

Este contrato define:

- onde o estado vive
- quem le e quem escreve
- como o tempo entra no calculo
- como o servidor persiste e replica
- quais integracoes serao reutilizadas

---

## Decisoes Fechadas

### 1. O servidor continua sendo a fonte da verdade

- toda decisao de status e autoritativa no backend
- o cliente apenas renderiza o estado confirmado
- nenhum calculo de imunidade, doenca ou debuff deve depender do front

### 2. `ga_user_stats` continua sendo o contrato persistente principal

O sistema novo entra no mesmo trilho ja usado por:

- HP
- stamina
- fome
- sede
- ataque e defesa

Ou seja:

- status persistente fica em `ga_user_stats`
- runtime fica com valores derivados e transitórios
- `updated_at` do registro continua sendo o ancorador temporal padrao para catch-up

### 3. `ga_user_runtime` continua sendo apenas estado de sessao

- movimento
- posicao
- conexao
- camera
- flags temporarios de sessao

Status persistente nao deve ser armazenado como verdade primaria em `ga_user_runtime`.

### 4. `flushUserStats` e o ponto unico de persistencia dos status

- qualquer mudanca relevante de status deve marcar `dirtyStats`
- a persistencia final continua passando por `flushUserStats`
- o caminho de desconexao e shutdown continua valido sem tratamento especial novo

### 5. O tick de status sera servidor-side

- o sistema precisa de um loop autoritativo
- esse loop pode ser separado ou acoplado a outro tick central
- a regra tecnica principal e que a evolucao venha do servidor e nao do cliente

---

## Contrato De Dados

### Tabela canonica

`ga_user_stats`

### Campos existentes ja reaproveitados

- `hp_current`
- `hp_max`
- `stamina_current`
- `stamina_max`
- `hunger_current`
- `hunger_max`
- `thirst_current`
- `thirst_max`
- `updated_at`

### Novos campos de status a serem adicionados

- `immunity_current`
- `immunity_max`
- `disease_level`
- `disease_severity`
- `sleep_current`
- `sleep_max`

### Regra dos campos

- `immunity_current` e `immunity_max` representam a resistencia atual do jogador
- `disease_level` representa o nivel unico de 1 a 10
- `disease_severity` representa a intensidade do evento em faixa `0` a `1`
- `sleep_current` e `sleep_max` representam o estado de sono como percentual de bonus/penalidade

### Tipos esperados

- valores percentuais e fracionarios devem usar tipo decimal ou double, nao inteiro
- limites logicos continuam sendo validados no servidor
- `immunity_max` deve permanecer no intervalo `100..500`
- `sleep_current` e `sleep_max` devem permanecer no intervalo `0..100`
- `disease_level` deve permanecer no intervalo `0..10`

---

## Contrato De Runtime

O runtime do jogador deve passar a carregar um bloco de status derivado, junto com os outros stats.

Forma esperada:

```js
runtime.status = {
  immunity: {
    current,
    max
  },
  disease: {
    level,
    severity
  },
  sleep: {
    current,
    max
  }
}
```

O runtime tambem pode expor espelhos simples para facilitar uso interno, mas a fonte primária continua sendo `runtime.status`.

---

## Contrato De Tick

### Entrada

O tick de status precisa consumir:

- tempo autoritativo do servidor
- estado atual do jogador
- hp atual
- fome atual
- clima ou severidade de clima
- nivel atual da doenca
- estado de sono

### Saida

O tick pode:

- alterar imunidade
- alterar nivel ou severidade da doenca
- alterar sono
- marcar `dirtyStats`

### Regras de escrita

- nenhuma mudanca deve ir direto para o banco fora do flush padrao
- toda mutacao relevante deve passar por runtime em memoria primeiro
- o loop nao deve criar write amplification desnecessaria

---

## Contrato De Integracao

### Leituras existentes que serao reutilizadas

- `loadPlayerCombatStats`
- `ensureRuntimeLoaded`
- `refreshRuntimeCombatStats`
- `flushUserStats`
- `flushUserStatsImmediate`

### Novas leituras esperadas

- adaptador de clima por instancia ou local
- leitura de status do usuario dentro do carregamento de runtime
- possivel loader especifico de status, se a implementacao preferir separar do combate

### Ponto de escrita

- `server/state/persistence/writers.js`

### Pontos de carga

- `server/state/runtime/loader/ensureRuntimeLoaded.js`
- `server/state/runtime/loader/refreshers.js`

### Ponto de loop

- novo loop de status ou encaixe em loop central existente

---

## Regra De Compatibilidade

- fome e sede nao serao reestruturadas nesta etapa
- o sistema novo nao deve quebrar auto food
- o sistema novo nao deve quebrar stamina, combate ou movimento
- qualquer migracao deve preservar valores atuais

---

## Nao Objetivo Desta Etapa

- balanceamento final
- formulas finais de clima
- UI nova de status
- efeitos visuais de doenca
- sistema economico do medico

---

## Resultado Esperado Do Contrato

Ao terminar este contrato, a implementacao seguinte pode seguir sem ambiguidade:

- imunidade fica no caminho de `ga_user_stats`
- doenca usa o mesmo runtime/persistencia padrao
- sleep entra como modificador de XP e estado persistente
- o servidor continua como unica fonte de verdade
- o checklist pode avançar para a implementacao do nucleo de imunidade

