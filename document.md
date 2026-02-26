### PROJETO YOUTUBE — model.md (resumo disciplinado do “resumo de arquivos”)

> **Princípio estrutural**: **Backend é a fonte da verdade**.
> Cliente **não simula mundo**, apenas **renderiza snapshot** e envia **intenções** (inputs).
> Multiplayer usa **interest management por chunks** + replicação incremental com **rev monotônico**.

---

## FRONT (src)

### `src/pages/AuthPage.jsx`

**Papel:** Controlar fluxo de autenticação.
**Faz:** alterna `LoginModal` / `RegisterModal`, repassa `onLoggedIn`.
**Não faz:** bootstrap de mundo, socket, Three.js.

---

### `src/components/modals/LoginModal.jsx`

**Papel:** UI de login (email/senha).
**Contrato:**

* chama `loginUser(payload)`
* se retorno tem `token` → `onLoggedIn(token)`
* bloqueia reenvio com `isSubmitting`
* mostra `LoadingOverlay` durante request
  **Não faz:** armazenar token global por conta própria (delegado ao pai).

---

### `src/components/modals/RegisterModal.jsx`

**Papel:** UI de registro (nome/email/senha).
**Contrato:**

* chama `registerUser(payload)`
* exibe mensagem de sucesso
* alterna para login via `onSwitch()`
  **Não faz:** login automático (por design atual).

---

### `src/components/overlays/LoadingOverlay.jsx`

**Papel:** overlay global de bloqueio.
**Contrato:** `LoadingOverlay({ message = "Carregando..." })`
**Faz:** bloqueia UI + texto de status + ARIA básico.
**Uso típico:** login, bootstrap, carregar snapshot.

---

### `src/services/Auth.js`

**Papel:** camada HTTP de autenticação.
**Faz:** `POST /auth/register`, `POST /auth/login` e retorna JSON.
**Não faz:** armazenar token, estado global, UI.

---

### `src/services/Socket.js`

**Papel:** gerenciar Socket.IO client (singleton).
**Contrato:**

* `connectSocket(token)` cria conexão com `auth: { token }`, transporte websocket
* `getSocket()`, `disconnectSocket()`
  **Não faz:** regras de gameplay, handlers de mundo (só ciclo de vida).

---

### `src/services/WorldBootstrap.js`

**Papel:** buscar snapshot inicial autoritativo.
**Contrato:**

* `GET /world/bootstrap` com `Authorization`
* timeout via `AbortController` (10s)
* padroniza erros (`ok:false`, etc.)
  **Não faz:** setar estado global, render, socket.

---

### `src/World/WorldRoot.jsx`

**Papel:** gate de autenticação do “mundo”.
**Faz:** se tem token → `GameShell`, senão → `AuthPage`.
**Não faz:** bootstrap/socket/render.

---

### `src/World/GameShell.jsx`

**Papel:** orquestrador do runtime no cliente.
**Faz:**

* lê token do `localStorage`
* chama `bootstrapWorld(token)` → obtém snapshot inicial
* trata 401: remove token e recarrega
* **após snapshot existir**, conecta Socket.IO
* escuta `move:state` e atualiza **somente** `snapshot.runtime` (imutável)
* mostra `LoadingOverlay` enquanto carrega
* entrega `{ snapshot, socket }` ao `GameCanvas`
  **Não faz:** simular movimento, calcular posição final, física.

---

### Entidades/render

#### `src/world/entities/character/CharacterEntity.js`

**Papel:** wrapper OO do mesh do personagem.
**Faz:** cria cilindro padrão e `sync(runtime)` aplicando `pos`/`yaw` vindos do servidor.
**Não faz:** movimento preditivo.

#### `src/world/entities/character/player.jsx`

**Papel:** helpers funcionais de mesh do player.
**Faz:** `createPlayerMesh` + `syncPlayer(mesh, runtime)` (aplica estado confirmado).
**Não faz:** simulação.

---

### Input (intenção, não ação)

#### `src/input/inputBus.js`

**Papel:** pub/sub de intents.
**API:** `emit(intent)`, `on(fn)->unsubscribe`, `clear()`
**Não faz:** ler teclado/mouse, nem enviar ao servidor diretamente.

#### `src/input/inputs.js`

**Papel:** bindings de dispositivo → intents.
**Faz:**

* RMB drag → `CAMERA_ORBIT(dx,dy)`
* wheel → `CAMERA_ZOOM`
* WASD → `MOVE_DIRECTION` (vetor X/Z) quando muda
  **Não faz:** mover personagem.

#### `src/input/intents.js`

**Papel:** modelo unificado de intents.
**Tipos:**

