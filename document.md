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

Configura autenticação e ciclo de vida das conexões Socket.IO.

---

## Autenticação

- Lê `socket.handshake.auth.token`.
- Aceita `<token>` ou `Bearer <token>`.
- Valida JWT.
- Injeta:
  - `socket.data.userId`
  - `socket.data.displayName`
- Rejeita conexão se inválido.

---

## Conexão

Ao conectar:

- Garante runtime carregado (`ensureRuntimeLoaded`).
- Marca estado como `CONNECTED`.
- Cancela qualquer logout pendente.
- Executa flush imediato do runtime.
- Registra `moveHandler`.
- Emite `socket:ready`.

---

## Desconexão

Ao desconectar:

- Marca `DISCONNECTED_PENDING`.
- Define `offlineAllowedAtMs = now + 10s`.
- Executa flush imediato.
- Personagem permanece no mundo por 10 segundos.

Após esse período, o `persistenceManager` finaliza para `OFFLINE`.

---

## Papel no Sistema

- Protege canal WebSocket com JWT.
- Controla presença do jogador.
- Integra runtime com persistência.
- Não executa lógica de movimento.


# moveHandler.js — Movimento Autoritativo via Socket

# Arquivo:
# moveHandler.js — Movimento Autoritativo via Socket

## Arquivo
`server/socket/handlers/moveHandler.js`

---

## O que faz

Processa eventos `move:intent` enviados pelo cliente e aplica movimento autoritativo no servidor.

O cliente envia intenção.  
O servidor valida, calcula e confirma o estado.

---

## Regras de Segurança

- Garante runtime carregado (`ensureRuntimeLoaded`).
- Ignora movimento se:
  - `DISCONNECTED_PENDING`
  - `OFFLINE`
- Limita frequência (`MOVES_PER_SEC`).
- Limita delta time (`DT_MAX`).
- Normaliza vetor de direção.
- Valida números.
- Valida `speed` estritamente (sem fallback automático).

---

## Processo

1. Valida payload (`dir`, `dt`, `yawDesired`).
2. Aplica rate limit.
3. Normaliza direção 2D.
4. Atualiza `yaw` se necessário.
5. Calcula deslocamento:  
   `pos += direction * speed * dt`
6. Marca runtime como sujo (`markRuntimeDirty`).
7. Emite `move:state` confirmado ao cliente.

---

## Persistência

- Não acessa banco.
- Não executa flush.
- Apenas marca `dirtyRuntime`.
- O `persistenceManager` decide quando persistir.

---

## Papel no Sistema

- Garante que o servidor é a única fonte de verdade da posição.
- Impede manipulação de velocidade ou tempo pelo cliente.
- Integra gameplay com modelo hot + batch de persistência.


# persistenceManager.js — Gerenciador de Persistência Hot + Batch

## Arquivo  
`server/state/persistenceManager.js`

---

## O que faz

Gerencia a **persistência periódica e controlada** do estado em memória (`runtimeStore`) para o banco de dados.

Esse arquivo é responsável por:

- Executar um loop de persistência (`setInterval`).
- Aplicar regras de logout pendente (anti-combat-log).
- Persistir apenas runtimes marcados como `dirty`.
- Controlar a taxa de escrita no banco (batch + limites).
- Realizar flush imediato em eventos críticos (ex: disconnect).

Ele é a camada que conecta o estado vivo da simulação à persistência durável.

---

## Papel Arquitetural

- O `runtimeStore` mantém o estado autoritativo em memória.
- O `moveHandler` apenas marca estado como sujo.
- O `persistenceManager` decide **quando e como** escrever no banco.

Isso garante:

- Nenhum acesso ao banco no hot path.
- Controle de carga no banco.
- Escalabilidade progressiva.

---

## Loop de Persistência

O método `startPersistenceLoop()` inicia um intervalo configurável (`PERSIST_TICK_MS`).

A cada ciclo ele executa:

- `tickDisconnects(now)`
- `flushDirtyBatch(...)`

O loop pode ser interrompido via `stopPersistenceLoop()`.

---

## Regras de Logout (Anti-Combat-Log)

