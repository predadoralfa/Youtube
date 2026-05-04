# Checklist Temporario - Scene Creator

## 1. Alinhamento de arquitetura

- [x] Confirmar que o `scene-creator/` sera uma aplicacao separada na raiz do projeto
- [x] Confirmar que o `server/` atual sera a autoridade unica de leitura e escrita
- [x] Confirmar que o `client/` jogavel perdera o fluxo de edicao de cena
- [x] Confirmar que `SceneObject` sera dominio separado de `Actor`
- [x] Confirmar que o editor nao acessara o banco diretamente

## 2. Banco de dados

- [x] Criar migration de `ga_scene_object_def`
- [x] Criar migration de `ga_scene_object`
- [x] Definir colunas finais de `ga_scene_object_def`
- [x] Definir colunas finais de `ga_scene_object`
- [x] Padronizar `yaw` como rotacao do MVP
- [x] Adicionar indices principais
- [x] Criar seed inicial de `SceneObjectDef`

## 3. Models e backend base

- [x] Criar model `GaSceneObjectDef`
- [x] Criar model `GaSceneObject`
- [x] Registrar models no `server/models/index.js`
- [x] Criar associacoes com `GaInstance`
- [x] Criar associacoes entre def e instancia
- [x] Criar `sceneObjectLoader`
- [x] Criar payload builder de `SceneObject`
- [x] Criar runtime store de `SceneObject`

## 4. Bootstrap do jogo principal

- [x] Incluir `sceneObjects` no bootstrap do mundo
- [x] Garantir contrato consistente no payload retornado
- [x] Validar coexistencia de `actors` e `sceneObjects` no snapshot

## 5. Client jogavel

- [x] Criar render layer de `SceneObject`
- [x] Criar `ObjectFactory`
- [x] Criar mapeamentos iniciais de object
- [x] Integrar `sceneObjects` no runtime visual
- [x] Garantir que `SceneObject` nao entra no target de gameplay
- [x] Manter `Actor` com comportamento atual de gameplay

## 6. Backend de editor

- [x] Criar bootstrap leve para editor
- [x] Criar rota para listar `ActorDef`
- [x] Criar rota para listar `SceneObjectDef`
- [x] Criar rota para spawn de `Actor`
- [x] Criar rota para spawn de `SceneObject`
- [x] Criar rota para update de `Actor`
- [x] Criar rota para update de `SceneObject`
- [x] Criar rota para delete/disable de `Actor`
- [x] Criar rota para delete/disable de `SceneObject`
- [x] Validar permissao GM/editor nas rotas

## 7. Permissao e seguranca

- [x] Definir estrategia de permissao GM/editor
- [x] Decidir se sera `role` ou `can_edit_world`
- [x] Levar permissao para middleware HTTP
- [x] Levar permissao para eventuais canais socket de editor
- [x] Garantir que usuario comum nao acessa editor

## 8. Nova aplicacao `scene-creator`

- [x] Criar pasta `scene-creator/`
- [x] Definir stack do frontend do editor
- [x] Configurar bootstrap da aplicacao
- [x] Conectar no backend atual
- [x] Montar cena com contrato do servidor
- [x] Reaproveitar assets do `client/`
- [x] Reaproveitar helpers/modulos compartilhaveis

## 9. UI do editor

- [x] Criar painel principal do editor
- [x] Criar secao `Spawn Object`
- [x] Criar secao `Spawn Actor`
- [x] Criar secao `Selected`
- [x] Adicionar selects de tipo
- [x] Adicionar toggle de usar posicao atual
- [x] Adicionar campos `X/Y/Z`
- [x] Adicionar botao `OK`
- [x] Exibir `Kind`, `ID` e `Type` da entidade selecionada

## 10. Selecao e manipulacao

- [x] Permitir target de `SceneObject` no `scene-creator`
- [x] Permitir target de `Actor` no `scene-creator`
- [x] Adicionar select combinado para `Actor` e `SceneObject`
- [x] Atualizar selecao automatica apos spawn
- [x] Editar `Position X/Y/Z`
- [x] Editar `Yaw`
- [x] Editar `Scale X/Y/Z`
- [x] Persistir alteracoes pelo backend
- [x] Permitir delete/disable da selecao atual

