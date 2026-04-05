# Implementacao do Sistema de Fome

## Objetivo

Implantar o consumo automatico da barra de fome como um sistema base de sobrevivencia.

A fome:

- comeca cheia em `100`
- zera em `1 dia do jogo`
- `1 dia do jogo` equivale a `8 horas do mundo real`
- influencia a regeneracao de HP e stamina
- sera recuperada instantaneamente por itens consumiveis no futuro

## Regras Fechadas

- A barra de fome inicial do jogador e `100 / 100`
- O consumo acontece com base em tempo real decorrido no servidor
- O relogio do mundo entra apenas como fator de conversao de balanceamento
- A fome nao sera consumida por tick de movimento
- A fome nao sera regenerada ao longo do tempo por itens
- A fome continua valendo tambem no retorno do jogador ao jogo, usando o tempo real decorrido
- Cada item de comida tera um valor proprio de recuperacao no futuro
- O jogador gerencia a barra livremente, sem obrigacao de refeicoes fixas

## Formula Base

Configuracao atual:

- `hunger_max = 100`
- `1 dia do jogo = 24 horas do jogo`
- `time_factor = 3`
- `1 dia do jogo = 8 horas reais = 480 minutos reais`

Consumo base:

- `100 / 480 = 0.2083333333` de fome por minuto real

Formula geral:

`hungerDrain = (hungerMax / minutosParaZerarNoTempoDeJogo) * timeFactor * minutosReaisDecorridos`

Como `minutosParaZerarNoTempoDeJogo = 1440`, tambem pode ser expresso como:

`hungerDrain = hungerMax * (timeFactor / 1440) * minutosReaisDecorridos`

## Decisoes Tecnicas

- Persistir fome com fracao
- Alterar colunas de fome no banco para tipo numerico fracionario
- Ajustar model para aceitar valor fracionario
- Criar um tick proprio de fome no servidor
- Rodar o consumo em loop global e nao no input WASD
- Atualizar runtime, vitals e persistencia usando a mesma trilha ja existente

## Estrategia de Implementacao

### 1. Modelagem

- Alterar `hunger_current` e `hunger_max` para tipo fracionario
- Manter valor default em `100`

### 2. Runtime

- Adicionar timestamp dedicado para fome no runtime
- Calcular tempo decorrido com seguranca
- Consumir fome com base no `time_factor` do relogio do mundo

### 3. Loop Global

- Aplicar o consumo no loop periodico do servidor
- Marcar stats como dirty quando a fome mudar
- Reaproveitar emissao de `move:state` para refletir a barra no cliente

### 4. Integracao com Regen

- Manter a regra atual em que a fome afeta o multiplicador de regeneracao
- A mudanca desta entrega e apenas garantir que a fome realmente caia com o tempo

## Fora do Escopo Desta Etapa

- tabela filha de itens alimenticios
- valores de recuperacao por alimento
- saturacao por qualidade do cozinheiro
- profissao de agricultura
- economia de producao de comida
- crafts, eras futuras e progressao alimentar

## Resultado Esperado

Ao final desta implementacao:

- todo jogador perde fome continuamente ao longo de `8 horas reais`
- a barra passa a refletir o metabolismo basico do personagem
- o sistema de regen passa a ter efeito pratico no jogo
- o projeto fica pronto para receber itens de comida depois
