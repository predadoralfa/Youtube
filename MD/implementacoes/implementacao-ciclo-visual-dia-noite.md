# Implementacao do Ciclo Visual de Dia e Noite

## Objetivo

Implementar no front um ciclo visual de claridade e escuridao baseado no `worldClock` enviado pelo servidor.

O servidor continua sendo a fonte da verdade para:

- hora atual do mundo
- fator de tempo
- calendario
- sincronizacao inicial do relogio

O cliente fica responsavel apenas por:

- interpretar a hora atual
- converter essa hora em estado visual
- interpolar luz, ceu e atmosfera de forma progressiva

## Regra Fechada Desta Etapa

Nesta primeira versao, a regra sera aplicada literalmente assim:

- entre `05:00` e `18:30` a cena permanece clara
- entre `18:30` e `20:00` a cena escurece progressivamente
- entre `20:00` e `04:00` a cena permanece escura
- entre `04:00` e `05:00` a cena clareia progressivamente

Observacao:

- esta regra ja possui amanhecer e entardecer progressivos
- fase da lua e estacao do ano continuam fora do escopo

## Escopo Tecnico

- implementacao somente no front
- nenhuma logica de gameplay sera movida para o cliente
- nenhuma decisao autoritativa saira do servidor

## Parametros Visuais a Controlar

- cor do fundo da cena
- neblina da cena
- intensidade e cor da luz hemisferica
- intensidade e cor da luz direcional
- exposicao do renderer

## Estrategia

### 1. Ler o relogio do mundo no cliente

- reutilizar o `worldClock` ja existente
- reutilizar o hook `useWorldClock`
- obter um valor continuo de hora com `hour + minute / 60`

### 2. Converter hora em fator visual

- criar um fator normalizado de `0` a `1`
- `0` representa estado totalmente claro
- `1` representa estado totalmente escuro
- usar interpolacao gradual nas janelas de amanhecer e entardecer

## Formula

- se `04:00 <= hora < 05:00`, fator vai de `1` para `0`
- se `05:00 <= hora < 18:30`, fator = `0`
- se `18:30 <= hora < 20:00`, fator vai de `0` para `1`
- se `20:00 <= hora` ou `hora < 04:00`, fator = `1`

## Aplicacao Visual

Usar interpolacao para:

- fundo do ceu: claro -> escuro
- neblina: clara -> escura
- luz hemisferica: forte -> fraca
- luz direcional: forte -> fraca
- exposicao: alta -> baixa

## Organizacao de Codigo

- criar modulo proprio para o ciclo visual
- manter `setupLight` apenas como criacao de luzes
- adicionar funcao de aplicacao do ciclo visual no render loop

## Resultado Esperado

Ao final desta etapa:

- a cena reage visualmente ao relogio do servidor
- a logica de dia, anoitecer, noite e amanhecer respeita exatamente as faixas configuradas
- o servidor continua autoritativo
- a base fica pronta para um ciclo solar completo mais tarde
