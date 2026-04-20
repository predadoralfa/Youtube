# Review - Padronizacao de Research de Itens

## Objetivo

Padronizar a progressao de research para itens, evitando que cada item siga uma logica propria sem criterio de nivel.

---

## Regra Base Confirmada

### Nivel 1

O nivel 1 continua sendo o nivel de interesse do item.

Efeitos esperados:

- o item vira um item de interesse
- o jogador passa a poder coletar o item
- o sistema de research fica habilitado como porta de entrada do assunto

Este comportamento e o padrao correto e deve permanecer para todos os itens novos.

---

## Padrao Proposto Para Novos Itens

### Nivel 1 - Interesse e Coleta

Libera:

- `actor.collect:<ITEM>`

Objetivo:

- tornar o item relevante
- permitir coleta
- nao misturar ainda bonus de conveniencia ou liberacoes de uso mais profundas

### Nivel 2 - Bonus Passivo

Libera um bonus simples e continuo.

Exemplos:

- reducao de peso
- reducao de tempo de coleta
- melhoria leve de empilhamento
- outro bonus passivo equivalente

Objetivo:

- dar evolucao perceptivel sem abrir uma nova capacidade complexa

### Nivel 3 - Capacidade Nova

Libera uma nova habilidade, craft, uso ou ramificacao de pesquisa.

Exemplos:

- novo craft
- novo consumo
- nova tecnologia
- nova research filha

Objetivo:

- ser o primeiro grande salto funcional do item

### Nivel 4 - Refinamento

Libera refinamento ou otimização da capacidade aberta no nivel 3.

Exemplos:

- redução adicional de tempo
- custo menor
- melhoria de rendimento

### Nivel 5 - Maestria

Fecha a arvore do item com o melhor refinamento possivel dentro da era atual.

Objetivo:

- consolidar o item sem criar nova arvore infinita

---

## Situacao Atual

O sistema legado foi reorganizado para seguir o mesmo contrato de nivel.

### Pontos ja coerentes e agora padronizados

- `RESEARCH_APPLE` nivel 1 ancora coleta de `APPLE_TREE`
- `RESEARCH_STONE` nivel 1 ancora coleta de `ROCK_NODE_SMALL`
- `RESEARCH_TWIG` nivel 1 ancora coleta de `TWIG`
- `RESEARCH_PRIMITIVE_SHELTER` nivel 1 ancora a construcao da estrutura
- `RESEARCH_BASKET` agora segue o mesmo contrato, mesmo sendo uma arvore de tecnologia
- `RESEARCH_FIBER` segue o mesmo contrato
- `RESEARCH_HERBS` segue o mesmo contrato

### Pontos que merecem cuidado de design

- `BASKET` e uma arvore mais tecnologica do que de coleta bruta
- isso nao quebra o padrao, mas pede que o time use o mesmo contrato de nivel com semantica de tecnologia em vez de coleta

---

## Leitura Por Item

### Apples

- nivel 1 fica dedicado a coleta
- nivel 2 fica dedicado a bonus de peso
- nivel 3 fica como primeira liberacao funcional do item

### Stones

- nivel 1 libera coleta, o que esta correto
- nivel 2 reduz peso, o que bate com o padrao proposto
- nivel 3 libera uma capacidade nova, o que tambem bate

### Twigs

- nivel 1 libera coleta, correto
- nivel 2 reduz peso, correto como bonus passivo
- nivel 3 abre a construcao do abrigo primitivo, o que esta no lugar certo

### Basket

- a arvore segue o mesmo contrato
- nivel 1 abre o craft base
- nivel 2 reduz peso
- nivel 3 abre a cesta reforcada

### Herbs

- segue o mesmo padrao e ja vira insumo medico no nivel 3

---

## Recomendacao

Antes de criar mais itens novos, devemos:

1. manter nivel 1 como coleta
2. reservar nivel 2 para bonus passivo
3. reservar nivel 3 para nova capacidade ou craft
4. revisar os itens existentes que fugirem desse desenho
5. aplicar esse padrao como contrato de design para qualquer research futura

### Regra de Escalabilidade

Para tecnologias novas, o caminho preferido passa a ser o inverso da arvore antiga:

- o card novo nasce com os requisitos de aparicao
- a pesquisa pai nao precisa prever tudo que vai ser desbloqueado no futuro
- a tecnologia filha carrega a dependencia das pesquisas que precisam estar concluídas
- isso facilita crescer o jogo sem precisar reescrever pesquisas antigas toda vez

Em outras palavras:

1. primeiro definimos o que a nova tecnologia precisa para aparecer
2. depois registramos a pesquisa filha
3. por fim ligamos a liberacao no nivel correto da filha

Esse modelo e o que deve ser usado daqui para frente quando uma capacidade ainda nao existe no jogo.

---

## Proxima Acao Sugerida

Depois deste review, o passo mais seguro e:

1. atualizar o documento mestre de research com este padrao
2. revisar `RESEARCH_APPLE`, `RESEARCH_STONE`, `RESEARCH_TWIG`, `RESEARCH_BASKET` e a futura `HERBS`
3. decidir quais researches antigos precisam de migration de ajuste e quais podem ficar como excecao documentada
