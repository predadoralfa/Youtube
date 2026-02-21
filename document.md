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

# server/socket/index.md

## Arquivo
`server/socket/index.js`

---

## Objetivo

Implementar o **pipeline central do Socket.IO** do backend, cobrindo:

- Autenticação JWT no handshake (gate autoritativo).
- Garantia de **sessão única por `userId`** (1 usuário, 1 socket ativo).
- Integração com o runtime em memória (`runtimeStore`) e com persistência controlada (`persistenceManager`).
- Registro de handlers de gameplay (WASD e click-to-move) e de mundo (baseline/rooms).
- Ciclo de vida de conexão: `CONNECTED -> DISCONNECTED_PENDING -> OFFLINE` (anti-combat-log de 10s).
- Broadcast de despawn autoritativo quando uma entidade vira OFFLINE definitivo.

Este arquivo é infraestrutura de runtime, não contém simulação de movimento nem regras de combate.

---

## Dependências

### Autenticação
- `jsonwebtoken` para validar JWT.

### Runtime (estado quente)
De `../state/runtimeStore`:
- `ensureRuntimeLoaded(userId)`
- `getRuntime(userId)` *(importado, mas não utilizado neste arquivo)*
- `setConnectionState(userId, patch, nowMs)`

### Persistência (hot + batch)
De `../state/persistenceManager`:
- `flushUserRuntimeImmediate(userId)`
- `onEntityDespawn(handler)`

### Presence / Interest Index
De `../state/presenceIndex`:
- `addUserToInstance` *(importado, mas não utilizado neste arquivo; o join real ocorre no `worldHandler`)*

### Handlers Socket
- `registerMoveHandler(socket)` (WASD)
- `registerClickMoveHandler(socket)` (click-to-move: só seta alvo)
- `registerWorldHandler(io, socket)` (world join/resync/baseline/rooms)

### Sessão Única
De `./sessionIndex`:
- `getActiveSocket(userId)`
- `setActiveSocket(userId, socket)`
- `clearActiveSocket(userId, socketId)`

---

## Conceitos e Contratos

### Contrato de identidade no socket
Após autenticação, injeta em `socket.data`:

- `socket.data.userId` (obrigatório)
- `socket.data.displayName` (opcional)

Isso se torna a identidade autoritativa do canal WS.

### Estados de conexão (runtime)
Manipula explicitamente:

- `CONNECTED`
- `DISCONNECTED_PENDING`
- (OFFLINE finalizado pelo `persistenceManager`, não por este arquivo)

### Janela anti-combat-log
Ao desconectar:

- marca `DISCONNECTED_PENDING`
- define `offlineAllowedAtMs = now + 10s`
- após esse deadline, o `persistenceManager` finaliza `OFFLINE` e emite despawn.

---

## Hook de Persistência: Despawn Autoritativo

### `installPersistenceHooks(io)`

Instala uma vez (guardado por `_despawnHookInstalled`) um listener:

- `onEntityDespawn((evt) => {...})`

Quando o `persistenceManager` declara OFFLINE definitivo, o hook:

1. Monta `targets` (rooms de broadcast) com deduplicação:
   - sempre inclui `inst:<instanceId>`
   - inclui também `evt.interestRooms` se fornecido

2. Emite para cada room:
   - evento: `entity:despawn`
   - payload: `{ entityId, rev }`

Observações:
- Esse arquivo não calcula interest nem lista jogadores: ele apenas usa as rooms fornecidas.
- `rev` é tratado como monotônico (o despawn é uma revisão).

---

## Autenticação no Handshake

### `io.use((socket, next) => ...)`

Fluxo:

1. Lê token de:
   - `socket.handshake.auth.token`
2. Aceita dois formatos:
   - `<token>`
   - `Bearer <token>` (remove prefixo)
3. Valida:
   - `jwt.verify(token, JWT_SECRET || "chave_mestra_extrema")`
4. Exige:
   - `decoded.id` exista
5. Injeta:
   - `socket.data.userId = decoded.id`
   - `socket.data.displayName = decoded.display_name ?? null`
6. Caso falhe:
   - `next(new Error("UNAUTHORIZED"))`

Contrato compatível com o HTTP middleware `requireAuth`.

---

## Conexão: Pipeline Principal

### `io.on("connection", async (socket) => {...})`

#### (A) Sessão única por `userId`

1. Obtém sessão anterior via `getActiveSocket(userId)`.
2. Se existe e é diferente do socket atual:
   - define flag no socket antigo:
     - `prev.data._skipDisconnectPending = true`
     - Isso impede que o `disconnect` do antigo marque o runtime como pending.
   - emite para o cliente antigo:
     - `session:replaced` com `{ by: socket.id, userId }`
   - derruba o antigo:
     - `prev.disconnect(true)`
3. Registra o novo como sessão atual:
   - `setActiveSocket(userId, socket)`

Garantia real:
- Este arquivo, junto com `sessionIndex`, implementa efetivamente “1 userId = 1 sessão ativa” no **processo atual**.

Limitação:
- Não resolve sessão única em cenário multi-node sem coordenação externa.

#### (B) Runtime + marca CONNECTED

1. `ensureRuntimeLoaded(userId)` garante runtime em memória.
2. `setConnectionState(... CONNECTED ...)`:
   - zera `disconnectedAtMs` e `offlineAllowedAtMs`
3. `flushUserRuntimeImmediate(userId)`:
   - checkpoint imediato do estado CONNECTED (crash recovery / consistência)

#### (C) Registro de handlers

- `registerMoveHandler(socket)` (WASD)
- `registerClickMoveHandler(socket)` (click-to-move)
- `registerWorldHandler(io, socket)` (baseline/rooms/join/resync)

Este arquivo não conhece detalhes de gameplay desses handlers, apenas os conecta ao socket.

#### (D) Ready signal

Emite para o cliente:
- `socket:ready` `{ ok: true }`

---

## Disconnect: `DISCONNECTED_PENDING` (10s)

### `socket.on("disconnect", async (reason) => {...})`

Fluxo defensivo:

1. Se socket foi substituído:
   - `if (socket.data._skipDisconnectPending) return;`
2. Se não for a sessão atual (race/overlap):
   - lê `current = getActiveSocket(userId)`
   - se `current.id !== socket.id`, ignora
3. Limpa sessão atual:
   - `clearActiveSocket(userId, socket.id)`
4. Calcula janela:
   - `t = nowMs()`
   - `offlineAt = t + 10_000`
5. Marca runtime:
   - `setConnectionState(... DISCONNECTED_PENDING ...)`
   - grava `disconnectedAtMs` e `offlineAllowedAtMs`
6. Persiste imediatamente:
   - `flushUserRuntimeImmediate(userId)`
7. Log de telemetria:
   - inclui `reason` e `offlineAt`

Importante:
- Este arquivo **não finaliza OFFLINE**. Ele apenas agenda via deadline.
- A transição para OFFLINE e o despawn real são responsabilidade do `persistenceManager`.

---

## O Que Este Arquivo NÃO Faz

Não:

- Calcula movimento.
- Replica `entity:delta` diretamente (isso é do move/world handlers).
- Controla presenceIndex diretamente (apesar do import existir).
- Faz baseline.
- Persiste em batch.
- Decide OFFLINE definitivo.

Ele orquestra autenticação, sessão, lifecycle e integração entre camadas.

---

## Segurança e Robustez

### Proteções implementadas
- JWT obrigatório no handshake.
- Aceita prefixo Bearer para compatibilidade.
- Sessão única com derrubada explícita de conexão anterior.
- Proteções contra race condition no disconnect (checa sessão atual).
- Flag `_skipDisconnectPending` para evitar “pending fantasma” na sessão antiga.
- Checkpoint imediato em eventos críticos (CONNECTED e DISCONNECTED_PENDING).

