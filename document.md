### PROJETO YOUTUBE - RESUMO DE CADA ARQUIVO DO PROJETO

# FRONT SRC

# LoginModal.jsx (Front) — Explicação e Contrato

Este arquivo define um componente React responsável por **logar o usuário** via email/senha, mostrando um **overlay de carregamento** durante a requisição e delegando ao componente pai a troca de tela e o armazenamento do token.

---

## Objetivo do componente

- Renderizar um **modal** de autenticação no modo **Login**.
- Coletar **email** e **senha**.
- Chamar o serviço `loginUser` e, se houver `token`, disparar `onLoggedIn(token)`.
- Evitar cliques repetidos enquanto a requisição está em andamento (`isSubmitting`).
- Exibir um `LoadingOverlay` enquanto está enviando.

---

## Imports e dependências


import { useState } from "react";
import { loginUser } from "@/services/Auth";
import { LoadingOverlay } from "@/components/overlays/LoadingOverlay";


# RegisterModal.jsx (Front) — Explicação e Contrato

Este arquivo define um componente React responsável por **registrar um novo usuário** via nome, email e senha, delegando ao componente pai a troca de tela após sucesso.

---

## Objetivo do componente

- Renderizar um **modal** de autenticação no modo **Registro**.
- Coletar **nome**, **email** e **senha**.
- Chamar o serviço `registerUser`.
- Após sucesso, exibir mensagem retornada pela API.
- Alternar para o modo login via `onSwitch()`.

---

## Imports e dependências


import { useState } from "react";
import { registerUser } from "@/services/Auth";

# LoadingOverlay.jsx — Componente de Bloqueio Global

Arquivo:
`src/components/overlays/LoadingOverlay.jsx`

Este componente renderiza um **overlay de tela inteira** utilizado para bloquear a interface enquanto uma operação assíncrona está em andamento (login, bootstrap do mundo, carregamento de snapshot, etc).

---

## Objetivo

- Cobrir toda a tela.
- Impedir interação do usuário.
- Exibir uma mensagem de status.
- Garantir acessibilidade básica via ARIA.

---

## Assinatura

export function LoadingOverlay({ message = "Carregando..." })


# AuthPage.jsx — Explicação Técnica

Arquivo:
# src/pages/AuthPage.jsx (ou equivalente)

---

## Objetivo

Componente responsável por:

- Controlar qual modal de autenticação está ativo (`login` ou `register`).
- Alternar entre `LoginModal` e `RegisterModal`.
- Receber `onLoggedIn` e repassar para o modal correspondente.

---

## Imports


# Auth.js — Serviço de Autenticação

Arquivo:
# src/services/Auth.js

## O que faz

Centraliza as chamadas HTTP relacionadas à autenticação.

- registerUser(payload)
  - Envia POST /auth/register.
  - Recebe dados de registro (nome, email, senha).
  - Retorna o JSON da resposta.

- `loginUser(payload)`
  - Envia `POST /auth/login`.
  - Recebe credenciais.
  - Retorna o JSON da resposta (incluindo token, se sucesso).

Não armazena token, não trata estado global e não gerencia UI.  
Apenas realiza requisições à API.


# Socket.js — Serviço de Conexão WebSocket

Arquivo:
`src/services/Socket.js`

## O que faz

Gerencia a conexão Socket.IO do cliente com o backend.

- Mantém uma única instância de socket (singleton).
- `connectSocket(token)`
  - Cria conexão autenticada via `auth: { token }`.
  - Usa apenas transporte `websocket`.
  - Reutiliza conexão existente se já criada.
- `getSocket()`
  - Retorna a instância atual.
- `disconnectSocket()`
  - Desconecta e limpa a instância.

Não escuta eventos nem aplica lógica de jogo.  
Apenas controla ciclo de vida da conexão.


# WorldBootstrap.js — Serviço de Bootstrap do Mundo

Arquivo:
`src/services/WorldBootstrap.js`

## O que faz

Responsável por buscar o snapshot inicial do mundo no backend.

- Envia requisição `GET /world/bootstrap`.
- Inclui o token no header `Authorization`.
- Usa `AbortController` para aplicar timeout de 10s.
- Tenta interpretar a resposta como JSON.
- Se a resposta não for `ok`, retorna objeto padronizado de erro.
- Se ocorrer exceção ou timeout, retorna erro estruturado.
- Em caso de sucesso, retorna os dados do backend (incluindo snapshot).

Não gerencia estado, não renderiza nada e não conecta socket.  
Apenas obtém o estado inicial autoritativo do mundo.

`src/World/WorldRoot.jsx`

## O que faz

Define o ponto de entrada do mundo no cliente, controlando autenticação.

- Verifica se existe `token` no `localStorage` ao montar.
- Se não houver token:
  - Renderiza `AuthPage`.
  - Passa `onLoggedIn` para salvar o token.
- Se houver token:
  - Renderiza `GameShell`.

É responsável apenas por decidir entre autenticação e runtime do jogo.  
Não faz bootstrap, não conecta socket e não renderiza Three.js.


# GameShell.jsx — Orquestrador do Runtime do Cliente

