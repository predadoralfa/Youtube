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
- nenhum calculo de imunidade, fever ou debuff deve depender do front

### 2. `ga_user_stats` continua sendo o contrato persistente principal

O sistema novo entra no mesmo trilho ja usado por:

- HP
- stamina
- fome
- sede
- ataque e defesa

Ou seja:

- status persistente fica em `ga_user_stats`
- runtime fica com valores derivados e transitorios
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
- a febre usa flush imediato quando muda de valor, para nao depender apenas do ciclo em batch
- o flush imediato marca o ultimo write de stats para o batch nao regravar o mesmo estado logo em seguida
- o caminho de desconexao e shutdown continua valido sem tratamento especial novo

### 5. O tick de status sera server-side

- o sistema precisa de um loop autoritativo
- esse loop pode ser separado ou acoplado a outro tick central
- a regra tecnica principal e que a evolucao venha do servidor e nao do cliente

---

## Contrato de Dados

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
- `disease_level` representa a carga atual da fever e pode continuar crescendo acima de `100`
- `disease_severity` representa a intensidade normalizada da fever em faixa `0` a `1`
- `sleep_current` e `sleep_max` representam o estado de sono como percentual de bonus/penalidade

### Tipos esperados

- valores percentuais e fracionarios devem usar tipo decimal ou double, nao inteiro
- limites logicos continuam sendo validados no servidor
- `immunity_max` deve permanecer no intervalo `100..500`
- `sleep_current` e `sleep_max` devem permanecer no intervalo `0..100`
- `disease_level` nao possui teto duro para progressao, mas o percentual visual e limitado a `100`
- `disease_severity` deve permanecer no intervalo `0..1`
- `disease_level` e `disease_severity` continuam sendo os campos persistidos no banco para fever

---

## Contrato de Runtime

O runtime do jogador deve passar a carregar um bloco de status derivado, junto com os outros stats.

Forma esperada:

```js
runtime.status = {
  immunity: {
    current,
    max
  },
  fever: {
    current,
    max,
    percent,
    severity,
    active
  },
  debuffs: {
    active,
    tier,
    tempoMultiplier,
    staminaRegenMultiplier
  },
  medical: {
    cooldowns
  },
  sleep: {
    current,
    max
  }
}
```

O runtime tambem pode expor espelhos simples para facilitar uso interno, mas a fonte primaria continua sendo `runtime.status`.

Regras de dominio fechadas:

- `sleep` controla bonus e penalidade de XP, e enquanto o jogador dorme tambem adiciona bonus de recuperacao na imunidade
- o inicio do sleep e bloqueado se a barra estiver acima de `50%`
- `immunity` controla resistencia e recuperacao da fever
- fome abaixo de `30%` reduz imunidade de forma gradual
- HP abaixo de `90%` reduz imunidade
- sede abaixo de `30%` reduz imunidade de forma gradual
- fome e sede abaixo de `30%` ao mesmo tempo geram agravo na perda de imunidade
- fome e sede usam faixas de perda e recuperacao em degraus, com corte forte abaixo de `15%` e `5%`
- ambos acima de `30%` liberam recuperacao plena da imunidade
- a sede passa a ter fonte ambiental de recuperacao via actors de agua no mapa, como `RIVER_PATCH`
- a recuperacao da sede via agua acontece em ciclos com cooldown, em vez de encher tudo de uma vez
- cada ciclo de agua recupera uma parcela pequena da sede, seguindo o mesmo ritmo base de interacao usado para coleta
- o pior caso de fome e sede muito baixas acelera fortemente a queda da imunidade
- a referencia operacional da imunidade e de aproximadamente `8h` para cair de `100` a `0` no caso base e `4h` no pior caso com fome e sede zeradas
- a recuperacao de `0` a `100` continua em aproximadamente `8h`
- a unica doenca ativa nesta fase e `fever`, hardcoded no servidor
- o front-end deve receber o nome em ingles: `fever`
- `debuffs` e um espelho derivado da febre para multiplicadores de tempo
- a fever e resolvida por varreduras periodicas do servidor
- a fever nao drena HP ou stamina diretamente; ela usa a imunidade como referencia de risco
- a varredura atual acontece a cada `1` minuto de jogo
- a fever comeca em `0` e cresce em passos de `2`
- se o jogador nao estiver dormindo e a rolagem aleatoria ficar acima da imunidade atual, a fever sobe `2`
- se o jogador nao estiver dormindo e a rolagem ficar dentro da imunidade atual, a fever desce `1`
- se o jogador estiver dormindo, a fever nao inicia e qualquer fever ativa recua `1`
- a barra visual de fever pode preencher ate `100`, mesmo que `disease_level` continue crescendo
- o tratamento medico base de `HERBS` cura `5%` de HP e entra em cooldown de `1` hora de jogo
- `sleep` aplica multiplicador de XP entre `-10%` e `+20%`, com bonus acima de `30%`
- quando o estado de sleep esta ativo, a imunidade recebe um bonus fixo adicional de `+0.5` na taxa de recuperacao
- o sleep so pode ser iniciado se a barra estiver em `50%` ou menos; acima disso o servidor deve bloquear a entrada
- qualquer ganho de XP deve passar pelo mesmo caminho central de ajuste por sono
- a barra de sono vai de `0` a `100`
- fora da cama, a barra recua ao longo de `24h` de jogo
- dormindo, a barra recupera ate `100` em `3h` de jogo

---

## Contrato de Tick

### Entrada

O tick de status precisa consumir:

- tempo autoritativo do servidor
- estado atual do jogador
- hp atual
- fome atual
- sleep atual
- clima ou severidade de clima
- barra atual da fever

### Saida

O tick pode:

- alterar imunidade
- alterar nivel ou severidade da fever
- marcar `dirtyStats`

### Regras de escrita

- nenhuma mudanca deve ir direto para o banco fora do flush padrao
- toda mutacao relevante deve passar por runtime em memoria primeiro
- o loop nao deve criar write amplification desnecessaria

---

## Contrato de Integracao

### Leituras existentes que serao reutilizadas

- `loadPlayerCombatStats`
- `ensureRuntimeLoaded`
- `refreshRuntimeCombatStats`
- `flushUserStats`
- `flushUserStatsImmediate`
- `flushDirtyBatch`

### Novas leituras esperadas

- adaptador de clima por instancia ou local
- leitura de status do usuario dentro do carregamento de runtime
- possivel loader especifico de status, se a implementacao preferir separar do combate
- leitura e escrita de fever hardcoded enquanto nao houver outras doencas

### Ponto de escrita

- `server/state/persistence/writers.js`

### Pontos de carga

- `server/state/runtime/loader/ensureRuntimeLoaded.js`
- `server/state/runtime/loader/refreshers.js`

### Ponto de loop

- novo loop de status ou encaixe em loop central existente

---

## Regra de Compatibilidade

- fome e sede nao serao reestruturadas nesta etapa
- o sistema novo nao deve quebrar auto food
- o sistema novo nao deve quebrar stamina, combate ou movimento
- qualquer migracao deve preservar valores atuais

---

## Nao Objetivo Desta Etapa

- balanceamento final
- formulas finais de clima
- polimento final da UI de status
- efeitos visuais de doenca
- sistema economico do medico

---

## Resultado Esperado Do Contrato

Ao terminar este contrato, a implementacao seguinte pode seguir sem ambiguidade:

- imunidade fica no caminho de `ga_user_stats`
- fever usa o mesmo runtime/persistencia padrao
- sleep entra como modificador de XP e estado persistente
- o servidor continua como unica fonte de verdade
- o checklist pode avancar para a implementacao do nucleo de imunidade
