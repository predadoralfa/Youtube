# Catalogo De Familias De Assets Para Mapas Procedurais

## Objetivo

Este documento define familias de assets por contexto ambiental.
O gerador procedural nao deve escolher props no escuro.
Ele deve consultar familias autorizadas pelo perfil do mapa.

---

## Principio

Cada familia ambiental define:

- quais assets podem ser usados
- que papel cada asset cumpre
- limites de altura e inclinacao
- densidade sugerida
- restricoes de borda e de bioma

---

## Estrutura Conceitual

Uma familia de assets pode ser descrita por:

- `familyCode`
- `name`
- `description`
- `allowedAssetCodes`
- `spawnRoles`
- `minHeight`
- `maxHeight`
- `maxSlope`
- `density`
- `edgeWeight`
- `biomeTags`

---

## Familias Basicas Sugeridas

### temperate_forest

Uso:

- arvores temperadas
- pedras musgosas
- arbustos humidos
- folhas
- troncos caidos
- cogumelos
- pequenas ruinas

### volcanic

Uso:

- rochas vulcanicas
- solo escurecido
- cinza
- pedras negras
- fissuras
- colunas de basalto
- vegetacao seca

### coast_tropical

Uso:

- areia
- coqueiros
- pedras costeiras
- grama baixa
- agua rasa
- falerias litoraneas
- conchas

### cold_mountain

Uso:

- rocha fria
- neve
- gelo
- arvores frias
- arbustos resistentes
- falerias altas

### swamp

Uso:

- lama
- vegetacao baixa
- arvores tortas
- agua parada
- troncos apodrecidos
- moitas densas

### prairie

Uso:

- grama baixa
- vegetacao dispersa
- pedras pequenas
- flores
- caminhos abertos

---

## Regras De Espalhamento

O scatter deve respeitar:

- distancia minima entre assets grandes
- exclusao de rotas criticas
- exclusao de areas reservadas
- exclusao de borda intransponivel
- limite de inclinacao
- limite de altitude

---

## Regras De Uso

- o mapa declara explicitamente as familias permitidas
- o gerador escolhe apenas dentro dessas familias
- uma familia pode ser usada por varias regioes
- uma regiao pode combinar mais de uma familia, se o mapa permitir
- o Codex nao deve inferir assets fora do catalogo

---

## Relacao Com O Schema

O schema do mapa aponta para uma ou mais familias.

Exemplo conceitual:

- perfil `temperate_forest`
- familias permitidas `temperate_forest`, `prairie`, `cold_mountain`

Isso evita que o sistema misture assets incoerentes por acidente.

---

## Arquivos Relacionados

- [modulo-mapas-procedurais.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-mapas-procedurais.md)
- [mapa-procedural-schema.md](/D:/JS-Projects/Youtube/MD/implementacoes/mapa-procedural-schema.md)