Arquivo:
`src/World/GameShell.jsx`

## O que faz

Controla todo o ciclo de vida do mundo no cliente após autenticação.

- Lê o token do `localStorage`.
- Executa `bootstrapWorld(token)` para obter o snapshot inicial.
- Se houver erro 401, remove o token e recarrega.
- Após o snapshot existir, conecta o Socket.IO com autenticação.
- Escuta `move:state` e atualiza apenas `snapshot.runtime` de forma imutável.
- Faz cleanup de listeners e desconecta o socket no unmount.
- Enquanto carrega, exibe `LoadingOverlay`.
- Quando pronto, entrega `snapshot` e `socket` ao `GameCanvas`.

Não renderiza Three.js, não calcula movimento e não simula mundo. O backend é a única fonte da verdade.


Arquivo:
`src/world/entities/character/CharacterEntity.js`

## O que faz

Define uma classe responsável por encapsular o mesh 3D do personagem usando Three.js.

- No `constructor`:
  - Cria um cilindro padrão.
  - Aplica material básico.
  - Ativa sombra.
  - Ajusta altura para ficar apoiado no chão.

- Método `sync(runtime)`:
  - Atualiza posição (x, z) e rotação (yaw).
  - Usa dados vindos do backend.
  - Não calcula movimento, apenas aplica estado confirmado.

É uma abstração orientada a objeto para representar o personagem dentro da cena.


Arquivo:
`src/world/entities/character/player.jsx`

## O que faz

Define a representação visual do jogador na cena usando Three.js.

- `createPlayerMesh(...)`
  - Cria um cilindro configurável (raio, altura, cor).
  - Ajusta a posição vertical para “pisar” corretamente no chão.
  - Retorna o mesh pronto para ser adicionado à cena.

- `syncPlayer(mesh, runtime)`
  - Atualiza posição (x, z) e rotação (yaw) com base no `runtime` vindo do backend.
  - Não calcula movimento, apenas sincroniza.

Este arquivo é puramente visual e depende do snapshot autoritativo do servidor.

Arquivo:
`src/input/inputBus.js`

## O que faz

Cria um pequeno sistema de publicação/assinatura (pub/sub) para intenções de input.

- `emit(intent)` → envia uma intenção para todos os inscritos.
- `on(fn)` → registra um listener e retorna função de unsubscribe.
- `clear()` → remove todos os listeners.

Não conhece teclado, mouse, Three.js ou servidor. Apenas distribui eventos.



# inputs.js — Binding de Dispositivos

Arquivo:
`src/input/inputs.js`

## O que faz

Escuta eventos reais do navegador (mouse e teclado) e os converte em intenções padronizadas.

- Mouse:
  - Botão direito + movimento → órbita de câmera
  - Scroll → zoom

- Teclado (WASD):
  - Calcula vetor de direção no plano X/Z
  - Emite intenção de movimento sempre que o estado muda

Não move personagem nem calcula física. Apenas transforma eventos físicos em intents enviadas ao `inputBus`.

Arquivo:
`src/input/inputs.js`

---

## Objetivo

Conectar eventos reais do navegador (mouse + teclado) ao `inputBus`, convertendo interações físicas em intenções semânticas (`intents`).

---

## Responsabilidade

- Escutar:
  - Botão direito do mouse (orbit)
  - Movimento do mouse (drag)
  - Scroll (zoom)
  - Teclas W, A, S, D (movimento)
- Traduzir esses eventos em intents.
- Emitir intents via `bus.emit(...)`.
- Fornecer função de cleanup.

---

## Mouse

### Botão direito (RMB)
Ativa modo de arrasto para órbita de câmera.

### Movimento com RMB pressionado
Calcula `dx` e `dy` e emite:


intentCameraOrbit(dx, dy)

# intents.js — Modelo de Intenções de Input

Arquivo:
`src/input/intents.js`

---

## Objetivo

Definir um padrão unificado para representar ações do usuário como **intenções estruturadas**, desacoplando dispositivos físicos (mouse/teclado) da lógica do jogo.

---

## Tipos de Intenção

# O sistema trabalha com três categorias:

- `CAMERA_ZOOM` → Controle de distância da câmera.
- `CAMERA_ORBIT` → Rotação orbital da câmera.
- `MOVE_DIRECTION` → Direção desejada de movimento (vetor X/Z).

---


### SERVER/

# database/config.js — Configuração do Sequelize

Arquivo:
`config/config.js` (ou equivalente do Sequelize CLI)

## O que faz

Define as configurações de conexão com o banco MySQL para diferentes ambientes.

- Carrega variáveis do `.env` via `dotenv`.
- Suporta três ambientes:
  - `development`
  - `test`
  - `production`
- Utiliza:
  - `DB_USER`
  - `DB_PASS`
  - `DB_NAME`
  - `DB_NAME_TEST` (opcional)
  - `DB_HOST`
  - `DB_PORT`

## Características

- Porta padrão: `3306` se não definida.
- Dialeto: `"mysql"`.
- `logging: false` desativa logs SQL no console.
- Estrutura compatível com Sequelize CLI.

Não cria conexão diretamente.  
Apenas fornece parâmetros que o Sequelize usa para iniciar a conexão.


