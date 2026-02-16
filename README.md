# Projeto MMO (Estado Atual)

## Visão

O projeto está construindo uma plataforma MMO onde:

* **Backend é a fonte da verdade**
* O mundo é **declarativo** (modelado em banco)
* O front apenas **renderiza um snapshot** do mundo recebido do servidor
* O gameplay (herói/movimento) ainda não existe: o foco atual é **pipeline mundo → snapshot → render**

---

# 1) Backend

## 1.1 Autenticação

Endpoints:

* `POST /auth/register`
* `POST /auth/login`

Características:

* JWT funcionando
* Middleware `requireAuth` protege rotas em `/world`
* O front salva token e usa para acessar mundo

---

## 1.2 Estrutura de Mundo (Banco)

### Tabelas CORE

* **`ga_user`**: usuário
* **`ga_user_profile`**: perfil do usuário
* **`ga_user_stats`**: atributos/estatísticas (reserva para evolução)
* **`ga_user_runtime`**: estado de execução do usuário no mundo (posição/rotação + ponte pro mundo)

### Hierarquia do mundo: `ga_local`

`ga_local` representa a **árvore do mundo**:

* universo → planeta → setor → cidade → local

Campos principais:

* `code` (único, estável)
* `local_type` (ENUM: UNIVERSO/PLANETA/SETOR/CIDADE/LOCAL)
* `parent_id` (FK auto-referente)
* `is_active`
* `created_at`, `updated_at`

Regra estrutural:

* FK `parent_id` usa **NO ACTION** em delete: não apaga nó pai com filhos (consistência do mundo).

---

## 1.3 Geometria e Visual do Local

### `ga_local_geometry` (1:1)

Define geometria lógica do local (MVP):

* `size_x`, `size_z` (bounds de chão)

### `ga_local_visual` (1:1)

Define visual do local e faz ponte para materiais/mesh.

Estado atual:

* Mantém **material físico** do chão:

  * `ground_material_id` → `ga_material`
* Adiciona camada de render declarativo:

  * `ground_mesh_id` → `ga_mesh_template`
  * `ground_render_material_id` → `ga_render_material`
* Fallback:

  * `ground_color` (placeholder)
* Versionamento:

  * `version` (incrementado quando o template visual mudar; futuro cache no front)

Regras:

* Física do chão vem de `ga_material`
* Aparência vem de `ga_render_material` (ou `ground_color` se não existir)
* Geometria render vem de `ga_mesh_template` (ou default plane no futuro)

---

## 1.4 Materiais

### Material físico: `ga_material`

* Propriedades físicas (friction/restitution etc)
* Usado para colisão/gameplay e coerência física

### Material visual: `ga_render_material`

Biblioteca de materiais de render:

* `kind`: `color | texture | pbr | shader`
* `base_color`, `texture_url`, `roughness`, `metalness` etc
* Reutilizável por múltiplos locais/objetos

---

## 1.5 Mesh Template: `ga_mesh_template`

Biblioteca de meshes declarativas:

* `mesh_kind`: `primitive | gltf`
* `primitive_type`: `plane | box | sphere | cylinder ...`
* `gltf_url` (quando for asset)
* `default_scale_x/y/z`

---

## 1.6 Instância do Mundo (posicionamento do usuário)

A presença do jogador no mundo é resolvida via **instância**.

### `ga_instance`

Representa “onde o runtime está”:

* `ga_user_runtime.instance_id` → `ga_instance.id`
* `ga_instance.local_id` → `ga_local.id`

Isso cria o encadeamento:

```
ga_user
  1:1 ga_user_runtime
        → instance_id
          N:1 ga_instance
                → local_id
                  N:1 ga_local
                        1:1 ga_local_geometry
                        1:1 ga_local_visual
                              → ground_material_id (físico)
                              → ground_mesh_id (render)
                              → ground_render_material_id (render)
```

---

# 2) Bootstrap do Mundo

## Endpoint

`GET /world/bootstrap` (protegido por JWT)

## Retorno (snapshot mínimo)

Entrega o mínimo para o cliente montar o mundo:

* **runtime**

  * posição
  * yaw/rotação
* **instância**

  * id / status (conforme implementado)
* **template do local**

  * geometry: `size_x`, `size_z`
  * visual:

    * `groundMaterial` (físico)
    * `groundRenderMaterial` (visual) e/ou `ground_color`
    * `groundMesh` (quando usado)
    * `version` para futuro cache

Logs confirmam tamanho:

* `sizeX: 1000`
* `sizeZ: 1000`

Pipeline validado:

> Backend → Snapshot → Front → Render geométrico

---

# 3) Frontend

## 3.1 Arquitetura atual

Componentes:

```
WorldRoot → decide auth
GameShell → busca bootstrap
GameCanvas → renderiza (puro)
camera.js → câmera
light.js → iluminação
```

Responsabilidades:

* `GameShell`: orquestra IO (bootstrap e snapshot)
* `GameCanvas`: render host (Three.js) sem HTTP e sem regra de mundo
* `camera.js` e `light.js`: módulos isolados

---

## 3.2 Render atual (MVP)

O cliente renderiza:

* Plano invisível (colisor lógico / chão base)
* Retângulo de limites (LineLoop) baseado em `size_x/size_z`
* Câmera configurada com bounds (`setBounds`)
* Luz básica (setupLight)

Ainda NÃO existe:

* herói
* movimento
* gameplay
* objetos de cenário

Objetivo do render atual:

* provar consistência do mundo declarativo:

  * “o banco define”
  * “o backend resolve”
  * “o front desenha”

---

# 4) Evolução planejada (próximas etapas)

## 4.1 Render declarativo completo

Expandir template visual para suportar:

* textura, mesh associada, skybox, ambient settings
* objetos de cenário e instancing
* LOD e metadados gráficos

A base já existe com:

* `ga_render_material`
* `ga_mesh_template`
* `ga_local_visual` versionado

## 4.2 Cache de templates no Front (ainda não implementado)

Estratégia:

* `/world/bootstrap` retorna `localTemplate.version`
* `localStorage` mantém cache por `local_id`
* se `version` bater, usa cache
* se não bater, atualiza cache

Exemplo:

```js
world_cache_local_18 = {
  version: 3,
  template: {...}
}
```

Segurança:

* template não é sensível
* servidor continua sendo fonte da verdade
* cache é só otimização

---

# 5) Nota sobre consistência (importante)

O banco e o jogo devem seguir o mesmo contrato:

* `ga_local` é hierarquia canônica
* deletes são restritos (NO ACTION) para manter integridade
* `ga_local_visual` mantém físico (`ga_material`) separado do visual (`ga_render_material`)
* render evolui sem quebrar o pipeline do snapshot

---


