# Schema De Configuracao De Mapas Procedurais

## Objetivo

Este arquivo define como um mapa deve ser descrito no banco ou em um arquivo declarativo.
Ele nao gera o mapa sozinho. Ele serve para declarar os parametros que o gerador procedural vai usar.

---

## Principio

Cada mapa deve ser configuravel por dados.

O Codex deve conseguir criar um novo mapa a partir de um conjunto pequeno de parametros, sem precisar codificar a forma final asset por asset.

---

## Estrutura Minima Do Mapa

Um mapa deve declarar pelo menos:

- identificador
- nome
- seed global
- largura
- comprimento
- perfil ambiental
- regra de borda
- familias de assets habilitadas
- parametros de relevo
- parametros de bioma
- parametros de scatter
- zonas reservadas
- pontos especiais obrigatorios

Tambem e util separar o schema em tres blocos de dados:

- `static world data`
- `dynamic replicated entities`
- `world state overrides`

---

## Estrutura Conceitual Sugerida

```json
{
  "mapCode": "MONTIVALES_TUTORIAL",
  "name": "Montivalles",
  "worldSeed": 123456789,
  "size": {
    "x": 10000,
    "z": 100000
  },
  "profile": {
    "code": "temperate_forest",
    "theme": "tutorial_forest",
    "climate": "mild",
    "dominantVisualFamily": "temperate_forest",
    "allowedBiomeFamilies": ["forest", "grassland", "rocky"],
    "edgeBarrier": "cliff_and_forest_wall"
  },
  "terrain": {
    "heightAmplitude": 15,
    "roughness": 0.35,
    "plateauRatio": 0.25,
    "slopeLimit": 0.7,
    "valleyDepth": 0.2
  },
  "biomes": [
    {
      "code": "tutorial_start",
      "area": "start_zone",
      "weight": 1
    },
    {
      "code": "forest",
      "weight": 3
    }
  ],
  "scatter": {
    "treeDensity": 0.7,
    "rockDensity": 0.35,
    "grassDensity": 0.9,
    "minDistanceBetweenLargeAssets": 12,
    "maxSlope": 0.5,
    "minDistanceFromEdge": 24
  },
  "zones": {
    "safeStart": {
      "enabled": true,
      "radius": 35
    },
    "reserved": [
      {
        "code": "starter_path",
        "shape": "corridor",
        "priority": 10
      }
    ]
  },
  "specialPoints": [
    {
      "code": "apple_tree_01",
      "kind": "resource_node",
      "placementRule": "near_start_path"
    }
  ]
}
```

---

## Blocos Do Schema

### mapCode

Identificador tecnico estavel.

### worldSeed

Seed raiz do mapa.

Deve permitir:

- reproducao deterministica
- debug
- sincronizacao entre cliente e servidor

### size

Dimensoes do setor.

### profile

Define o tipo macro do mapa.

### terrain

Define a forma basica do relevo.

### biomes

Define como os biomas se distribuem no mapa.

### scatter

Define densidade, agrupamento e exclusoes de assets repetitivos.

### zones

Define areas de jogo e areas reservadas.

### specialPoints

Define pontos de interesse obrigatorios ou sugeridos.

### static world data

Define o que o cliente pode reconstruir sozinho a partir de seed e regras:

- terreno visual
- vegetacao estatica
- rochas decorativas
- props repetitivos

### dynamic replicated entities

Define o que o servidor precisa replicar em tempo real:

- players
- NPCs
- inimigos
- recursos coletaveis
- containers
- triggers

### world state overrides

Define as diferencas em relacao ao estado procedural base:

- objeto removido
- recurso esgotado
- estrutura alterada
- prop modificado
- entidade especial adicionada

---

## Regras Para Configuracao

- o schema deve ser declarativo
- o schema nao deve depender de montagem manual de dezenas de props
- o schema deve separar perfil, relevo, bioma, scatter e zonas
- o schema deve permitir defaults e overrides
- o schema deve ser facil de serializar em JSON, YAML ou tabela relacional
- o schema deve deixar claro o que e estatica local, o que e dinamico replicado e o que e override persistente

---

## Ordem De Leitura

1. ler o modulo mestre
2. ler este schema
3. ler o catalogo de familias de assets
4. implementar o gerador

---

## Arquivos Relacionados

- [modulo-mapas-procedurais.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-mapas-procedurais.md)
- [mapa-procedural-asset-families.md](/D:/JS-Projects/Youtube/MD/implementacoes/mapa-procedural-asset-families.md)