# requireAuth.js — Middleware de Autenticação JWT

Arquivo:
`src/middlewares/requireAuth.js` (ou equivalente)

## O que faz

Middleware do Express responsável por proteger rotas autenticadas.

- Lê o header `Authorization`.
- Verifica se começa com `Bearer `.
- Extrai o token.
- Valida o token usando `jwt.verify`.
- Se válido:
  - Injeta `req.user = { id, display_name }`.
  - Chama `next()` para continuar a requisição.
- Se ausente, inválido ou expirado:
  - Retorna `401` com mensagem apropriada.

## Características

- Usa `process.env.JWT_SECRET` como chave.
- Possui fallback `"chave_mestra_extrema"` caso variável não exista.
- Não consulta banco.
- Não renova token.
- Apenas valida e libera acesso.

É o guardião das rotas protegidas.


# Service/worldService.js

### snapshot.runtime

Estado atual do jogador dentro da instância:

- `user_id`
- `instance_id`
- `pos` → `{ x, y, z }`
- `yaw`

Representa o estado autoritativo do personagem no mundo.

---

### snapshot.instance

Informações da instância onde o jogador está:

- `id`
- `local_id`
- `instance_type`
- `status`

Define o contexto lógico do mundo ativo.

---

### snapshot.localTemplateVersion

String de versionamento baseada no `local.id` e `visual.version`.

Usada para controle de cache e invalidação no cliente.

---

### snapshot.localTemplate

Template declarativo do cenário:

#### local
Identidade do local:
- `id`
- `code`
- `name`
- `local_type`
- `parent_id`

#### geometry
Dimensões base do cenário:
- `size_x`
- `size_z`

#### visual
Configuração declarativa de renderização:

- `ground_material` → material físico (fricção/restituição)
- `ground_mesh` → definição de malha (primitive/gltf)
- `ground_render_material` → aparência (cor, textura, roughness, metalness)
- `ground_color` → fallback simples para renderização
- `version` → versão do template visual

#### debug
Informações auxiliares:
- `bounds` → limites do local

---

## Papel Arquitetural

Este endpoint consolida runtime + instância + template visual em um único snapshot autoritativo.

O cliente não calcula estado de mundo.  
Apenas consome este snapshot e renderiza.


# socket/index.js — Registro e Autenticação de Socket

# socket/index.js — Pipeline de Conexão WebSocket

## Arquivo
`server/socket/index.js`

---

## O que faz

Configura autenticação e ciclo de vida das conexões Socket.IO, incluindo:

- **JWT auth** no handshake.
- **Sessão única por userId** (substitui conexão antiga).
- Integração com **runtimeStore** (presença CONNECTED / DISCONNECTED_PENDING).
- Integração com **persistenceManager** (flush imediato e hook de despawn).
- Integração com **presenceIndex** (join de rooms por instância + interest rooms).

---

## Autenticação

Middleware `io.use`:

- Lê `socket.handshake.auth.token`.
- Aceita `<token>` ou `Bearer <token>`.
- Valida via `jwt.verify(token, JWT_SECRET || "chave_mestra_extrema")`.
- Exige `decoded.id`.
- Injeta:
  - `socket.data.userId`
  - `socket.data.displayName`
- Rejeita conexão com `Error("UNAUTHORIZED")` se inválido.

Contrato compatível com `requireAuth`: `{ id, display_name }`.

---

## Sessão Única por Usuário

Estrutura:

- `activeSocketByUserId: Map<userId, socketId>`

Ao conectar:

- Se já existe socket ativo para o mesmo `userId`:
  - Marca no socket antigo `prev.data._skipDisconnectPending = true` (evita virar pending no disconnect do antigo).
  - Emite `session:replaced` no cliente antigo.
  - Derruba o socket antigo (`prev.disconnect(true)`).
- Registra o socket atual como sessão autoritativa.

Isso evita overlap e race de presença (1 userId = 1 sessão).

---

## Hooks de Persistência

Função `installPersistenceHooks(io)` (instalada uma vez):

- Registra `onEntityDespawn` (evento disparado quando entidade vira **OFFLINE definitivo**).
- Faz broadcast `entity:despawn` para rooms alvo:
  - Sempre inclui `inst:<instanceId>`
  - Inclui também `evt.interestRooms` (se vierem no evento)
- Payload emitido:
  - `{ entityId, rev }`

Objetivo: despawn autoritativo replicado para quem tem interesse.

---

## Conexão

Ao conectar (`io.on("connection")`):

1. Garante sessão única por `userId`.
2. Carrega runtime (`ensureRuntimeLoaded`).
3. Marca presença em memória como **CONNECTED**:
   - `connectionState: "CONNECTED"`
   - `disconnectedAtMs: null`
   - `offlineAllowedAtMs: null`
4. Faz checkpoint imediato:
   - `flushUserRuntimeImmediate(userId)`
5. Registra handlers:
   - `registerMoveHandler(socket)`
6. Emite:
   - `socket:ready`

---

## world:join

Evento `world:join` (mínimo, sem baseline completo):