### Limitações relevantes
- Fallback de JWT secret (`"chave_mestra_extrema"`) é conveniente para dev, mas perigoso em produção se `JWT_SECRET` estiver ausente.
- Sessão única é por processo, não global.
- `getRuntime` e `addUserToInstance` estão importados mas não usados: sugere drift/artefato e merece limpeza para reduzir ambiguidade.

---

## Papel no Sistema

Este arquivo é o **núcleo de infraestrutura WebSocket** do MMO autoritativo:

- Garante identidade e sessão única.
- Encosta o socket no runtime em memória.
- Integra com persistência controlada e broadcast de despawn.
- Conecta handlers que implementam a lógica do mundo e movimento.
- Implementa lifecycle de presença com janela anti-combat-log.

É um ponto crítico para consistência, porque controla as transições de estado mais sensíveis do jogador (online/pending/offline).


# cliente/src/World/state/entitiesStore.md

## Arquivo
`cliente/src/World/state/entitiesStore.js`

---

## Objetivo

Implementar um **store autoritativo (client-side) de entidades replicadas** a partir do servidor, consumindo eventos típicos do multiplayer:

- `world:baseline` (baseline completo do interesse atual)
- `entity:spawn` (entrada no interesse)
- `entity:delta` (atualização incremental)
- `entity:despawn` (saída do interesse)

Características-chave:

- **Não depende de React** (é um módulo puro de estado).
- Mantém entidades em `Map` para acesso O(1).
- Controla **revisão monotônica (`rev`) por `entityId`** para rejeitar updates fora de ordem.
- **Baseline sempre vence** (replace completo do estado replicado).
- Normaliza IDs para `string` para evitar bugs `1` vs `"1"`.

Este store não calcula estado autoritativo do mundo: apenas consolida replicação recebida.

---

## Estrutura de Estado

O store encapsula um `state` interno:

- `entities: Map<string, Entity>`
- `selfId: string | null`
- `instanceId: any | null`
- `chunk: { cx, cz } | null`
- `t: number` (timestamp/telemetria recebida do baseline)

### Entidade normalizada (`Entity`)
Campos garantidos:

- `entityId: string`
- `displayName: string | null`
- `pos: { x:number, y?:number, z:number }`
- `yaw: number`
- `hp: number`
- `action: string`
- `rev: number`

---

## Normalização e Compatibilidade

### Normalização de IDs

Função central:

- `toId(raw)` => `String(raw)` ou `null`

Aplicada em:

- baseline (selfId e lista de entidades)
- delta (entityId)
- despawn (entityId)

Motivação:

- Evitar inconsistências entre `number` e `string` vindo do backend ou do socket layer.

### Compatibilidade de payload de baseline

O baseline pode chegar em dois formatos:

- `payload.others` (novo)
- `payload.entities` (legado)

O store aceita ambos e escolhe o que existir.

---

## Debug (Opcional)

Existe um mecanismo de debug de IDs:

- `DEBUG_IDS = false` por padrão
- `debugIds(...)` loga apenas se habilitado

Uso: validar rapidamente se normalização e exclusões de self estão corretas.

---

## API Pública

O módulo exporta uma factory:

- `createEntitiesStore()`

Retorna um objeto com:

### Leitura
- `entities` (referência ao `Map` interno)
- getters:
  - `selfId`
  - `instanceId`
  - `chunk`
  - `t`
- `getSnapshot()` => `Entity[]` (array estável para render)

### Mutação
- `clear()`
- `applyBaseline(payload)`
- `applySpawn(entityRaw)`
- `applyDelta(delta)`
- `applyDespawn(entityIdRaw)`

---

## Regras de Aplicação de Estado

### 1) `clear()`

Zera completamente:

- `entities`
- `selfId`
- `instanceId`
- `chunk`
- `t`

Uso típico: logout, troca de mundo, reset total do cliente.

---

### 2) `applyBaseline(payload)`

Regra-mãe:

- **Baseline sempre vence** e é tratado como verdade completa do interesse atual.

Fluxo:

1. Valida `payload.ok === true`.
2. `entities.clear()` (replace completo).
3. Atualiza:
   - `instanceId`
   - `chunk`
   - `t`

4. Resolve o `you` (self) antes de inserir others:
   - `you` pode ser:
     - primitive (`string | number`) => vira `selfId`
     - objeto => vira entidade normalizada (`youEntity`) e `selfId`

5. Decide lista replicada:
   - `payload.others` (preferido)
   - fallback `payload.entities`
   - fallback `[]`

6. Insere cada entidade normalizada no `Map`, com regra:
   - **não inserir self como "other"**
     - se `e.entityId === nextSelfId`, ignora

7. Atualiza `selfId` no estado:
   - Se baseline não enviar `you`, mantém `selfId` anterior (evita ownership swap para null).

8. Garante que self exista no Map se `youEntity` foi recebido:
   - Se não existe ou `youEntity.rev` é maior/igual ao atual, sobrescreve.

Ponto crítico:
- Evita bug comum onde o servidor inclui o próprio jogador no baseline de "others" e o cliente passa a tratar self como outro.

---

### 3) `applySpawn(entityRaw)`

Objetivo:
- Inserir entidade que entrou no interesse.

Regras:

- Normaliza a entidade.
- Se `entityId === selfId`, ignora (self nunca entra como “other”).
- Aplica apenas se `rev` for maior que o atual:
  - Sem entidade existente: insere
  - Com entidade existente: só substitui se `e.rev > cur.rev`

---

### 4) `applyDespawn(entityIdRaw)`

Objetivo:
- Remover entidade que saiu do interesse.

Regras:

- Normaliza `entityId`.
- Se `entityId === selfId`, ignora (proteção contra despawn acidental do self).
- `entities.delete(entityId)`.

Observação:
- O store não aplica `rev` no despawn (é remoção direta). A proteção aqui é evitar self-despawn.

---

### 5) `applyDelta(delta)`

Objetivo:
- Atualizar incrementalmente uma entidade existente.

Regras obrigatórias:

1. Normaliza `entityId`.
2. `rev` deve existir e ser finito.
3. **Só aplica se `nextRev > curRev`** (monotônico estrito).
4. Se entidade não existe, cria uma base default e aplica delta.

Merge:

- `pos`: merge parcial (preserva campos ausentes), via `mergePos`
- `yaw`, `hp`, `action`: atualiza apenas se vier no delta
- `rev`: sempre atualizado para `nextRev`

Este mecanismo garante:
- Rejeição de pacotes fora de ordem.
- Robustez contra spawn perdido (delta pode criar a entidade).

---

## O Que Este Store NÃO Faz

Não:

- Prediz movimento.
- Interpola.
- Resolve colisão.
- Calcula chunk/interest.
- Confirma ações.
- Aplica regras de combate.
- Decide autoridade.

Ele apenas consolida replicação recebida do backend.

---

## Segurança e Robustez

### Garantias fortes
- `entityId` sempre string (normalização defensiva).
- `rev` monotônico evita regressões de estado.
- Baseline substitui completamente o estado (cura divergências acumuladas).
- Proteção explícita contra:
  - inserir self como other
  - despawn do self
  - delta sem rev válido

### Limitações / riscos
- `entities` é exposto como referência (apesar de getters existirem). Consumidores podem mutar indevidamente se não houver disciplina.
- Despawn não usa `rev`: se chegar um despawn atrasado, não há mecanismo interno para “reviver” sem baseline/spawn posterior (isso normalmente é aceitável dado o contrato de interest).
- `instanceId` e `chunk` não são normalizados (dependem do formato do backend).