* `CAMERA_ZOOM`
* `CAMERA_ORBIT`
* `MOVE_DIRECTION`

---

### Estado replicado (client-side)

#### `cliente/src/World/state/entitiesStore.js` (documentado em `entitiesStore.md`)

**Papel:** store autoritativo de **entidades replicadas** no cliente (baseline/spawn/delta/despawn).
**Garantias:**

* `Map` O(1)
* normaliza IDs (`String`) para evitar `1` vs `"1"`
* `rev` monotônico por entidade (rejeita pacote fora de ordem)
* baseline sempre vence (replace completo)
* protege contra “self como other” e “despawn do self”
  **Não faz:** predição, interpolação, colisão, cálculo de interest.

---

## SERVER

### `config/config.js` (Sequelize)

**Papel:** parâmetros de conexão MySQL por ambiente via `.env`.
**Não faz:** conectar diretamente, nem lógica de domínio.

---

### `src/middlewares/requireAuth.js`

**Papel:** guardião JWT no HTTP.
**Faz:** valida `Bearer`, `jwt.verify`, injeta `req.user`.
**Não faz:** consultar DB, renovar token.

---

### `Service/worldService.js` (contrato do snapshot HTTP)

**Snapshot consolidado:**

* `snapshot.runtime`: `user_id`, `instance_id`, `pos`, `yaw`
* `snapshot.instance`: contexto de instância
* `snapshot.localTemplateVersion`: versionamento para cache
* `snapshot.localTemplate`: `local`, `geometry(size_x,size_z)`, `visual(...)`, `debug(bounds)`
  **Papel:** entregar template declarativo + runtime num pacote autoritativo.

---

## SOCKET (Servidor)

### `server/socket/index.js`

**Papel:** ponto central do Socket.IO.
**Faz:**

* instala auth middleware
* instala persistence hooks
* aplica sessão única por userId
* marca CONNECTED
* registra handlers (world/move/etc)
* disconnect com grace period
  **Não faz:** gameplay específico dentro dele (wiring).

---

### `server/socket/sessionIndex.js`

**Papel:** índice em memória `userId -> socket` (primitivas O(1)).
**Não faz:** política ativa sozinho (quem aplica é o wiring).

---

### Wiring

#### `server/socket/wiring/auth.js`

**Papel:** autenticar socket via JWT e preencher `socket.data.userId`.

#### `server/socket/wiring/session.js`

**Papel:** impor **sessão única**.

* derruba socket antigo
* marca `_skipDisconnectPending` para evitar pending falso
* limpa sessão com proteção contra race no disconnect

#### `server/socket/wiring/persistenceHooks.js`

**Papel:** traduz eventos internos de persistência (ex: despawn OFFLINE) em broadcast no socket.

#### `server/socket/wiring/lifecycle.js`

**Papel:** transições CONNECTED ↔ DISCONNECTED_PENDING ↔ OFFLINE, com flush imediato nas viradas.

---

## World via Socket

### `server/socket/handlers/worldHandler.js` (visão macro)

**Eventos:** `world:join`, `world:resync`, emite `world:baseline`.
**Regras:**

* cliente não escolhe chunk/visibilidade
* baseline nunca inclui OFFLINE
* hot path para terceiros não consulta DB

**Refatoração/estrutura atual detalhada:**

* `handlers/world/baseline.js`: constrói baseline `{ you, others, chunk }`
* `handlers/world/join.js`: fluxo autoritativo de join
* `handlers/world/resync.js`: reancoragem/recuperação
* `handlers/world/rooms.js`: aplica rooms autoritativas (instância + chunks)

---

## Movimento autoritativo + replicação

### `server/socket/handlers/moveHandler.js` (WASD em hot path, visão macro)

**Papel:** processar `move:intent` (WASD) de forma autoritativa.
**Faz:**

* validações, rate limit, dt clamp
* speed strict (sem fallback silencioso)
* atualiza runtime em memória
* `rev++`, marca dirty
* chunk transition + rooms + spawn/despawn
* `entity:delta` para outros e `move:state` para self
  **Risco apontado:** import direto de estruturas internas do presence (preferir API pública).

**Estrutura modular detalhada (fase atual):**

* `handlers/move/applyWASD.js`: aplica intent no runtime (sem emit)
* `handlers/move/broadcast.js`: rev/dirty + chunk transition + delta + move:state

---

### Click-to-move

#### `server/socket/handlers/clickMoveHandler.js`

**Papel:** receber `move:click` e atualizar apenas target/mode no runtime.
**Movimento real:** acontece no tick autoritativo (loop).

#### `server/state/movement/tickOnce.js`