- Re-garante runtime carregado.
- Lê runtime atual via `getRuntime(userId)`.
- Indexa presença espacial em memória:
  - `addUserToInstance(userId, rt.instanceId, rt.pos)`
- Entra em rooms:
  - `inst:<instanceId>`
  - cada room em `interestRooms` (chunk-based)
- Marca flags no socket:
  - `socket.data.instanceId`
  - `socket.data._worldJoined = true`
- Ack (se fornecido):
  - sucesso: `{ ok:true, instanceId, cx, cz }`
  - erro: `{ ok:false, error }`

Papel: preparar interest/broadcast sem depender de um “worldHandler” maior.

---

## Desconexão

Evento `disconnect`:

- Ignora se:
  - socket foi substituído (`_skipDisconnectPending`)
  - socket não é a sessão atual do user (race/overlap)
- Remove `activeSocketByUserId` do usuário.
- Marca estado como **DISCONNECTED_PENDING** (janela anti-combat-log):
  - `disconnectedAtMs = now`
  - `offlineAllowedAtMs = now + 10s`
- Faz flush imediato:
  - `flushUserRuntimeImmediate(userId)`
- Loga motivo e deadline.

Após os 10s, o `persistenceManager` é quem finaliza para **OFFLINE** e dispara despawn.

---

## Papel no Sistema

- Protege canal WebSocket com JWT.
- Garante **1 sessão autoritativa por userId**.
- Controla presença (CONNECTED / DISCONNECTED_PENDING) no runtime em memória.
- Faz checkpoints imediatos em eventos críticos.
- Conecta interest management (rooms por chunk) via `presenceIndex`.
- Replica despawn autoritativo via hook do `persistenceManager`.

Não calcula movimento.
O `moveHandler` processa intents e só marca runtime como sujo.



## Arquivo
`server/socket/handlers/moveHandler.js`

---

## O que faz

Processa `move:intent` enviado pelo cliente e aplica **movimento autoritativo** no servidor, incluindo:

- Validação e rate limit anti-flood.
- Atualização de `pos` e `yaw` no runtime em memória.
- Incremento de `rev` monotônico por entidade.
- Marcação de persistência (`dirtyRuntime`) sem tocar no banco.
- Detecção de troca de chunk e atualização do interest (rooms).
- Replicação incremental:
  - `entity:delta` para quem tem interesse
  - `entity:spawn` / `entity:despawn` em transição de chunk
- Feedback para o próprio jogador via `move:state`.

---

## Regras de Segurança

- Garante runtime carregado (`ensureRuntimeLoaded(userId)`).
- Ignora intent se:
  - `DISCONNECTED_PENDING`
  - `OFFLINE`
- Rate limit por runtime:
  - `MOVES_PER_SEC = 60`
- Limite de delta time:
  - `DT_MAX = 0.05`
- Valida números (`isFiniteNumber`).
- Normaliza vetor de direção (2D).
- **Velocidade estrita**:
  - se `runtime.speed` inválido/ausente → não move (sem fallback).

Opcional (comentado): só aceitar intents após `world:join`.

---

## Inputs Consumidos

Payload `move:intent`:

- `dir: { x, z }` (vetor desejado no plano)
- `dt` (delta time do cliente, clampado no servidor)
- `yawDesired` (orientação desejada vinda da câmera)

---

## Atualização Autoritativa do Runtime

Fluxo por evento:

1. `allowMove(runtime, nowMs)` aplica janela mínima (anti-flood).
2. `dt = clamp(dtRaw, 0, DT_MAX)`.
3. `yawDesired` (se válido):
   - normaliza ângulo para [-π, π]
   - aplica em `runtime.yaw`
4. `dir`:
   - valida `x/z`
   - normaliza via `normalize2D`
5. `speed = readRuntimeSpeedStrict(runtime)`:
   - se inválida → aborta (log de erro)
6. Aplica deslocamento:
   - `pos.x += d.x * speed * dt`
   - `pos.z += d.z * speed * dt`
7. Se não mudou `pos` nem `yaw`, retorna.
8. `bumpRev(runtime)` incrementa `rev` monotônico.
9. `markRuntimeDirty(userId, nowMs)` (hot path sem DB).

---

## Chunking + Presence (Interest Management)

- Recalcula chunk autoritativo a partir de `runtime.pos`:
  - `computeChunkFromPos(runtime.pos)`
- Compara com `runtime.chunk` anterior.
- Se mudou:
  - `moveUserChunk(userId, cx, cz)` para obter:
    - `diff.entered` (rooms novos)
    - `diff.left` (rooms antigos)
  - Atualiza `runtime.chunk = { cx, cz }`
  - Aplica rooms no socket:
    - `socket.join(r)` para entered
    - `socket.leave(r)` para left
  - Executa transição de visibilidade:
    - `handleChunkTransition(socket, runtime, movedInfo)`

---

## Replicação de Movimento

### 1) Para outros: `entity:delta`

Emite delta mínimo (sem eco no próprio socket):

- Calcula rooms de interesse do mover via `userIndex.get(userId).interestRooms`.
- Para cada room:
  - `socket.to(room).emit("entity:delta", payload)`

Payload:

- `entityId`
- `pos`
- `yaw`
- `hp`
- `action`
- `rev`

---

### 2) Para o próprio jogador: `move:state`

Envia confirmação local imediata:

- `pos`, `yaw`, `rev`, `chunk`

Serve como feedback para render/pred simples no cliente.

---

## Transição de Chunk: Spawn/Despawn

Função `handleChunkTransition(socket, runtime, movedInfo)`:

### A) Outros veem você

Usa `io.to(room)` (broadcast por room):

- Para `enteredRooms`:
  - `entity:spawn` do mover
- Para `leftRooms`:
  - `entity:despawn` do mover

### B) Você vê outros

Envios diretos ao socket do mover:

- Para `enteredRooms`:
  - coleta usuários presentes nesses rooms e emite `entity:spawn` para cada um
- Para `leftRooms`:
  - avalia se o alvo ainda é visível no novo interest (via `getUsersInChunks`)
  - se não for, emite `entity:despawn`

Observação: o arquivo tenta acessar `usersByChunk` via `require("../../state/presenceIndex").usersByChunk` para buscar membros do room.

---

## Dependências

### runtimeStore
- `ensureRuntimeLoaded`
- `getRuntime`
- `markRuntimeDirty`

### presenceIndex
- `moveUserChunk`
- `getUsersInChunks`
- `computeChunkFromPos`
- `userIndex` (leitura/inspeção)

---

## Pontos de Atenção

- O arquivo importa `userIndex` diretamente e também tenta acessar `usersByChunk` via require.
  - Isso só funciona se `presenceIndex` exportar esses objetos.
  - Caso contrário, o spawn/despawn incremental por room quebra e deve ser substituído por API pública (`getUsersInRoom` / `getUsersInRooms`).

- Há um comentário indicando que a checagem `stillVisible` é insuficiente para overlap, e o código compensa recalculando `visibleNow` via `getUsersInChunks`.

---

## Papel no Sistema

- Implementa o movimento autoritativo no hot path (sem DB).
- Atualiza presença espacial e rooms por chunks.
- Replica deltas para jogadores interessados.
- Serve como base para multiplayer escalável (broadcast seletivo por interest).

## Arquivo
`server/state/persistenceManager.js`

---

## O que faz

Gerencia a **persistência controlada** do estado em memória (runtimes) para o banco, usando modelo **hot + batch**, e também finaliza presença após disconnect (anti-combat-log).

Responsável por:

- Rodar loop periódico (`startPersistenceLoop`).
- Finalizar `DISCONNECTED_PENDING -> OFFLINE` após 10s.
- Remover jogador do índice de presença (para não aparecer em baseline).
- Persistir runtimes/stats marcados como dirty, com throttling.
- Emitir evento interno `entity:despawn` para o layer de socket broadcastar.

Não depende de Socket.IO (usa EventEmitter).

---

## Configuração

Defaults (sobrescreva via env):

- `PERSIST_TICK_MS` (default `500ms`)
- `MAX_FLUSH_PER_TICK` (default `200`)

Throttling por usuário:

- `MIN_RUNTIME_FLUSH_GAP_MS` (default `900ms`)
- `MIN_STATS_FLUSH_GAP_MS` (default `1500ms`)

---

## Dependências

### Banco
- `db.GaUserRuntime.update(...)` para persistir runtime.

### runtimeStore
- `getAllRuntimes()` (varredura segura do store)
- `getRuntime(userId)` (leitura do runtime em memória)
- `setConnectionState(userId, patch)` (mudança de estado em memória + marca dirty)

### presenceIndex
- `getUserPresenceState(userId)` (snapshot de rooms/interest antes do despawn)
- `removeUserFromInstance(userId)` (remove presença em memória)

---

## Loop de Persistência

Função `startPersistenceLoop()`:

- Inicia `setInterval` a cada `PERSIST_TICK_MS`.
- Protege contra overlap com `_running` (tick lento não sobrepõe outro).
- Por tick:
  1. `tickDisconnects(now)`
  2. `flushDirtyBatch({ maxUsersPerTick: MAX_FLUSH_PER_TICK, now })`

Função `stopPersistenceLoop()` encerra o timer.

---

## Regras de Disconnect (Anti-Combat-Log)

Função `tickDisconnects(now)`:

Varre todos runtimes e busca:

- `connectionState === "DISCONNECTED_PENDING"`
- `offlineAllowedAtMs != null`
- `now >= offlineAllowedAtMs`

Quando atende:

1. Captura snapshot de presença **antes** de remover:
   - `presence = getUserPresenceState(userId)`
2. Incrementa `rev` monotônico (`bumpRev(rt)`), tratando despawn como “revisão”.
3. Finaliza logout lógico no runtime:
   - `setConnectionState(..., connectionState:"OFFLINE", disconnectedAtMs, offlineAllowedAtMs)`
4. Remove do índice de presença em memória:
   - `removeUserFromInstance(userId)`
5. Emite evento interno:
   - `persistenceEvents.emit("entity:despawn", {...})`

Payload do evento inclui:

- `entityId`
- `instanceId` (do presence snapshot ou fallback do runtime)
- `interestRooms` (rooms anteriores para despawn consistente)
- `rev` (monotônico)
- `atMs` (telemetria)