---

## Papel no Sistema

`entitiesStore` é o **ponto único de consolidação client-side do estado replicado**:

- Baseline cura e reancora o cliente.
- Spawn/delta/despawn atualizam incrementalmente.
- `rev` é a regra central de consistência.

Ele serve como “cache do interesse atual” no cliente, mantendo o render independente de Socket.IO e independente de React.



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
# server/state/persistenceManager.js

## Objetivo

Facade público do sistema de persistência.

Este módulo:

- Reexporta o loop de persistência.
- Reexporta flush batch.
- Reexporta writers.
- Expõe eventos internos.
- Fornece checkpoint imediato para disconnect.

Não contém lógica própria complexa.
É a superfície oficial da camada de persistência.

---

## Loop

- startPersistenceLoop()
- stopPersistenceLoop()

Responsáveis por iniciar/parar o ciclo hot + batch.

---

## Processamento

- tickDisconnects(now)
- flushDirtyBatch(options)

Permitem execução manual ou controlada pelo loop.

---

## Writers

- flushUserRuntime(userId, now)
- flushUserStats(userId, now)

Camada que toca o banco.

---

## Checkpoint Imediato

### flushUserRuntimeImmediate(userId)

Usado no disconnect.

Regra:

- No momento do disconnect, o runtime deve ser persistido imediatamente.
- Não depende do batch periódico.

Internamente chama:

flushUserRuntime(userId, nowMs())

---

## Eventos Internos

- persistenceEvents
- onEntityDespawn(handler)

Permitem que outras camadas (ex: socket) reajam a:

- Despawn autoritativo
- Finalização OFFLINE

Sem acoplamento direto.

---

## Papel Arquitetural

Este arquivo:

- Centraliza a API pública de persistência.
- Evita imports diretos dos submódulos.
- Mantém desacoplamento entre:
  - Runtime
  - Persistência
  - Socket

É o ponto oficial de integração da camada de persistência.



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
# server/state/presenceIndex.js

## Objetivo

Facade público do sistema de **Presence + Interest Management** baseado em chunks.

Este módulo:

- Reúne e reexporta a API de presença (mutação + leitura).
- Expõe config (CHUNK_SIZE, CHUNK_RADIUS).
- Mantém o sistema desacoplado de Socket.IO e do banco.
- Define a superfície oficial que outras camadas usam (socket handlers, persistence, world).

---

## Regras Estruturais

- Identidade é `userId` (não `socket.id`).
- Cliente não decide chunk nem visibilidade.
- Operações devem escalar:
  - custo O(k), onde k = número de chunks no interest (ex: 9 em 3x3).

---

## Config Exportada

- `CHUNK_SIZE`
- `CHUNK_RADIUS`

Vêm de `./presence/config`.

---

## API Obrigatória (Mutação)

Reexporta de `./presence/mutate`:

### addUserToInstance(userId, instanceId, pos)
Indexa presença inicial do usuário e calcula interest.

### removeUserFromInstance(userId)
Remove usuário de todos os índices.

### moveUserChunk(userId, nextCx, nextCz, radius?)
Atualiza chunk e interest, retornando diff `entered/left`.

### getUsersInChunks(instanceId, cx, cz, radius?)
Agrega usuários visíveis nos chunks do interesse.

---

## Helpers de Chunk/Interest

Reexporta cálculo puro:

- `computeChunkFromPos(pos)`
- `computeInterestRooms(instanceId, cx, cz, radius?)`
- `roomKey(instanceId, cx, cz)`

Útil para world handler, move handler e debug.

---

## Leitura Segura

Reexporta de `./presence/read`:

- `getUsersInRoom(roomKey)`
- `getUsersInRooms(rooms)`
- `getInterestRoomsForUser(userId)`
- `getUserPresenceState(userId)`

Garantia: retornam cópias (não vazam referência interna).

---

## Papel Arquitetural

Este arquivo:

- É o “contrato público” do Presence.
- Evita que outras camadas importem diretamente `store.js`.
- Força encapsulamento: leitura e mutação passam por APIs controladas.
- Mantém interest management consistente e escalável.

É a porta oficial para qualquer lógica que precise de visibilidade espacial.


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


# server/socket/sessionIndex.md

## Arquivo
`server/socket/sessionIndex.js`

---

## Objetivo

Manter um **índice em memória da sessão WebSocket ativa por usuário**, permitindo que o servidor associe um `userId` a um único `socket` ativo.

Este arquivo **não implementa a política de sessão única por si só**.  
Ele apenas fornece as primitivas necessárias para que o `socket/index.js` aplique essa política.

---

## Natureza do Componente

- Estrutura puramente em memória.
- Complexidade O(1) para `get`, `set` e `delete`.
- Não acessa banco.
- Não conhece runtimeStore.
- Não escuta eventos.
- Não valida estado do socket.
- Não executa cleanup automático.

É um **índice passivo de sessão**, não um gerenciador ativo.

---

## Estrutura Interna


Map<userId(string), socket>


# server/socket/handlers/clickMoveHandler.js

## Objetivo

Registrar e processar a intenção **click-to-move** enviada pelo cliente.

Este handler:

- Recebe `move:click` via Socket.IO.
- Valida payload e aplica regras de aceitação.
- Atualiza apenas o estado de click no runtime (moveMode/target).
- Não executa movimento diretamente.
- Não emite replicação (`delta/spawn/despawn`).
- Não toca banco.

O deslocamento real acontece no **tick autoritativo** (`movement/tickOnce.js`).

---

## Evento: `move:click`

### Payload esperado

{ x: number, z: number }



# server/state/persistence/disconnects.js

## Objetivo

Finalizar desconexões pendentes e materializar o estado **OFFLINE definitivo**.

Este módulo:

- Varre runtimes em memória.
- Detecta `DISCONNECTED_PENDING` que expirou (now >= offlineAllowedAtMs).
- Converte para `OFFLINE`, persiste imediatamente e remove do mundo.
- Emite evento interno de despawn para o layer de socket broadcastar.
- Faz eviction do runtime do cache quente para evitar "cache fantasma".

Não depende de Socket.IO diretamente.
Não decide broadcast, apenas emite evento interno.

---

## Regra de Negócio

- Ao desconectar: runtime entra em `DISCONNECTED_PENDING` e continua existindo no mundo por 10s.
- Ao atingir `offlineAllowedAtMs`: vira `OFFLINE` definitivo e sai do mundo.

Consequências ao virar OFFLINE:
- Não pode aparecer em baseline futuro.
- Deve gerar despawn replicável.
- Deve persistir imediatamente no banco.
- Deve ser removido do runtimeStore em memória.

---

## tickDisconnects(now)

Loop principal:

1. Itera sobre `getAllRuntimes()`.
2. Filtra apenas runtimes com:
   - `connectionState === "DISCONNECTED_PENDING"`
   - `offlineAllowedAtMs != null`
3. Se `now >= offlineAllowedAtMs`:
   - Captura `presence` antes de remover (rooms/interest para despawn consistente).
   - `bumpRev(rt)`:
     - despawn conta como revisão monotônica do estado replicável.
   - `setConnectionState(... OFFLINE ...)`:
     - marca runtime dirty (persistível).
   - `flushUserRuntime(userId, now)`:
     - flush final imediato (não espera batch).
   - `removeUserFromInstance(userId)`:
     - remove do índice de presença para não aparecer em baseline.
   - `persistenceEvents.emit("entity:despawn", payload)`:
     - evento interno com:
       - entityId
       - instanceId
       - interestRooms anteriores
       - rev
       - atMs
   - `deleteRuntime(userId)`:
     - eviction do runtime em memória.

