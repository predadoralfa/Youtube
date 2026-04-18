# Modulo Mapas Procedurais

## Objetivo

Este documento e o contrato mestre para geracao procedural de mapas no MMO.
Ele define a filosofia, as camadas do sistema, a separacao entre cliente e servidor, o uso de seeds, a estrutura por chunk, as regras de borda e o papel dos overrides persistentes.

O objetivo e permitir que novos mapas sejam criados por configuracao e regras, e nao por montagem artesanal asset por asset.

---

## Principios

- o mapa e reproduzivel por seed
- o mapa e descrito por perfil e configuracao, nao por edicao manual de cada item
- o cliente monta visual e decoracao leve
- o servidor decide movimento valido, spawn, bloqueio e persistencia
- decoracao estatica comum nao deve ser persistida individualmente
- o banco deve guardar apenas o que foge da base procedural
- todo mapa deve poder ser reconstruido a partir de regras e parametros

---

## Decisao de Arquitetura

O sistema deve trabalhar com duas camadas complementares:

### 1. Documento mestre

Contrato conceitual e estrutural do sistema.
Define:

- filosofia do sistema
- responsabilidades do cliente e do servidor
- formato de seed
- chunking
- bordas
- biomas
- scattering
- overrides

### 2. Configuracao por mapa

Arquivo pequeno e declarativo com os parametros daquele mapa.
Define:

- tipo do mapa
- seed
- tamanho
- perfil ambiental
- familias de assets permitidas
- borda
- zonas reservadas
- densidades

---

## Estrutura Conceitual Obrigatoria

### World Profile

Perfil macro do mapa.

Define:

- tema geral
- clima
- intensidade de relevo
- familia visual dominante
- regras de borda
- biomas permitidos

Exemplos:

- floresta temperada
- vulcanico
- litoral tropical
- montanha gelada
- pantano
- savana
- pradaria

### Terrain Rules

Regras do terreno.

Define:

- amplitude de altura
- suavidade ou rugosidade
- planicies
- morros
- montanhas
- vales
- encostas
- areas alagadas
- praias
- falerias

### Biome Rules

Regras de distribuicao dos biomas.

Define:

- onde ha floresta
- onde ha rocha exposta
- onde ha areia
- onde ha lama
- onde ha vegetacao densa
- onde ha vegetacao baixa
- onde ha neve
- onde ha solo seco

### Scatter Rules

Regras de espalhamento procedural.

Define:

- quais assets podem aparecer
- densidade
- agrupamento
- distancia minima entre objetos
- inclinacao maxima
- mascara de exclusao
- distancia minima de agua, trilha, estrada e POI

### Edge Barrier Rules

Regras de contenção de borda.

Define:

- como fechar o mapa
- se a borda e paredao, montanha, mar, penhasco, lava, floresta densa ou outro bloqueio
- que assets reforcam o bloqueio
- qual faixa e intransponivel

### Gameplay Zones

Zonas com finalidade sistmica.

Define:

- area inicial segura
- zonas de progressao
- regioes perigosas
- areas de respawn
- corredores naturais
- pontos de interesse
- zonas futuras reservadas

### Server-Relevant Layer

Camada logica importante para o servidor.

Define:

- bloqueios autoritativos
- areas validas de movimento
- obstaculos de navegacao
- areas de spawn
- pontos interativos
- recursos persistentes
- entidades replicadas

---

## Separacao Entre Cliente E Servidor

### Cliente

Responsavel por montar localmente:

- terreno visual
- decoracao estatica leve
- arvores decorativas
- pedras decorativas
- arbustos
- vegetacao
- props visuais repetitivos
- LOD
- instancing
- variacoes cosmeticas baseadas em seed

### Servidor

Responsavel por controlar:

- players
- NPCs
- inimigos
- recursos coletaveis
- drops
- containers
- triggers
- obstaculos relevantes
- zonas invalidas de movimento
- estado persistente
- overrides do mundo procedural

### Regra Obrigatoria

- objetos decorativos estaticos nao devem ser persistidos individualmente

---

## Modelo De Carga De Chunk