Objetivo: tirar o OFFLINE real do “mundo visível” e permitir broadcast autoritativo via socket layer.

---

## Batch Flush (Hot + Batch)

Função `flushDirtyBatch({ maxUsersPerTick, now })`:

- Coleta candidatos com:
  - `dirtyRuntime` ou `dirtyStats`
- Ordena por “mais antigo sujo”:
  - usa `lastRuntimeDirtyAtMs` ou `lastStatsDirtyAtMs`
- Processa até `maxUsersPerTick`:

### Runtime
- Só flush se respeitar gap mínimo:
  - `now - _lastRuntimeFlushAtMs >= MIN_RUNTIME_FLUSH_GAP_MS`
- Chama `flushUserRuntime(userId, now)`
- Se ok:
  - atualiza `_lastRuntimeFlushAtMs`
  - incrementa contador de flush do tick

### Stats
- Mesmo padrão com `MIN_STATS_FLUSH_GAP_MS`
- Chama `flushUserStats(userId, now)`

Resultado: evita travar event loop e controla carga no banco.

---

## Flush de Runtime

Função `flushUserRuntime(userId, now)`:

- Lê runtime (`getRuntime`).
- Se `dirtyRuntime` ainda true:
  - Monta payload e faz `UPDATE` por PK `user_id`:

Campos persistidos:

- `instance_id`
- `pos_x`, `pos_y`, `pos_z`
- `yaw`
- `connection_state`
- `disconnected_at`
- `offline_allowed_at`

Após sucesso:

- `rt.dirtyRuntime = false`
- Loga apenas quando `state !== CONNECTED` (reduz ruído).

---

## Flush de Stats

Função `flushUserStats(userId, now)`:

- Hoje: apenas limpa `dirtyStats` (place-holder).
- Preparado para evoluir para write-back parcial (dirty fields).

---

## Flush Imediato

Função `flushUserRuntimeImmediate(userId)`:

- Checkpoint imediato para uso em eventos críticos (ex: disconnect).
- Internamente chama `flushUserRuntime(userId, nowMs())`.

---

## Eventos Internos (Desacoplamento)

Implementa `EventEmitter` (`persistenceEvents`) para integração sem acoplamento:

- `onEntityDespawn(handler)` registra callback para:
  - `entity:despawn` (OFFLINE definitivo)

O layer de socket decide como broadcastar (rooms/instância/chunks).

---

## Papel no Sistema

- Mantém hot path limpo (handlers só marcam dirty).
- Controla quando e quanto escreve no banco.
- Implementa janela de 10s contra combat logging.
- Remove OFFLINE do mundo em memória (baseline não inclui).
- Emite despawn autoritativo para replicação consistente.



## Arquivo
`server/state/runtimeStore.js`

---

## O que faz

Mantém o **estado autoritativo em memória** (runtime) de cada jogador ativo no servidor.

É o cache quente da simulação:

- Guarda posição, rotação e velocidade.
- Controla estado de conexão.
- Implementa flags de persistência.
- Evita acesso ao banco durante o gameplay.
- Integra-se ao `persistenceManager`.

O banco é a persistência durável.  
O `runtimeStore` é o estado vivo.

---

## Armazenamento

Utiliza um `Map` em memória:

- Chave: `String(userId)`
- Valor: objeto `runtime`

Não expõe o `Map` diretamente.
Fornece iterador seguro via `getAllRuntimes()`.

---

## Estrutura do Runtime

Cada runtime contém:

### Identidade
- `userId`
- `instanceId`

### Transform autoritativo
- `pos` → `{ x, y, z }`
- `yaw`

### Estado replicável mínimo
- `hp`
- `action`
- `rev`
- `chunk` → `{ cx, cz }`

### Stats em cache
- `speed`
- `_speedFallback`

### Conexão / Presença
- `connectionState`
- `disconnectedAtMs`
- `offlineAllowedAtMs`

### Flags de persistência
- `dirtyRuntime`
- `dirtyStats`
- `lastRuntimeDirtyAtMs`
- `lastStatsDirtyAtMs`

### Anti-flood
- `lastMoveAtMs`
- `moveCountWindow`
- `moveWindowStartMs`

---

## Estados de Conexão

Constante `CONNECTION`:

- `CONNECTED`
- `DISCONNECTED_PENDING`
- `OFFLINE`

Mudanças de estado marcam automaticamente `dirtyRuntime`.

---

## Carregamento Inicial

Função: `ensureRuntimeLoaded(userId)`

- Busca `ga_user_runtime` no banco.
- Busca `move_speed` em `ga_user_stats`.
- Aplica `DEFAULT_SPEED` se stats ausentes.
- Constrói objeto runtime.
- Calcula chunk inicial.
- Armazena no `Map`.

Não recria runtime se já estiver carregado.

---

## Gestão de Velocidade

- `loadSpeedFromStats(userId)` → lê `move_speed`.
- `sanitizeSpeed(value)` → valida número positivo.
- `refreshRuntimeStats(userId)`:
  - Recarrega stats do banco.
  - Atualiza `speed` em memória.
  - Marca `dirtyStats`.