---

## Payload do Evento Interno

Evento: `entity:despawn`

{
  entityId: String(userId),
  instanceId: presence?.instanceId ?? String(rt.instanceId),
  interestRooms: [...presence.interestRooms] || [],
  rev: Number(rt.rev ?? 0),
  atMs: now
}


# server/state/persistence/loop.js

## Objetivo

Executar o loop periódico de persistência do sistema (modelo hot + batch).

Este módulo:

- Agenda execução contínua.
- Processa desconexões expiradas.
- Executa flush controlado de runtimes/stats sujos.
- Evita sobreposição de execução (overlap).
- Não acessa banco diretamente.
- Não conhece socket.

É o orquestrador do ciclo de persistência.

---

## startPersistenceLoop()

Inicia `setInterval` com frequência definida por:

- `PERSIST_TICK_MS`

A cada tick:

1. Evita execução simultânea (`_running`).
2. Captura timestamp (`nowMs()`).
3. Executa:
   - `tickDisconnects(t0)` → finaliza OFFLINE expirados.
   - `flushDirtyBatch({ maxUsersPerTick, now })` → flush controlado.
4. Captura e loga erros.
5. Libera flag `_running`.

Loga configuração ao iniciar.

---

## stopPersistenceLoop()

- Cancela o timer.
- Reseta estado interno.
- Loga parada do loop.

---

## Controle de Overlap

Flag `_running` impede:

- Dois ticks executando simultaneamente.
- Corrupção de estado.
- Pressão excessiva no banco se tick atrasar.

---

## Configuração

Controlado por:

- `PERSIST_TICK_MS`
- `MAX_FLUSH_PER_TICK`

Permite ajuste fino de carga.

---

## Papel Arquitetural

Este arquivo:

- É o scheduler do sistema de persistência.
- Separa gameplay (hot path) da escrita no banco.
- Controla carga e previsibilidade.
- Garante execução periódica consistente.

É o relógio da persistência autoritativa.





# server/state/runtime/dirty.js

## Objetivo

Gerenciar flags de “dirty” do runtime em memória.

Este módulo:

- Marca runtime como sujo para persistência.
- Marca stats como sujo para persistência.
- Atualiza estado de conexão apenas em memória.
- Não escreve no banco.
- Não conhece socket.
- Não executa flush.

A persistência é responsabilidade do `persistenceManager`.

---

## Funções

### markRuntimeDirty(userId, nowMs)

Marca `dirtyRuntime = true` se:

- Runtime existir.
- Não estiver `OFFLINE`.

Atualiza `lastRuntimeDirtyAtMs`.

Usado por gameplay (ex: movimento).

---

### markStatsDirty(userId, nowMs)

Marca `dirtyStats = true` se:

- Runtime existir.
- Não estiver `OFFLINE`.

Atualiza `lastStatsDirtyAtMs`.

---

### setConnectionState(userId, patch, nowMs)

Atualiza apenas em memória:

- `connectionState`
- `disconnectedAtMs`
- `offlineAllowedAtMs`

Sempre marca `dirtyRuntime = true`.

Persistência ocorre depois via flush.

---

## Regra Importante

Runtime `OFFLINE` não deve ficar sendo marcado como dirty por gameplay ou stats.

Transições de conexão devem ser persistidas.
Gameplay não.

---

## Papel Arquitetural

Este arquivo:

- Controla sujeira de persistência.
- Protege runtime OFFLINE.
- Mantém separação entre simulação e banco.

É um utilitário de mutação controlada do estado vivo.


# server/state/runtime/inputPolicy.js

## Objetivo

Definir a regra autoritativa que determina se o input WASD está ativo.

Este módulo:

- Não depende do cliente enviar `dir = 0`.
- Centraliza a política de prioridade entre WASD e click-to-move.
- Opera apenas sobre o runtime em memória.

---

## Regra Implementada

WASD é considerado ativo quando:

1. `rt.inputDir` existe.
2. Pelo menos um eixo (`x` ou `z`) é diferente de zero.
3. `rt.inputDirAtMs` é válido.
4. O tempo desde o último input é menor ou igual a `INPUT_DIR_ACTIVE_MS`.

Se qualquer condição falhar → WASD não está ativo.

---

## Prioridade de Controle

Política estrutural:

- Click **não cancela** WASD.
- WASD **cancela** click.
- A validade é temporal, não depende de evento explícito de "key up".

---

## Papel Arquitetural

Este arquivo:

- Centraliza a política de input.
- Evita ambiguidade entre sistemas de movimento.
- Mantém decisão autoritativa no servidor.
- Impede dependência de comportamento do cliente.

É uma regra pura de validação temporal de intenção.


# server/state/runtime/loader.js

## Objetivo

Carregar e inicializar o runtime autoritativo do jogador a partir do banco.

Este módulo:

- Lê ga_user_runtime.
- Carrega stats (move_speed).
- Carrega bounds da instância (GaLocalGeometry).
- Constrói objeto runtime completo em memória.
- Calcula chunk inicial.
- Registra no runtimeStore.
- Não executa flush.
- Não acessa socket.

É o ponto de entrada do estado vivo.

---

## ensureRuntimeLoaded(userId)

Responsável por:

1. Evitar reload se runtime já existir.
2. Buscar ga_user_runtime no banco.
3. Carregar bounds da instância.
4. Carregar speed a partir de GaUserStats.
5. Montar objeto runtime padrão.
6. Calcular chunk inicial.
7. Armazenar no store.

Se runtime não existir no banco → lança erro.

---

## Estrutura do Runtime Inicial

Inclui:

- Identidade (userId, instanceId)
- Transform (pos, yaw)
- Estado replicável (hp, action, rev)
- Chunk atual
- Speed cacheado
- Estado de conexão
- Flags de persistência (dirtyRuntime, dirtyStats)
- Anti-flood
- Bounds da instância
- Estado de movimento:
  - moveMode (STOP | WASD | CLICK)
  - moveTarget
  - moveStopRadius
  - inputDir
  - inputDirAtMs
  - lastClickAtMs

Runtime nasce completo e consistente.

---

## refreshRuntimeStats(userId)

Atualiza stats cacheados no runtime:

- Recarrega move_speed do banco.
- Atualiza runtime.speed.
- Marca dirtyStats.

Não deve ser chamado no moveHandler.
É para eventos estruturais (level up, equip, buff, etc).

---

## Helpers Internos

### sanitizeSpeed(value)
Valida número positivo.

### loadSpeedFromStats(userId)
Busca move_speed no banco.

### loadBoundsForInstance(instanceId)
Busca tamanho do local (size_x, size_z).
Calcula limites min/max X/Z.
Lança erro se bounds inválido.

---

## Papel Arquitetural

Este arquivo:

- Conecta persistência ao runtime.
- Garante que runtime sempre nasce consistente.
- Centraliza carregamento de stats e bounds.
- Evita múltiplas queries repetidas para geometry.
- Separa claramente:
  - Leitura inicial do banco
  - Execução do gameplay
  - Persistência posterior

É o construtor do estado vivo do jogador.


# server/state/runtime/store.js

## Objetivo

Armazenar runtimes autoritativos em memória.

Este módulo:

- Mantém um Map interno: userId → runtime.
- Não acessa banco.
- Não conhece socket.
- Não executa persistência.
- Não aplica regras de gameplay.

É apenas o repositório quente do estado vivo.

---

## Estrutura Interna

runtimeStore: Map<String(userId), runtime>

