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


# server/socket/handlers/clickMoveHandler.md

## Arquivo
`server/socket/handlers/clickMoveHandler.js`

---

## Objetivo

Registrar e processar a intenção de **movimento por clique** enviada pelo cliente via evento Socket.IO:

Esse handler **não executa movimento diretamente**.  
Ele apenas configura o runtime para que o sistema de tick autoritativo processe o deslocamento posteriormente.

É um ponto de entrada de intenção, não de simulação.

---

## Papel Arquitetural

- Consome input do cliente.
- Valida dados mínimos.
- Aplica regras de segurança básicas.
- Atualiza estado do runtime em memória.
- Não acessa banco.
- Não replica estado.
- Não incrementa `rev`.
- Não calcula física.
- Não emite eventos de movimento.

Ele prepara o runtime para o loop autoritativo.

---

## Dependências

### runtimeStore

- `ensureRuntimeLoaded(userId)`
- `getRuntime(userId)`
- `isWASDActive(rt, nowMs)`

Não interage com:
- persistenceManager
- presenceIndex
- socket rooms

---

## Evento Registrado

### `move:click`

Payload esperado:

{
  "x": number,
  "z": number
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