**Papel:** coração do click-to-move autoritativo.

* dt server-side
* bounds obrigatórios
* speed strict
* move/stop server-side
* `rev++`, dirty
* delta para interest, move:state para self
* chunk transition + rooms + spawn/despawn

#### `server/state/movement/loop.js`

**Papel:** scheduler do tick (intervalo fixo), chama `tickOnce`.

#### `server/state/movement/math.js`

**Papel:** funções puras (clamp, normalize2D, clampPosToBounds).

#### `server/state/movement/entity.js`

**Papel:** `bumpRev(rt)` + serialização replicável (`toEntity`, e deltas quando aplicável).

#### `server/state/movement/chunkTransition.js`

**Papel:** spawn/despawn incremental ao mudar chunk:

* A) outros veem você (broadcast rooms)
* B) você vê outros (spawns diretos, despawn conservador com `visibleNow`)

---

## Runtime autoritativo (Servidor)

### `server/state/runtimeStore.js` (visão macro)

**Papel:** cache quente do estado vivo do jogador.
**Conteúdo:** pos/yaw/hp/action/rev/chunk/speed/connectionState/dirty/antiflood.
**Faz:** `ensureRuntimeLoaded`, marca dirty, connection state, computeChunk.
**Não faz:** flush no DB, nem socket.

**Refatoração/estrutura detalhada atual:**

* `server/state/runtime/store.js`: Map e API básica (get/set/delete/iter)
* `server/state/runtime/loader.js`: `ensureRuntimeLoaded` (carrega runtime+stats+bounds)
* `server/state/runtime/dirty.js`: `markRuntimeDirty`, `markStatsDirty`, `setConnectionState`
* `server/state/runtime/inputPolicy.js`: regra WASD ativo por timeout, prioridade WASD > CLICK

---

## Presence + Interest (Chunks)

### `server/state/presenceIndex.js` (facade pública)

**Papel:** contrato único do presence/interest.
**Faz:** reexporta mutação/leitura/cálculo, expõe `CHUNK_SIZE/RADIUS`.
**Regra:** identidade é `userId`, cliente não decide interest.

**Internos:**

* `presence/store.js`: `presenceByInstance`, `usersByChunk`, `userIndex`
* `presence/mutate.js`: add/move/remove, calcula interestRooms, retorna diff entered/left
* `presence/read.js`: leituras seguras (cópias), `getUsersInChunks`, `getUsersInRoom(s)`
* `presence/math.js`: `computeChunkFromPos`

---

## Persistência (Hot + Batch)

### `server/state/persistenceManager.js`

**Papel:** facade pública da persistência.

* start/stop loop
* tickDisconnects
* flushDirtyBatch
* writers
* eventos internos + checkpoint imediato (disconnect)

### `server/state/persistence/loop.js`

**Papel:** scheduler da persistência, evita overlap, chama:

* `tickDisconnects`
* `flushDirtyBatch`

### `server/state/persistence/disconnects.js`

**Papel:** finalizar `DISCONNECTED_PENDING` → `OFFLINE` definitivo:

* bumpRev
* flush imediato
* remove do presence
* emite evento interno `entity:despawn`
* eviction do runtime

### `server/state/persistence/writers.js`

**Papel:** tocar o banco.

* `flushUserRuntime`: UPDATE ga_user_runtime, limpa dirtyRuntime
* `flushUserStats`: placeholder (limpa dirtyStats)

---

## Bootstrap do backend

### `server/server.js`

**Papel:** entrypoint.

* inicia Express + rotas
* cria HTTP server + Socket.IO
* registra socket pipeline
* inicia persistence loop (e movimento, se habilitado)
* escuta porta

---

## Glossário de eventos (contratos mínimos)

**HTTP**

* `POST /auth/register`
* `POST /auth/login`
* `GET /world/bootstrap` → snapshot autoritativo (runtime + template)

**Socket**

* `world:join` → responde com `world:baseline`
* `world:resync` → responde com `world:baseline`
* `entity:spawn | entity:delta | entity:despawn` → replicação incremental
* `move:intent` (WASD) → servidor aplica e replica
* `move:click` (click-to-move) → seta target, tick move
* `move:state` → confirmação para o próprio jogador
* `session:replaced` → sessão antiga derrubada

---

## Invariantes do projeto (as “leis da física” 🧱)

* Cliente envia **intents**, servidor produz **estado confirmado**.
* `rev` monotônico é a régua de consistência no cliente.
* Baseline “cura” divergência (replace completo).
* Presence/interest é calculado no servidor (chunks/rooms).
* Persistência é desacoplada: gameplay marca dirty, loop faz flush.

---