Chave sempre normalizada como string.

---

## API

### getRuntime(userId)

Retorna runtime ou null.

---

### setRuntime(userId, runtime)

Registra ou sobrescreve runtime em memória.

---

### hasRuntime(userId)

Indica se runtime já está carregado.

Útil para evitar reload do banco.

---

### deleteRuntime(userId)

Remove runtime da memória.

Retorna:
- true → removido
- false → não existia

Usado em eviction controlado.

---

### getAllRuntimes()

Retorna iterator dos runtimes.

Usado pelo persistenceManager para varredura.
Não expõe o Map diretamente.

---

## Papel Arquitetural

Este arquivo:

- Centraliza o armazenamento quente do runtime.
- Permite separação entre:
  - Gameplay (move, input, world)
  - Persistência (flush)
  - Infraestrutura (socket)
- Evita dependência direta do Map fora do módulo.

É o container do estado vivo do jogador.



# server/state/presence/store.js

## Objetivo

Armazenar estruturas internas de Presence e Interest em memória.

Este módulo:

- Não depende de Socket.IO.
- Não acessa banco.
- Não contém lógica de gameplay.
- Não executa cálculos de chunk.
- Apenas mantém índices estruturais.

É o armazenamento base do sistema de presença.

---

## Estruturas Internas

### presenceByInstance

Map:
instanceId → Set<userId>

Controla quais usuários estão presentes em cada instância.

---

### usersByChunk

Map:
"chunk:<instanceId>:<cx>:<cz>" → Set<userId>

Index espacial principal.

Permite lookup eficiente por área.

---

### userIndex

Map:
userId → {
  instanceId,
  cx,
  cz,
  interestRooms: Set<roomKey>
}

Estado indexado individual do usuário.

---

## Utils

### ensureSet(map, key)

Garante que exista um Set para a chave.
Cria se necessário.
Retorna o Set.

---

### deleteFromSetMap(map, key, value)

Remove value do Set associado à chave.
Se o Set ficar vazio, remove a chave do Map.

Evita lixo estrutural.

---

## Papel Arquitetural

Este arquivo:

- É o armazenamento cru da presença.
- Suporta interest management por chunk.
- Permite operações O(1) em inserção e remoção.
- Mantém isolamento entre:
  - Índice de presença
  - Gameplay
  - Socket
  - Persistência

É a base estrutural do sistema de visibilidade multiplayer.


# server/state/presence/read.js

## Objetivo

Fornecer API de leitura segura do sistema de Presence.

Este módulo:

- Não modifica estado.
- Não expõe referências internas.
- Não depende de socket.
- Não acessa banco.
- Apenas consulta estruturas do presence/store.

Todas as funções retornam cópias.

---

## Funções

### getUsersInRoom(roomKey)

Retorna:

Set<userId> novo com usuários daquele room.

Nunca retorna o Set interno.

---

### getUsersInRooms(rooms)

Recebe:

- Set<string> ou Array<string>

Retorna:

Set<userId> agregando todos usuários dos rooms.

Ignora rooms inexistentes.

---

### getUsersInChunks(instanceId, cx, cz, radius?)

Calcula interest rooms usando:

computeInterestRooms(...)

Retorna:

Set<userId> agregando usuários dos chunks no raio.

Default:
radius = CHUNK_RADIUS

---

### getInterestRoomsForUser(userId)

Retorna:

Array<string> (cópia) das rooms de interesse do usuário.

Se não existir → []

---

### getUserPresenceState(userId)

Retorna cópia do estado indexado:

{
  instanceId,
  cx,
  cz,
  interestRooms: Set<string>
}

Se não existir → null

---

## Papel Arquitetural

Este arquivo:

- É a camada de leitura do sistema de Presence.
- Garante encapsulamento das estruturas internas.
- Evita vazamento de referência.
- Permite que outras camadas (socket, world, persistence)
  consultem visibilidade sem risco de mutação externa.

É a interface de consulta do interest management.



# server/state/persistence/writers.js

## Objetivo

Executar a escrita efetiva no banco (flush) do estado sujo em memória.

Este módulo:

- Atualiza `ga_user_runtime`.
- Limpa flags `dirty`.
- Não agenda execução (isso é responsabilidade do loop).
- Não decide quem flushar (isso é responsabilidade do flushBatch).
- Não conhece socket.

É a camada que toca o banco.

---

## flushUserRuntime(userId, now)

Responsável por persistir:

- `instance_id`
- `pos_x`, `pos_y`, `pos_z`
- `yaw`
- `connection_state`
- `disconnected_at`
- `offline_allowed_at`

Regras:

- Só executa se runtime existir.
- Só executa se `dirtyRuntime === true`.
- Faz `UPDATE` por PK `user_id`.
- Após sucesso:
  - `dirtyRuntime = false`.
- Loga apenas se estado != CONNECTED.

Retorna:
- `true` se escreveu.
- `false` se não escreveu ou falhou.

---

## flushUserStats(userId, now)

Responsável por persistir stats sujos.

Hoje:

- Apenas limpa `dirtyStats`.
- Não escreve nada no banco (placeholder).

Preparado para expansão futura (payload parcial por campo).

Retorna:
- `true` se limpou dirty.
- `false` se não havia runtime ou não estava dirty.

---

## Papel Arquitetural

Este arquivo:

- Isola acesso ao banco.
- Garante que apenas runtimes marcados como dirty sejam escritos.
- Mantém separação clara entre:
  - Gameplay (hot path)
  - Agendamento (loop)
  - Decisão de batch (flushBatch)
  - Escrita real (writers)

É a camada final de persistência do modelo hot + batch.



# server/state/presence/mutate.js

## Objetivo

Implementar as operações de **mutação** do sistema de Presence/Interest (baseado em chunks).

Este módulo:

- Atualiza os índices em memória (`presenceByInstance`, `usersByChunk`, `userIndex`).
- Calcula chunk e interest rooms no servidor.
- Não depende de Socket.IO.
- Não acessa banco.

Ele é o “write-side” do presence.

---

## Funções

### addUserToInstance(userId, instanceId, pos)

Registra presença inicial do usuário:

- Se o usuário já estiver indexado, remove antes (evita duplicação/vazamento).
- Calcula chunk atual via `computeChunkFromPos(pos)`.
- Cria `chunkRoom` e `interestRooms` (3x3 por default).

Atualiza:

- `presenceByInstance[instanceId] += userId`
- `usersByChunk[chunkRoom] += userId`
- `userIndex[userId] = { instanceId, cx, cz, interestRooms }`

Retorna snapshot:

```js
{
  instanceId,
  cx,
  cz,
  chunkRoom,
  interestRooms
}


# server/state/presence/math.js

## Objetivo

Fornecer funções puras de cálculo espacial para o sistema de Presence.

Este módulo:

- Não acessa banco.
- Não depende de socket.
- Não modifica estado.
- Apenas calcula chunk e área de interesse.

É a camada matemática do interest management.

---

## computeChunkFromPos(pos)

Converte posição do mundo em coordenadas de chunk.

Entrada:
- pos.x
- pos.z

Regra:
- cx = floor(x / CHUNK_SIZE)
- cz = floor(z / CHUNK_SIZE)

Retorna:

{
  cx,
  cz
}





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


# server/state/movement/chunkTransition.js

## Objetivo

Orquestrar **spawn/despawn incremental** quando um jogador muda de chunk.

Este módulo:

- Usa o diff `entered/left` vindo do presence (`moveUserChunk`).
- Emite eventos de replicação:
  - `entity:spawn`
  - `entity:despawn`
- Implementa duas direções de visibilidade:
  - A) Outros passam a ver (ou deixam de ver) você
  - B) Você passa a ver (ou deixa de ver) outros
- Filtra entidades OFFLINE.
- Não toca banco.
- Depende de Socket.IO (io + socket) apenas para emissão de eventos.

---

## handleChunkTransition(io, socket, runtime, movedInfo)

### Entradas

- `io`: servidor Socket.IO (broadcast por room)
- `socket`: socket do jogador que se moveu (envio direto)
- `runtime`: runtime autoritativo do mover
- `movedInfo`: retorno de `moveUserChunk`, incluindo:
  - `diff.entered` (rooms que entraram no interesse)
  - `diff.left` (rooms que saíram do interesse)

---

## A) Outros veem você (broadcast por rooms)

Converte o mover em entidade replicável:

- `selfEntity = toEntity(runtime)`

Para cada room em `entered`:

- `io.to(room).emit("entity:spawn", selfEntity)`

Para cada room em `left`:

- `io.to(room).emit("entity:despawn", { entityId, rev })`

Efeito: os observadores recebem atualização sem varrer toda instância.

---

## B) Você vê outros (envio direto ao socket do mover)

Se `socket` não existir, sai (modo headless / testes / chamadas sem socket).

### Quando entrou em rooms novas

- Varre usuários presentes em cada room `entered` (`getUsersInRoom`).
- Deduplica com `seen`.
- Ignora self.
- Lê runtime do outro (`getRuntime`).
- Ignora se não existe ou se está OFFLINE.
- Emite direto para o mover:
  - `socket.emit("entity:spawn", toEntity(otherRt))`

Objetivo: o mover recebe “spawns” dos novos visíveis.

---

### Quando saiu de rooms

Problema: um usuário pode estar em uma room que saiu mas ainda ser visível via overlap (outro chunk ainda no raio).

Solução:

1. Recalcula o chunk atual do mover (`computeChunkFromPos(runtime.pos)`).
2. Calcula `visibleNow = getUsersInChunks(instanceId, cx, cz)` (baseline de visibilidade atual).
3. Para cada usuário nos rooms `left`:
   - Se ainda está em `visibleNow`, não despawna.
   - Caso contrário, emite:
     - `socket.emit("entity:despawn", { entityId, rev })`

`rev` usado é o `rev` atual do runtime do outro (ou 0 se ausente).

---

## Regras e Garantias

- Deduplicação por `seen` evita múltiplos spawns/despawns para o mesmo usuário em transições com várias rooms.
- Entidades OFFLINE não são spawnadas.
- Despawn para o mover é conservador:
  - só ocorre se o alvo não estiver mais visível no novo interest.

---

## Papel Arquitetural

Este arquivo:

- Conecta presenceIndex (diff de rooms) com replicação (spawn/despawn).
- Evita broadcasts globais, usando rooms.
- Mantém consistência de visibilidade com verificação `visibleNow`.
- Suporta multiplayer escalável por interest management.

É o “difusor” incremental da transição espacial.



# server/state/movement/entity.js

## Objetivo

Fornecer helpers para:

- Controle de revisão monotônica (`rev`)
- Serialização do runtime para formato replicável

Este módulo:

- Não acessa banco.
- Não conhece socket.
- Não modifica estruturas externas além do runtime recebido.
- É usado pelo sistema de replicação multiplayer.

---

## bumpRev(rt)

Incrementa `rt.rev` de forma segura.

Regra:

- Se `rev` for número válido → `rev + 1`
- Se inválido/ausente → inicia em `1`

Uso:

- Movimento
- Despawn
- Qualquer alteração replicável

`rev` garante ordenação monotônica no cliente.

---

## toEntity(rt)

Serializa runtime completo para spawn/baseline.

Retorna:


{
  entityId,
  displayName,
  pos,
  yaw,
  hp,
  action,
  rev
}



# server/state/movement/loop.js

## Objetivo

Executar o tick autoritativo de movimento em intervalo fixo.

Este módulo:

- Agenda execução periódica do sistema de movimento.
- Chama `tickOnce(io, now)` a cada intervalo.
- Não contém lógica de movimento.
- Não acessa banco.
- Não manipula runtime diretamente.

É apenas o scheduler do sistema de movimento.

---

## startMovementTick(io)

Inicia `setInterval` com frequência definida por:

- `MOVEMENT_TICK_MS`

A cada tick:

1. Captura timestamp (`nowMs()`).
2. Executa `tickOnce(io, now)`.
3. Captura e loga erros.

Proteções:

- Não inicia se já estiver rodando.
- Usa `unref()` quando disponível para não bloquear shutdown do processo.

Loga início do loop.

---

## stopMovementTick()

- Cancela o intervalo.
- Reseta estado interno.
- Loga parada.

---

## Papel Arquitetural

Este arquivo:

- Define o ritmo do movimento autoritativo.
- Separa agendamento da lógica (`tickOnce`).
- Garante execução previsível e periódica.
- Permite controle claro de start/stop (ex: boot, shutdown, testes).

É o relógio do sistema de movimento.



# server/state/movement/math.js

## Objetivo

Fornecer funções matemáticas puras para o sistema de movimento.

Este módulo:

- Não acessa banco.
- Não depende de socket.
- Não modifica runtime diretamente.
- Apenas executa cálculos auxiliares.

É a base matemática do movimento autoritativo.

---

## clamp(n, min, max)

Limita um número ao intervalo definido.

Regra:

- Se `n < min` → retorna `min`
- Se `n > max` → retorna `max`
- Caso contrário → retorna `n`

---

## normalize2D(x, z)

Normaliza vetor 2D.

Regra:

- Se comprimento muito pequeno → retorna `{ x: 0, z: 0 }`
- Caso contrário → retorna vetor unitário

Usado para evitar velocidade maior em diagonal.

---

## clampPosToBounds(pos, bounds)

Limita posição aos limites do mapa.

Requisitos:

- `bounds.minX`, `maxX`, `minZ`, `maxZ` devem ser válidos.

Retorna:


{
  x,
  y,
  z
}



# server/state/movement/tickOnce.js

## Objetivo

Executar **um tick autoritativo de movimento** focado em **CLICK-to-move**.

Este módulo:

- Varre todos runtimes em memória.
- Move apenas entidades em `moveMode === "CLICK"`.
- Calcula `dt` no servidor.
- Aplica bounds server-side.
- Atualiza `pos`, `yaw`, `action`, `rev`.
- Marca runtime como dirty (persistência hot + batch).
- Faz replicação incremental (`entity:delta`) para interessados.
- Envia feedback local (`move:state`) para o próprio jogador.
- Gerencia transição de chunk (rooms + spawn/despawn incremental).

Não acessa banco diretamente.
Depende de Socket.IO para join/leave e emissão de eventos.

---

## Entradas e Dependências

- `getAllRuntimes()` e `markRuntimeDirty()` (runtime store)
- `moveUserChunk()` e `computeChunkFromPos()` (presenceIndex)
- `getActiveSocket()` (sessão ativa por userId)
- Math helpers (`computeDtSeconds`, `normalize2D`, `clampPosToBounds`, `readRuntimeSpeedStrict`)
- Entity helpers (`bumpRev`, `toDelta`)
- Replicação:
  - `emitDeltaToInterest(io, socket, userId, delta)`
  - `handleChunkTransition(io, socket, rt, movedInfo)`

---

## Regras de Processamento

### 1) Filtragem inicial

Ignora runtime se:

- `connectionState` é `DISCONNECTED_PENDING` ou `OFFLINE`
- `moveMode !== "CLICK"`
- `moveTarget` ausente

Objetivo: não “andar durante pending” e não processar WASD aqui.

---

### 2) Delta time autoritativo

- `dt = computeDtSeconds(now, rt.moveTickAtMs, DT_MAX)`
- Atualiza `rt.moveTickAtMs = now`
- Se `dt <= 0` → skip

O servidor controla o avanço do tempo.

---

### 3) Validações obrigatórias

- `speed = readRuntimeSpeedStrict(rt)` (sem fallback silencioso)
- `rt.bounds` deve existir
- `moveTarget.x/z` deve ser finito

Se `moveTarget` corrompido:
- zera target
- `moveMode = "STOP"`
- `action = "idle"`
- `bumpRev` + `markRuntimeDirty`
- continua

---

### 4) Condição de parada (stopRadius)

Calcula distância até o target.

Se `dist <= stopRadius` (server-side):

- `moveTarget = null`
- `moveMode = "STOP"`
- `action = "idle"` (se necessário)
- `bumpRev` + `markRuntimeDirty`
- Replica delta para outros (`emitDeltaToInterest`)
- Envia `move:state` para self (inclui chunk)

Importante: stop é decidido no servidor.

---

### 5) Movimento por passo

- Calcula direção `dir = normalize2D(dx, dz)`
- Calcula posição desejada:
  - `pos + dir * speed * dt`
- Aplica bounds:
  - `clampPosToBounds(desired, rt.bounds)`
- Calcula yaw autoritativo:
  - `yaw = atan2(dir.x, dir.z)`

Se não mudou posição nem yaw → skip.

Commit:

- `rt.pos = clampedPos`
- `rt.yaw = newYaw`
- `rt.action = "move"`
- `bumpRev` + `markRuntimeDirty`

---

## Transição de Chunk (Interest)

Após mover:

1. Recalcula `{ cx, cz }`.
2. Detecta mudança comparando com `rt.chunk`.
3. Se mudou:
   - `movedInfo = moveUserChunk(userId, cx, cz)`
   - Atualiza `rt.chunk = { cx, cz }`
   - Se socket existe:
     - `join` rooms `entered`
     - `leave` rooms `left`
   - Orquestra replicação incremental de visibilidade:
     - `handleChunkTransition(io, socket, rt, movedInfo)`

---

## Replicação

### Para outros

- `delta = toDelta(rt)`
- `emitDeltaToInterest(io, socket, userId, delta)`

Contrato: update incremental baseado em `rev`.

### Para o próprio jogador

Se socket existe, emite:

- `move:state` com:
  - pos, yaw, rev, chunk

Isso é feedback local (não é autoridade do client).

---

## Papel Arquitetural

Este arquivo:

- Implementa simulação autoritativa de click-to-move no servidor.
- Unifica: dt server-side + speed strict + bounds obrigatórios.
- Integra interest management por chunk (rooms) com replicação incremental.
- Mantém persistência desacoplada (apenas marca dirty).

É o “coração” do loop de click-to-move.


# server/socket/handlers/move/applyWASD.js

## Objetivo

Aplicar um **intent de movimento WASD** diretamente no runtime autoritativo.

Este módulo:

- Atualiza `pos`, `yaw`, `moveMode`, `action` e estado de input (`inputDir`).
- Calcula `dt` no servidor (não confia no client).
- Aplica bounds server-side.
- Não emite eventos (sem socket emit aqui).
- Não toca banco.
- Retorna um resumo do que mudou para o handler decidir replicação/persistência.

É um “aplicador puro” de intent para o runtime.

---

## applyWASDIntent({ runtime, nowMs, dir, yawDesired, isWASDActive })

### Entradas

- `runtime`: estado autoritativo em memória.
- `nowMs`: clock do servidor.
- `dir`: vetor desejado `{x,z}` do client.
- `yawDesired`: orientação desejada (camera).
- `isWASDActive`: política server-side (timeout) para decidir se WASD está ativo.

---

## Regras Principais

### 1) dt autoritativo

- `dt = computeDtSeconds(nowMs, runtime.wasdTickAtMs, DT_MAX)`
- Atualiza `runtime.wasdTickAtMs = nowMs`

Cliente não decide dt.

---

### 2) yaw desejado (se fornecido)

- Normaliza ângulo para [-π, π] via `atan2(sin, cos)`
- Atualiza `runtime.yaw` se mudou
- Flag: `yawChanged`

---

### 3) normalização e estado de input

- Normaliza direção: `d = normalize2D(dir.x, dir.z)`
- Sempre atualiza:
  - `runtime.inputDir = d`
  - `runtime.inputDirAtMs = nowMs`

Motivo: política de timeout server-side não depende de “keyup”.

---

### 4) política de prioridade WASD vs CLICK

- `wasdActiveNow = isWASDActive(runtime, nowMs)`

Se WASD ativo:

- WASD **cancela CLICK**:
  - se `moveMode === "CLICK"` → zera `moveTarget` e muda para `WASD`
- Garante `moveMode === "WASD"`
- Garante `action === "move"`

Se WASD não ativo:

- Se estava em `WASD` → volta para `STOP`
- Se direção é zero → garante `action === "idle"`

Flag: `modeOrActionChanged`

---

### 5) velocidade estrita

- `speed = readRuntimeSpeedStrict(runtime)`
- Se inválido:
  - retorna `ok:false` com `reason:"invalid_speed"`

Sem fallback silencioso.

---

### 6) movimento com bounds (somente se dir != 0)

Se direção não-nula:

- Exige `runtime.bounds`
  - se ausente → `ok:false reason:"missing_bounds"`
- Calcula `desired = pos + d * speed * dt`
- Aplica `clampPosToBounds(desired, bounds)`
  - se inválido → `ok:false reason:"invalid_bounds"`
- Se mudou `x/z`:
  - `runtime.pos = clampedPos`
  - `moved = true`

Se direção nula:
- Não move.

---

## Retorno

Sempre retorna um resumo:


{
  ok: boolean,
  reason: string|null,
  yawChanged: boolean,
  moved: boolean,
  modeOrActionChanged: boolean,
  dir: { x, z } // normalizado
}



# server/socket/handlers/move/broadcast.js

## Objetivo

Aplicar a etapa de **replicação pós-WASD** a partir do socket handler.

Este módulo:

- Não aplica movimento (isso ocorre em `applyWASDIntent`).
- Decide replicação e efeitos colaterais de rede após o runtime ser atualizado:
  - `rev++`
  - `markRuntimeDirty`
  - transição de chunk (presence + rooms + spawn/despawn)
  - `entity:delta` para o interest
  - `move:state` para o próprio jogador
- Não toca banco.

É o “broadcast layer” do WASD.

---

## emitDeltaToInterestFromSocket(socket, userId, payload)

Emite `entity:delta` para todas as rooms do interest do usuário:

- rooms = `getInterestRoomsForUser(userId)`
- para cada room:
  - `socket.to(room).emit("entity:delta", payload)`

Não envia eco para o próprio socket (usa `socket.to`).

---

## broadcastWASDResult({ socket, userId, runtime, nowMs })

Pipeline executado após WASD ser aplicado no runtime.

### 1) Revisão monotônica + dirty

- `bumpRev(runtime)`  
  Regra: qualquer mudança replicável incrementa `rev`.

- `markRuntimeDirty(userId, nowMs)`  
  Hot path: marca para persistência posterior (batch).

---

### 2) Detecção de mudança de chunk

- Calcula `{ cx, cz } = computeChunkFromPos(runtime.pos)`
- Compara com `runtime.chunk`
- Se mudou:

1. Atualiza presença:
   - `movedInfo = moveUserChunk(userId, cx, cz)`
2. Atualiza fonte local:
   - `runtime.chunk = { cx, cz }`
3. Aplica join/leave no socket:
   - `socket.join(r)` para `entered`
   - `socket.leave(r)` para `left`
4. Orquestra spawn/despawn incremental:
   - `handleChunkTransition(socket.server, socket, runtime, movedInfo)`

---

### 3) Delta para outros

- `delta = toDelta(runtime)`
- `emitDeltaToInterestFromSocket(socket, userId, delta)`

Replica atualização incremental para observadores.

---

### 4) Feedback local

Emite `move:state` para o próprio jogador:

{
  entityId,
  pos,
  yaw,
  rev,
  chunk
}



# server/socket/handlers/world/baseline.js

## Objetivo

Construir o **baseline autoritativo** enviado ao cliente após `world:join` ou `world:resync`.

Este módulo:

- Consolida o estado visível do jogador.
- Separa claramente:
  - `you` (self completo)
  - `others` (entidades visíveis sem self)
- Filtra entidades OFFLINE.
- Não toca banco.
- Não depende de socket.

É um builder de snapshot multiplayer.

---

## buildBaseline(rt)

### Entrada

- `rt`: runtime autoritativo do jogador.

---

## Fluxo

1. Calcula interesse espacial:

   - `{ cx, cz } = computeInterestFromRuntime(rt)`

2. Constrói entidade do self:

   - `you = toEntity(rt)`

3. Obtém usuários visíveis:

   - `visibleUserIds = getUsersInChunks(instanceId, cx, cz)`

4. Para cada `uid` visível:

   - `other = getRuntime(uid)`
   - Ignora se:
     - runtime inexistente
     - `connectionState === "OFFLINE"`
     - for o próprio jogador
   - Converte com `toEntity(other)`
   - Adiciona em `others`

---

## Retorno

{
  instanceId: String(rt.instanceId),
  you,
  chunk: { cx, cz },
  others
}



# server/socket/handlers/world/join.js

## Objetivo

Implementar o fluxo autoritativo de `world:join`.

Este módulo:

- Garante runtime carregado em memória.
- Impede join se o jogador estiver OFFLINE.
- Indexa presença no `presenceIndex` (idempotente).
- Aplica rooms autoritativas no socket (instância + chunks do interest).
- Retorna baseline obrigatório para o cliente.

Não toca banco diretamente (apenas via `ensureRuntimeLoaded`).
Não decide simulação.
É a porta de entrada do mundo via socket.

---

## handleWorldJoin({ socket })

### Entrada

- `socket`: conexão Socket.IO já autenticada (contém `socket.data.userId`).

---

## Fluxo

1. Resolve identidade:
   - `userId = socket.data.userId`

2. Garante runtime em memória:
   - `await ensureRuntimeLoaded(userId)`
   - `rt = getRuntime(userId)`
   - Se não existir → erro `RUNTIME_NOT_LOADED`

3. Bloqueia estado inválido:
   - Se `rt.connectionState === "OFFLINE"` → erro `CANNOT_JOIN_OFFLINE`

4. Indexa presença (idempotente):
   - `info = addUserToInstance(userId, rt.instanceId, rt.pos)`
   - Retorna chunk atual e `interestRooms`.

5. Calcula e aplica rooms autoritativas:
   - `targetRooms = buildRooms(instanceId, info.interestRooms)`
   - `applyRooms(socket, targetRooms)`

Rooms incluem:
- `inst:<instanceId>`
- `chunk:<instanceId>:<cx>:<cz>` do interest

6. Marca estado no socket:
   - `socket.data.instanceId = instanceId`
   - `socket.data._worldJoined = true`

7. Constrói baseline obrigatório:
   - `baseline = buildBaseline(rt)`

8. Retorna:
   - `{ rt, baseline }`

---

## Retorno


{
  rt,        // runtime autoritativo em memória
  baseline   // snapshot inicial (you + others + chunk)
}


# server/socket/handlers/world/resync.js

## Objetivo

Implementar o fluxo autoritativo de `world:resync`.

Este módulo:

- Garante runtime carregado.
- Recalcula interest (cx/cz) a partir do runtime.
- Atualiza presenceIndex (chunk/interest) via `moveUserChunk`.
- Se o usuário não estava indexado, recria presença com `addUserToInstance`.
- Reaplica rooms autoritativas no socket.
- Emite baseline completo para reancorar o cliente.

Não toca banco diretamente (apenas via `ensureRuntimeLoaded`).
É um mecanismo de correção/reatualização de estado no cliente.

---

## handleWorldResync({ socket })

### Entrada

- `socket`: conexão Socket.IO autenticada (`socket.data.userId`).

---

## Fluxo

1. Resolve identidade:
   - `userId = socket.data.userId`

2. Garante runtime em memória:
   - `await ensureRuntimeLoaded(userId)`
   - `rt = getRuntime(userId)`
   - Se faltar → erro `RUNTIME_NOT_LOADED`

3. Bloqueia estado inválido:
   - Se `rt.connectionState === "OFFLINE"` → erro `CANNOT_RESYNC_OFFLINE`

4. Recalcula interest a partir do runtime:
   - `{ cx, cz } = computeInterestFromRuntime(rt)`

5. Atualiza presença/chunk (se já existia):
   - `moved = moveUserChunk(userId, cx, cz)`

6. Se não havia index (moved == null), cria:
   - `info = addUserToInstance(userId, rt.instanceId, rt.pos)`

7. Determina interestRooms autoritativo:
   - Se `moved` existe → `interestRooms = moved.next.interestRooms`
   - Senão → `interestRooms = info.interestRooms`

8. Reaplica rooms do socket:
   - `targetRooms = buildRooms(instanceId, interestRooms)`
   - `applyRooms(socket, targetRooms)`

9. Marca estado no socket:
   - `socket.data.instanceId = instanceId`
   - `socket.data._worldJoined = true`

10. Constrói baseline:
   - `baseline = buildBaseline(rt)`

11. Retorna:
   - `{ rt, baseline }`

---

## Retorno


{
  rt,        // runtime autoritativo
  baseline   // snapshot (you + others + chunk)
}


# server/socket/handlers/world/rooms.js

## Objetivo

Gerenciar rooms autoritativas do socket com base na instância e no interest calculado pelo servidor.

Este módulo:

- Não calcula interest.
- Não decide visibilidade.
- Apenas sincroniza as rooms do socket com um conjunto alvo.
- Evita duplicação ou vazamento de rooms antigas.

É a camada de sincronização entre presenceIndex e Socket.IO.

---

## getSocketJoinedRooms(socket)

Retorna:

- `Set<string>` com as rooms atuais do socket.
- Exclui automaticamente a room privada (`socket.id`).

Uso:
- Base para calcular diff entre rooms atuais e desejadas.

---

## applyRooms(socket, targetRooms)

Sincroniza rooms do socket com `targetRooms`.

Fluxo:

1. Obtém rooms atuais via `getSocketJoinedRooms`.
2. Para cada room atual que não está em `targetRooms`:
   - `socket.leave(r)`
3. Para cada room em `targetRooms` que o socket ainda não está:
   - `socket.join(r)`

Garantia:
- Após execução, o socket estará exatamente nas rooms definidas pelo servidor.

---

## buildRooms(instanceId, interestRoomsSet)

Constrói o conjunto de rooms autoritativas:

- Sempre inclui:
  - `inst:<instanceId>`
- Inclui todas as rooms do interest (chunks).

Retorna:
Set<string>
inst:42
chunk:42:10:15
chunk:42:10:16
chunk:42:11:15
...