A parte estatica do mapa deve ser reconstruida no cliente.
O servidor nao deve ficar enviando floresta completa, pedra decorativa completa ou lista total de props fixos a cada ciclo.

### Cliente

O cliente recebe e usa:

- `worldSeed`
- `chunkSeed`
- `chunkId`
- `map profile`
- `biome`
- `scatter preset`
- `terrain rules`
- `version`

Com isso, ele reconstrui:

- terreno visual
- vegetacao estatica
- rochas decorativas
- arbustos
- ruinas decorativas
- props repetitivos

### Servidor

O servidor envia apenas o que muda ou importa para a simulacao:

- players
- NPCs
- inimigos
- recursos coletaveis
- objetos interativos
- containers
- drops
- portas
- triggers
- construcoes alteraveis
- obstaculos relevantes para gameplay
- overrides do estado base

### Regra De Dados

Se o objeto nao muda e nao interfere na simulacao, ele nao deve ser sincronizado em tempo real pelo servidor.

### Excecao

Se uma arvore, rocha ou prop estatico for alteravel, destrutivel, cortavel, coletavel ou persistente, ele sai da categoria de decoracao pura e passa a ser tratado como estado do mundo.

---

## Pacote Minimo Do Chunk No Servidor

Quando um jogador entra numa regiao, o servidor pode mandar apenas:

- `chunkId`
- `version`
- `worldSeed`
- `biome`
- lista de entidades dinamicas
- lista de objetos removidos
- lista de objetos modificados
- lista de pontos especiais
- lista de overrides

Exemplo conceitual:

```json
{
  "chunkId": "12_8",
  "version": 3,
  "worldSeed": 948211,
  "biome": "temperate_forest",
  "dynamicEntities": [],
  "removedStaticObjects": [891, 1042, 2001],
  "modifiedStaticObjects": [
    {
      "objectKey": "tree_891",
      "state": "cut"
    }
  ],
  "overrides": []
}
```

---

## Sistema De Seed

Todo mapa deve possuir:

- `worldSeed`: seed global do mapa
- `chunkSeed`: seed derivada por chunk
- `layerSeeds`: seeds derivadas por camada, se necessario

Possiveis camadas:

- relevo
- bioma
- vegetacao
- rochas
- detalhes cosmeticos

Objetivos:

- reproducibilidade
- consistencia entre clientes
- geracao deterministica
- reducao de payload
- debug facil

---

## Estrutura Por Chunk

O mapa deve ser dividido em chunks.

Cada chunk deve poder ser reconstruido a partir de:

- coordenadas do chunk
- seed global
- perfil do mapa
- regras de bioma local
- regras de scattering
- regras de borda
- lista de overrides

O chunk nao deve depender de cadastro individual de cada elemento decorativo.

---

## Borda Do Mapa

Toda borda deve ser tratada como sistema procedural obrigatorio.

### Camada A - Geometria

O relevo deve dificultar ou impedir a travessia:

- paredoes
- cliffs
- montanhas
- falerias
- mar profundo
- crateras
- lava
- floresta fechada com relevo impeditivo

### Camada B - Reforco Visual

Aplicar scattering de bloqueio:

- rochas grandes
- troncos gigantes
- vegetacao fechada
- entulho
- paredoes visuais
- pilares naturais
- ruinas bloqueadoras

### Camada C - Bloqueio Logico

O servidor deve tratar a faixa como area invalida:

- sem navegacao
- sem spawn
- sem travessia
- movimento rejeitado ao ultrapassar limite logico

### Regra Obrigatoria

- nunca depender apenas do visual para segurar o jogador dentro do mapa

---

## Assets Por Contexto

O sistema nao pode depender do Codex adivinhar quais assets combinam com cada tipo de mapa.

Cada mapa deve declarar explicitamente quais familias de assets pode usar.

Exemplos de familias:

- `temperate_forest`
- `volcanic`
- `coast_tropical`
- `cold_mountain`
- `swamp`
- `prairie`

Cada familia define:

- lista autorizada de assets
- pesos de spawn
- restricoes de altura
- restricoes de inclinacao
- mascara de exclusao

---

## Mascaras De Distribuicao

O sistema deve usar mascaras ou regras equivalentes para decidir onde cada grupo de asset pode aparecer.

Exemplos de criterios:

- altura minima e maxima
- inclinacao maxima
- distancia minima de agua
- distancia minima de trilha
- distancia minima de borda
- densidade por bioma
- exclusao de areas reservadas
- exclusao de area inicial
- exclusao de POIs
- exclusao de passagem critica

---

## Pontos De Interesse

O sistema procedural pode sugerir pontos de interesse, mas eles devem respeitar regras.

Exemplos:

- clareiras
- ruinas
- altares
- cavernas
- acampamentos
- entradas de dungeon
- lagos
- formacoes raras
- praias especiais
- crateras
- arvores gigantes

### Regra

POIs devem surgir:

- em locais coerentes
- com espaco minimo livre
- sem bloquear rotas essenciais
- sem colidir com bordas
- sem quebrar area inicial

---

## Persistencia E Overrides

O mundo procedural e a base.
O banco deve guardar apenas o que foge da base.

### Persistir Diretamente

- NPC
- enemy spawn
- chest
- portal
- trigger
- node coletavel
- objetos unicos
- estruturas interativas
- elementos de quest
- conteudo autoral manual

### Persistir Como Override

- arvore procedural removida
- recurso esgotado
- rocha alterada
- objeto bloqueado ou liberado
- variacao aplicada sobre objeto procedural existente

### Nao Persistir

- floresta decorativa comum
- pedras decorativas comuns
- arbustos comuns
- vegetacao cosmetica comum

---

## Tecnologia Sugerida

O trecho que voce trouxe nao aponta uma unica biblioteca magica.
Ele sugere um conjunto de pecas e rotas tecnicas:

### Base recomendada para o projeto atual

- `Three.js`
- `simplex-noise`
- `THREE.LOD`
- `InstancedMesh`

Uso esperado:

- `simplex-noise` para relevo, umidade, temperatura e mascaras
- `THREE.LOD` para ativos maiores em distancia
- `InstancedMesh` para arvore, pedra, arbusto e props repetitivos

### Apenas para prototipo rapido

- `THREE.Terrain`

Uso esperado:

- validar terreno procedural
- testar heightmap e pipeline inicial
- nao tratar como base final de MMO gigante

### Alternativa que exigiria trocar renderer

- `Babylon.js`
- `Dynamic Terrain`

Uso esperado:

- aceleracao de prova de conceito visual
- nao elimina chunking, biomas, colisao ou autoridade do servidor

### Ferramentas externas para macro relevo

- `Houdini HeightFields`
- `Gaea`
- `World Machine`
- `World Creator`

Uso esperado:

- gerar macro terreno, rios, biomas e massa continental
- exportar dados para o runtime do jogo

---

## Pipeline Recomendado

1. definir o documento mestre
2. definir o schema de configuracao
3. implementar gerador de chunk
4. implementar borda procedural
5. implementar catalogos de assets por familia
6. implementar overrides
7. implementar mapas especificos

---

## Regras Para O Codex

Sempre que for implementar qualquer parte ligada a mapa procedural, o Codex deve obedecer:

1. nao montar mapa manual asset por asset
2. nao persistir decoracao estatica individualmente
3. tratar o mapa como reproduzivel por seed e regras
4. separar camada visual e camada logica
5. gerar bordas intransponiveis por regra
6. exigir catalogo explicito de assets por familia ambiental
7. trabalhar por chunks
8. permitir overrides persistentes apenas para diferencas do estado base
9. preservar coerencia entre cliente e servidor
10. facilitar criacao futura de novos mapas a partir de configuracao

---

## Arquivos Relacionados

- [mapa-procedural-schema.md](/D:/JS-Projects/Youtube/MD/implementacoes/mapa-procedural-schema.md)
- [mapa-procedural-asset-families.md](/D:/JS-Projects/Youtube/MD/implementacoes/mapa-procedural-asset-families.md)
