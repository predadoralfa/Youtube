# Guia de Registro de Documentacao

## Objetivo

Este guia explica como a documentacao do projeto deve ser organizada e como registrar um novo arquivo MD no mesmo padrao dos guias de cadastro ja existentes.

A ideia e simples:

- `document.md` e o ponto de entrada
- `struct.md` e o resumo estrutural rapido
- `MD/seeds` guarda guias operacionais de cadastro e contratos estaveis
- `MD/implementacoes` guarda estudos arquiteturais e planos tecnicos
- quando o tema for mapas procedurais, o trio oficial fica em `MD/implementacoes`: modulo mestre, schema e catalogo de assets

## Como pensar a pasta MD

### 1. `document.md`

E o documento mestre.

Use quando precisar responder:

- como o projeto esta organizado
- onde fica cada sistema importante
- quais documentos aprofundam cada tema

### 2. `struct.md`

E o resumo rapido.

Use quando quiser uma visao curta da arquitetura sem entrar em detalhe.

### 3. `MD/seeds`

Guarda guias de cadastro e definicoes estaveis.

Exemplos:

- itens
- actors
- containers
- spawners
- futura documentacao de cadastro de pesquisas, caso o fluxo precise de um guia operacional proprio

### 4. `MD/implementacoes`

Guarda estudos, planos e refatoracoes.

Exemplos:

- arquitetura de actors
- respawn por instancia
- fome
- ciclo visual
- regeneracao de recursos
- mapas procedurais

## Regra para criar um novo MD

Antes de criar um arquivo novo:

1. identificar se o assunto e cadastro, arquitetura ou implementacao
2. escolher a pasta correta
3. usar nome descritivo e sem acento
4. manter o mesmo estilo dos documentos vizinhos
5. atualizar `document.md` e `struct.md` se o novo MD for importante

## Modelo de arquivo recomendado

Todo MD novo deve seguir esta ordem:

1. titulo
2. objetivo
3. modelo mental
4. fluxo ou passos
5. checklist
6. observacoes de risco ou pendencias

Se o documento for de cadastro, inclua:

- quais tabelas sao fonte da verdade
- quais campos sao obrigatorios
- qual migration ou seed precisa ser consultada
- qual fluxo runtime usa esses dados

Se o documento for de implementacao, inclua:

- problema
- solucao
- ordem de implantacao
- riscos
- validacao

## Regra de manutencao

Quando um tema novo surgir:

- se for contrato de dados, criar ou atualizar um guia em `MD/seeds`
- se for refatoracao ou plano, criar ou atualizar em `MD/implementacoes`
- se for uma visao geral importante, atualizar `document.md`
- se for um resumo rapido, atualizar `struct.md`

## Resumo

Se a pergunta for "onde eu coloco um novo MD?", a resposta e:

- cadastro e contrato estavel -> `MD/seeds`
- arquitetura e plano tecnico -> `MD/implementacoes`
- panorama geral -> `document.md`
- resumo curto -> `struct.md`