Função: `tickDisconnects(now)`

- Jogadores em `DISCONNECTED_PENDING` permanecem no mundo por 10 segundos.
- Quando `now >= offlineAllowedAtMs`:
  - O estado vira `OFFLINE`.
  - O runtime é marcado como `dirty`.
  - O flush ocorrerá no próximo ciclo.

Isso garante que desconectar o cliente não remove o personagem imediatamente.

---

## Persistência em Batch

Função: `flushDirtyBatch(...)`

- Identifica runtimes com `dirtyRuntime` ou `dirtyStats`.
- Ordena pelos mais antigos sujos.
- Limita a quantidade de flush por tick (`MAX_FLUSH_PER_TICK`).
- Impõe intervalo mínimo entre flushes do mesmo usuário:
  - `MIN_RUNTIME_FLUSH_GAP_MS`
  - `MIN_STATS_FLUSH_GAP_MS`

Objetivo:

- Evitar travar o event-loop.
- Evitar sobrecarga no banco.
- Priorizar estados mais antigos.

---

## Flush de Runtime

Função: `flushUserRuntime(userId)`

Atualiza no banco:

- `instance_id`
- `pos_x`, `pos_y`, `pos_z`
- `yaw`
- `connection_state`
- `disconnected_at`
- `offline_allowed_at`

Após sucesso:

- `dirtyRuntime = false`

Esse flush é executado apenas se o runtime estiver marcado como sujo.

---

## Flush de Stats

Função: `flushUserStats(userId)`

Atualmente:

- Apenas limpa `dirtyStats`.
- Preparado para futura expansão (ex: write-back de stats modificados em memória).

---

## Flush Imediato

Função: `flushUserRuntimeImmediate(userId)`

Usado principalmente em:

- Evento de `disconnect` do socket.

Garante checkpoint imediato do estado no banco.

---

## Configurações por Ambiente

Pode ser ajustado via variáveis de ambiente:

- `PERSIST_TICK_MS`
- `MAX_FLUSH_PER_TICK`
- `MIN_RUNTIME_FLUSH_GAP_MS`
- `MIN_STATS_FLUSH_GAP_MS`

---

## O que não faz

- Não executa lógica de gameplay.
- Não decide regras de combate.
- Não manipula instâncias.
- Não acessa diretamente o socket.
- Não remove runtimes da memória.

---

## Estado Atual

O `persistenceManager` implementa o modelo de persistência **hot + batch**, permitindo:

- Simulação autoritativa em memória.
- Persistência controlada.
- Proteção contra combat logging.
- Base para escalabilidade futura.



# runtimeStore.js — Store de Runtime em Memória



## Arquivo  
`server/state/runtimeStore.js`

---

## O que faz

Mantém o **estado autoritativo em memória** (runtime) de cada jogador carregado no servidor.

Esse arquivo é o **cache quente do servidor de simulação** e também controla presença e integração com o modelo de persistência.

Ele:

- Armazena estado ativo do jogador (posição, yaw, velocidade).
- Mantém estado de conexão (`CONNECTED`, `DISCONNECTED_PENDING`, `OFFLINE`).
- Controla a janela de logout de 10 segundos (anti-combat-log).
- Implementa flags de persistência (`dirtyRuntime`, `dirtyStats`).
- Controla anti-flood de movimento.
- Evita consultas ao banco durante o gameplay.
- Permite atualização dinâmica de stats em memória.

O banco é a persistência durável.  
O `runtimeStore` é o estado vivo da simulação.

---

## Papel Arquitetural Atual

- O `moveHandler` altera apenas o runtime em memória.
- Nenhuma lógica de movimento acessa o banco.
- Mudanças de estado apenas marcam o runtime como sujo.
- O `persistenceManager` é responsável por decidir quando escrever no banco.

Ele funciona como camada intermediária entre gameplay em tempo real e persistência durável.

---

## Armazenamento

Utiliza um `Map` em memória:

- Chave: `userId` (string)
- Valor: objeto `runtime`



# server.js — Bootstrap do Servidor HTTP + Socket

Arquivo:
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