Não deve ser chamado no `moveHandler`.

---

## Chunking (Interest Management)

Constantes:

- `CHUNK_SIZE = 256`

Função:

- `computeChunk(pos)` → calcula `{ cx, cz }`.

Preparação para interesse espacial multiplayer.

---

## Mutação Controlada

Helpers:

- `markRuntimeDirty(userId)`
- `markStatsDirty(userId)`
- `setConnectionState(userId, patch)`

Essas funções:

- Alteram apenas memória.
- Marcam flags de persistência.
- Não escrevem no banco.

---

## Papel no Sistema

- É a fonte da verdade em tempo real.
- Isola gameplay do banco.
- Permite modelo hot + batch.
- Centraliza presença do jogador.
- Prepara sistema para interest management.

Não executa flush.  
Não acessa socket.  
Não contém regras de combate.  
Não decide persistência.


## Arquivo
`server/state/presenceIndex.js`

---

## O que faz

Implementa **Presence + Interest Management baseado em chunks**, totalmente em memória.

Responsável por:

- Indexar jogadores por instância.
- Indexar jogadores por chunk espacial.
- Calcular área de interesse (ex: 3x3 chunks).
- Permitir queries eficientes O(k), onde k = nº de chunks no interesse.

Não depende de Socket.IO.  
Não acessa banco.  
Não conhece runtimeStore.

---

## Objetivo Arquitetural

- Identidade é `userId` (não `socket.id`).
- Cliente nunca decide chunk.
- Servidor controla visibilidade.
- Estrutura preparada para escalar multiplayer real.

---

## Configuração

- `CHUNK_SIZE` → default `256`
- `CHUNK_RADIUS` → default `1` (3x3 chunks)

Podem ser configurados via `process.env`.

---

## Estruturas Internas

### 1) presenceByInstance

Map:
- `instanceId -> Set<userId>`

Controla quem está presente em cada instância.

---

### 2) usersByChunk

Map:
- `"chunk:<instanceId>:<cx>:<cz>" -> Set<userId>`

Index espacial principal.

---

### 3) userIndex

Map:
- `userId -> { instanceId, cx, cz, interestRooms:Set }`

Estado indexado do jogador.

Nenhuma dessas estruturas é exportada diretamente.

---

## Cálculo Espacial

### computeChunkFromPos(pos)

Converte `{ x, z }` em:

- `{ cx, cz }` usando `Math.floor(pos / CHUNK_SIZE)`

---

### roomKey(instanceId, cx, cz)

Gera chave:

---

### computeInterestRooms(instanceId, cx, cz, radius)

Gera conjunto de rooms dentro do raio.

Com `radius = 1`:

- 3x3 chunks (9 rooms)

---

## API Principal

---

### addUserToInstance(userId, instanceId, pos)

- Remove usuário anterior (se existir).
- Calcula chunk atual.
- Indexa em:
  - presenceByInstance
  - usersByChunk
  - userIndex
- Calcula interestRooms.

Retorna snapshot:
{
instanceId,
cx,
cz,
chunkRoom,
interestRooms:Set
}
---

### removeUserFromInstance(userId)

- Remove de presenceByInstance.
- Remove do chunk atual.
- Remove do userIndex.

Retorna último estado conhecido ou `null`.

---

### moveUserChunk(userId, nextCx, nextCz, radius?)

Se chunk não mudou:

- `changed: false`

Se mudou:

- Atualiza usersByChunk.
- Recalcula interestRooms.
- Calcula diff:
  - `entered`
  - `left`
- Atualiza userIndex.

Retorna:
{
changed,
instanceId,
prev,
next,
diff
}
Não envia eventos.  
Apenas calcula estado.

---

### getUsersInChunks(instanceId, cx, cz, radius?)

Agrega usuários em todos os chunks do interesse.

Retorna `Set<userId>` novo (cópia).

---

## Leitura Segura

Nenhuma função retorna referência interna real.

Disponíveis:

- `getUsersInRoom(roomKey)`
- `getUsersInRooms(rooms)`
- `getInterestRoomsForUser(userId)`
- `getUserPresenceState(userId)`

Todas retornam cópias.

---

## Complexidade

- Atualização de chunk: O(k) onde k = nº de chunks no interesse.
- Consulta de visibilidade: O(k + n_chunk).

Sem varrer todos jogadores da instância.

---

## Papel no Sistema

- Base do multiplayer visível.
- Permite broadcast seletivo.
- Prepara sistema para:
  - Spawn dinâmico
  - Despawn por distância
  - Servidores distribuídos por instância
  - Escala horizontal futura

Não executa gameplay.  
Não controla socket.  
Não persiste dados.  
É apenas índice espacial de presença.


## Arquivo
`server/socket/handlers/worldHandler.js`

---

## O que faz

Handler de mundo via Socket.IO responsável por:

- `world:join`
- `world:resync`
- Emissão de **baseline autoritativo** (`world:baseline`)
- Cálculo de interest (chunk rooms) e **join/leave** de rooms
- Blindagem contra reintroduzir entidades **OFFLINE** no baseline