## 11. Locomocao GM

- [x] Definir locomocao inicial do operador
- [x] Implementar velocidade alta
- [x] Remover stamina/fome/sede do fluxo do editor
- [x] Expor coordenadas atuais para facilitar spawn manual
- [x] Avaliar necessidade de camera livre depois do MVP
- [x] Ajustar camera do editor para pivô invisível no chão
- [x] Permitir locomoção do editor com WASD e Ctrl como acelerador

## 12. Reaproveitamento e modularizacao

- [x] Identificar modulos do `client/` que precisam ser compartilhados
- [x] Extrair helpers sem acoplar gameplay
- [x] Evitar copiar factories sem modularizar
- [x] Evitar duplicar contratos de payload
- [x] Revisar imports entre `client/` e `scene-creator/`

## 13. Limpeza do jogo principal

- [x] Remover `lil-gui` do `client/`
- [x] Remover fluxo de edicao de actor do cliente jogavel
- [x] Remover dependencia de manutencao de cena do gameplay
- [x] Garantir que o jogo continua renderizando a cena corretamente

## 14. Validacao final

- [ ] Spawn de `SceneObject` persistindo no banco
- [ ] Spawn de `Actor` persistindo no banco
- [ ] Update de transform persistindo no banco
- [ ] Delete/disable funcionando
- [ ] Bootstrap do jogo lendo a cena atualizada
- [ ] `scene-creator` funcionando sem HUD de gameplay
- [ ] Jogo principal funcionando sem ferramentas de edicao

## 15. Pos-MVP

- [ ] Avaliar camera livre
- [ ] Avaliar duplicacao de entidade
- [ ] Avaliar suporte a filtros por categoria
- [ ] Avaliar busca por ID/tipo
- [ ] Avaliar gizmos visuais de translacao/rotacao/escala

## 16. Limpeza de painel

- [x] Remover botoes manuais de locomocao do painel

## 17. Locomocao local

- [x] Tornar locomocao do editor local e independente do backend
- [x] Criar personagem local visivel para servir de pivô da camera no editor
- [x] Prender o personagem local ao terreno e fazer a camera seguir esse personagem
- [x] Fazer a locomocao responder à orientacao da camera
- [x] Exibir marcador amarelo com `XYZ` acima do personagem local
- [x] Manter o personagem sem rotacao ao andar, apenas em quatro direcoes
- [x] Corrigir inversao de A/D no movimento do editor
- [x] Fazer o movimento local usar o yaw da camera do editor

## 18. Estudo do giro da camera

- [x] Instrumentar telemetria local de `yaw`, `rotation.y`, entradas e posicao do personagem no `scene-creator`
- [x] Separar o input local do `scene-creator` do pipeline compartilhado do `GameCanvas`
- [x] Replicar o contrato de input do `client` usando `InputBus`, `bindInputs` e `toWorldDir`
- [x] Voltar a capturar teclado direto no editor para estudo de foco e eventos do browser
- [x] Esperar o canvas do `scene-creator` antes de prender os listeners de input
- [x] Exibir contadores visiveis de `keydown`, `keyup`, `orbit` e `zoom` no debug do editor
- [x] Expor `cameraApi`, `camera` e `runtime` reais do `GameCanvas` para o `scene-creator`
- [x] Mover o controlador de locomocao para `scene-creator/src/Character/movement`
- [x] Desligar o input interno compartilhado do `GameCanvas` no `scene-creator`
- [x] Remover o debug visual de movimento da tela do editor

## 19. Independencia real do editor

- [x] Remover o alias do `scene-creator` para `client/src`
- [x] Criar bases locais de `AuthPage`, `LoadingOverlay`, `Api`, `GameCanvas` e helpers
- [x] Reaproveitar a geometria de terreno/procedural do bootstrap do mundo no editor
- [x] Ajustar actors/objects para nascerem sobre o terreno correto do editor
