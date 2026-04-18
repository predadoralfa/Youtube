# Plano Tecnico - Mapa Procedural da Instancia 3

## Objetivo

Transformar a instancia 3 no primeiro mapa real do jogo que usa o novo modelo procedural.
O mapa de desenvolvimento continua existindo como ambiente de teste de mecanicas.

A instancia 3 deve servir como o primeiro caso real de:

- mapa grande
- carregamento por seed e regras
- decoracao estatica gerada no cliente
- servidor autoritativo apenas para o que importa para gameplay

---

## Escopo

### Vai virar procedural

No cliente:

- terreno visual
- relevo macro
- borda visual do mapa
- arvores decorativas repetitivas
- pedras decorativas repetitivas
- arbustos
- grama e detalhes de solo
- ruinas decorativas repetitivas
- props estaticos derivados da seed
- LOD e instancing da decoracao

### Continua autoritativo no servidor

No servidor:

- players
- NPCs
- inimigos
- recursos coletaveis
- containers
- triggers
- portais
- areas de spawn
- zonas seguras e zonas proibidas
- colisao logica relevante para gameplay
- overrides persistentes
- objetos unicos
- eventos dinamicos

### Fica fora do MVP inicial

- editor manual de mapas
- persistencia massiva de decoracao estatica
- streaming de um mundo inteiro de uma vez
- suporte a varias familias de mapa ao mesmo tempo

---

## Ordem Exata De Implantacao

### Etapa 1 - Definir o contrato do mapa 3

Criar uma definicao declarativa para a instancia 3 contendo:

- `mapCode`
- `worldSeed`
- `size`
- `profile`
- `terrain`
- `biomes`
- `scatter`
- `edgeBarrier`
- `zones`
- `specialPoints`
- `assetFamilies`

Implementacao inicial ja iniciada em:

- `server/config/mapProceduralProfiles.js`
- `server/service/worldService/bootstrap.js`
- `client/src/world/scene/GameCanvas/sceneRuntime/procedural.js`
- `client/src/world/scene/GameCanvas/sceneRuntime/setup.js`
- `client/src/world/scene/GameCanvas/sceneRuntime/useSceneRuntime.js`

### Etapa 2 - Separar o que e visual e o que e logico

Formalizar a separacao:

- o cliente gera e renderiza a camada estatica
- o servidor guarda apenas o estado alterado ou dinamico

### Etapa 3 - Implementar geracao deterministica por chunk

Cada chunk deve nascer a partir de:

- seed global
- seed derivada do chunk
- regras de terreno
- regras de bioma
- regras de scatter
- regras de borda

### Etapa 4 - Implementar o terreno procedural

O terreno deve ser gerado no cliente a partir do perfil da instancia 3.

O servidor nao precisa enviar floresta ou relevo decorativo completo.

### Etapa 5 - Implementar a borda procedural obrigatoria

A borda deve combinar:

- deformacao geometrica
- reforco visual com assets bloqueadores
- bloqueio logico autoritativo

### Etapa 6 - Implementar os overrides persistentes

Salvar apenas diferencas em relacao ao mundo base:

- recurso removido
- objeto cortado
- rocha destruida
- trigger ativado
- estrutura alterada

### Etapa 7 - Integrar o servidor ao pacote minimo de chunk

O servidor deve mandar para o cliente apenas:

- chunk atual
- versionamento
- seed
- biome
- entidades dinamicas
- overrides
- pontos especiais

O bootstrap da instancia 3 ja passa a expor o contrato procedural em `snapshot.proceduralMap`, mas o client ainda continua no modo atual ate a proxima etapa.

### Etapa 8 - Primeiro mapa jogavel

Validar a instancia 3 com:

- terreno procedural visivel
- borda fechada
- decoracao local gerada por seed
- players e entidades dinamicas replicados normalmente
- recursos autoritativos funcionando

---

## Regras De Projeto

1. O mapa de desenvolvimento nao deve ser quebrado.
2. A instancia 3 e o primeiro mapa real do novo sistema.
3. O cliente monta a parte estavel e visual.
4. O servidor controla o estado de gameplay.
5. Decoracao estatica repetitiva nao deve ser persistida individualmente.
6. O banco deve guardar seed, perfil, overrides e entidades relevantes.

---

## Resultado Esperado

Ao final da implantacao, a instancia 3 deve funcionar assim:

- o mapa nasce a partir do contrato procedural
- o cliente reconstrui o visual por seed e regras
- o servidor replica apenas o que muda de verdade
- o mundo fica grande sem depender de milhares de registros decorativos
- o sistema fica preparado para novos mapas no futuro

---

## Documentos Relacionados

- [modulo-mapas-procedurais.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-mapas-procedurais.md)
- [mapa-procedural-schema.md](/D:/JS-Projects/Youtube/MD/implementacoes/mapa-procedural-schema.md)
- [mapa-procedural-asset-families.md](/D:/JS-Projects/Youtube/MD/implementacoes/mapa-procedural-asset-families.md)
