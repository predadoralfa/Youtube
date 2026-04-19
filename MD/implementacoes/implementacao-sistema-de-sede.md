# Implementacao do Sistema de Sede

## Objetivo

Implantar o consumo automatico da barra de sede como um sistema base de sobrevivencia.

A sede:

- comeca cheia em `100`
- zera em `4 horas do mundo`
- `4 horas do mundo` equivalem a `1h20` reais quando `time_factor = 3`
- completa `6 ciclos` por dia do jogo
- influencia a regeneracao de HP e stamina
- sera recuperada instantaneamente por itens consumiveis no futuro

## Regras Fechadas

- A barra de sede inicial do jogador e `100 / 100`
- O consumo acontece com base em tempo real decorrido no servidor
- O relogio do mundo entra como fator de conversao de balanceamento
- A sede nao sera consumida por tick de movimento
- A sede nao sera regenerada ao longo do tempo por itens
- A sede continua valendo tambem no retorno do jogador ao jogo, usando o tempo real decorrido
- Cada item de bebida tera um valor proprio de recuperacao no futuro
- O jogador gerencia a barra livremente, sem obrigacao de consumo fixo

## Formula Base

Configuracao atual:

- `thirst_max = 100`
- `time_factor = 3`
- `thirst_world_hours_to_empty = 4`
- `1 barra cheia = 4 horas do mundo = 80 minutos reais`

Consumo base:

- `100 / 80 = 1.25` de sede por minuto real
- `100 / 240 = 0.4166666667` de sede por minuto do mundo

Formula geral:

`thirstDrain = thirstMax * (timeFactor / (thirstWorldHoursToEmpty * 60 * 60)) * segundosReaisDecorridos`

Ou, de forma equivalente:

`thirstDrain = thirstMax * (timeFactor / 240) * minutosReaisDecorridos`

## Decisoes Tecnicas

- Persistir sede com fracao
- Alterar colunas de sede no banco para tipo numerico fracionario
- Ajustar model para aceitar valor fracionario
- Criar um tick proprio de sede no servidor
- Rodar o consumo em loop global e nao no input WASD
- Atualizar runtime, vitals e persistencia usando a mesma trilha ja existente

## Estrategia de Implementacao

### 1. Modelagem

- Alterar `thirst_current` e `thirst_max` para tipo fracionario
- Manter valor default em `100`

### 2. Runtime

- Adicionar timestamp dedicado para sede no runtime
- Calcular tempo decorrido com seguranca
- Consumir sede com base no `time_factor` do relogio do mundo

### 3. Loop Global

- Aplicar o consumo no loop periodico do servidor
- Marcar stats como dirty quando a sede mudar
- Reaproveitar emissao de `move:state` para refletir a barra no cliente

### 4. Integracao com Regen

- Manter a regra atual em que a sede afeta o multiplicador de regeneracao
- A mudanca desta entrega e garantir que a sede realmente caia com o tempo

## Fora do Escopo Desta Etapa

- tabela filha de itens de bebida
- valores de recuperacao por bebida
- saturacao por qualidade do preparo
- profissao de producao de bebidas
- economia de producao de agua
- crafts, eras futuras e progressao de hidratacao

## Resultado Esperado

Ao final desta implementacao:

- todo jogador perde sede continuamente ao longo de `4 horas do mundo`
- a barra zera aproximadamente a cada `1h20` reais com o clock atual
- a barra passa a refletir o metabolismo basico do personagem
- o sistema de regen passa a ter efeito pratico no jogo
- o projeto fica pronto para receber itens de bebida depois