Não executa movimento.  
Não toca banco para terceiros (apenas self faz `ensureRuntimeLoaded`).

---

## Regras / Contratos

- Cliente não escolhe chunk nem entidades visíveis.
- Sempre existe baseline (snapshot mínimo de entidades no interesse).
- Hot path para terceiros não consulta DB.
- Não permitir join/resync se runtime estiver `OFFLINE`.
- Baseline nunca inclui entidades `OFFLINE` (evita “fantasmas”).

---

## Dependências

### runtimeStore
- `ensureRuntimeLoaded(userId)` (somente self)
- `getRuntime(userId)` (leitura em memória)

### presenceIndex
- `addUserToInstance(userId, instanceId, pos)` (indexa presença)
- `moveUserChunk(userId, cx, cz)` (atualiza chunk e interest)
- `getUsersInChunks(instanceId, cx, cz)` (visibilidade agregada)
- `computeChunkFromPos(pos)` (chunk do runtime)

---

## Modelo de Entidade Replicada

Função `toEntity(rt)` produz payload leve:

- `entityId` (String do `userId`)
- `displayName` (opcional, previsto para cache futuro no runtime)
- `pos`, `yaw`
- `hp`, `action`
- `rev`

Isso é o “formato mínimo” para render/replicação.

---

## Rooms (Interest Management)

### Rooms alvo
Função `buildRooms(instanceId, interestRoomsSet)`:

- Sempre inclui `inst:<instanceId>`
- Inclui cada `chunk:<instanceId>:<cx>:<cz>` em `interestRooms`

### Aplicação idempotente
- `getSocketJoinedRooms(socket)` coleta rooms atuais (exceto `socket.id`).
- `applyRooms(socket, targetRooms)`:
  - Sai das rooms que não estão no target.
  - Entra nas rooms que faltam.

Resultado: join/leave consistente e sem vazamento.

---

## Baseline Autoritativo

Função `buildBaseline(rt)`:

1. Calcula chunk (`cx, cz`) a partir de `rt.pos`.
2. Busca todos `userId` visíveis no interest:
   - `getUsersInChunks(rt.instanceId, cx, cz)`
3. Para cada usuário visível:
   - Lê runtime em memória (`getRuntime(uid)`).
   - **Ignora** se não existe (evict/race).
   - **Ignora** se `connectionState === "OFFLINE"`.
   - Converte via `toEntity(other)` e adiciona.

Retorna:

- `instanceId`
- `you` (seu entityId)
- `chunk` (cx, cz)
- `entities[]` (visíveis no interesse)

---

## world:join

Fluxo:

- Lê `userId` do socket.
- `ensureRuntimeLoaded(userId)` (self).
- Carrega runtime (`getRuntime`), exige existir.
- Bloqueia se `rt.connectionState === "OFFLINE"`.
- Indexa presença (idempotente):
  - `addUserToInstance(userId, rt.instanceId, rt.pos)`
- Calcula rooms autoritativas e aplica (`applyRooms`).
- Marca:
  - `socket.data.instanceId`
  - `socket.data._worldJoined = true`
- Emite baseline obrigatório:
  - `socket.emit("world:baseline", { ok:true, ...baseline, t:Date.now() })`
- Ack opcional: `{ ok:true, instanceId }`.

---

## world:resync

Objetivo: reancorar rooms/baseline se cliente suspeita de divergência.

Fluxo:

- `ensureRuntimeLoaded(userId)` (self).
- Bloqueia se OFFLINE.
- Recalcula chunk atual a partir do runtime.
- Tenta atualizar presença/chunk:
  - `moveUserChunk(userId, cx, cz)`
- Se não havia index (retorna null):
  - `addUserToInstance(userId, rt.instanceId, rt.pos)`
- Aplica rooms do interest atual.
- Emite baseline obrigatório (`world:baseline`) com timestamp.
- Ack opcional: `{ ok:true }`.

---

## Papel no Sistema

- Porta de entrada autoritativa do “mundo” via socket.
- Garante que o cliente sempre recebe baseline consistente do interesse.
- Mantém rooms coerentes para broadcast seletivo (instância + chunks).
- Evita “entidade fantasma” (não baseline OFFLINE).
- Prepara o pipeline para replicação incremental (diff/entered/left) em etapas futuras.





## Arquivo:
# server.js — Bootstrap do Backend

## Arquivo
`server/server.js` (ou entrypoint equivalente)

---

## O que faz

Inicializa a infraestrutura completa do servidor:

- Carrega variáveis de ambiente.
- Conecta ao banco (Sequelize).
- Configura Express (HTTP).
- Registra rotas (`/auth`, `/world`).
- Cria servidor HTTP.
- Anexa Socket.IO ao mesmo servidor.
- Registra pipeline de socket (`registerSocket`).
- Inicia o `persistenceManager`.
- Escuta na porta 5100.

---

## Papel no Sistema

- Orquestra HTTP + WebSocket.
- Ativa a simulação autoritativa.
- Ativa o loop de persistência (hot + batch).
- Implementa shutdown limpo (fecha loop, servidor e banco).

Não contém lógica de gameplay.
É apenas o ponto de entrada da aplicação.