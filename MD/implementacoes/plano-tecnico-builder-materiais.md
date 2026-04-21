# Plano Tecnico - Builder Materials Inventory

## Estado Atual

O fluxo base do inventario de materiais da obra ja foi implantado no servidor e no cliente.

Hoje ele cobre:

- criacao do container `BUILD_MATERIALS` ao posicionar o shelter
- deposito parcial via inventario do jogador
- deposito parcial vindo das maos ou do equipamento, com validacao server-side
- deposito manual pelo card da construcao com quantidade digitada
- leitura do progresso `depositado / requerido` no card do shelter
- auto-start da obra quando o ultimo requisito fecha
- cancelamento com descarte dos materiais no mundo
- consumo dos materiais ao concluir a construcao

O foco restante fica em polimento visual e expansao para novas receitas maiores.

## Objetivo

Criar uma etapa de deposito de materiais para construcao antes do inicio real da obra.

O fluxo novo precisa permitir:

- criar um inventario proprio da construcao ao posicionar o projeto no chao
- depositar materiais de forma parcial
- persistir esse inventario no servidor
- retomar ou cancelar sem perder o controle dos itens
- devolver ou dropar materiais se a obra for cancelada

O primeiro caso de uso continua sendo o `Primitive Shelter`.

---

## Problema Que Essa Etapa Resolve

Antes desta etapa, o builder consumia os materiais direto das maos e ja iniciava a obra.

Isso limita:

- obras maiores
- deposito parcial
- cancelamento com retorno de materiais
- visualizacao clara do que ja foi entregue para a obra

O novo inventario de construcao cria uma fase intermediaria entre `PLANNED` e `RUNNING`.

---

## Modelo Desejado

### Fase 1: Projeto Posicionado

Quando o jogador coloca o shelter no chao:

- o actor do projeto nasce
- o projeto fica em `PLANNED`
- o servidor cria um inventario de materiais ligado a esse actor
- cada requisito ganha seu proprio slot de deposito

### Fase 2: Deposito De Materiais

O jogador pode transferir materiais aos poucos para a obra.

Regras:

- o deposito deve aceitar quantidades parciais
- o card da construcao precisa permitir informar a quantidade manualmente
- o deposito parte das pilhas que o jogador tiver nas maos ou no equipamento
- o card da construcao deve mostrar `depositado / requerido`
- a obra ainda nao comeca enquanto houver requisito faltando
- o cliente nao decide validacao final

### Fase 3: Inicio Da Construcao

Quando todos os requisitos estiverem completos:

- o servidor permite `Build` ou `Start`
- os materiais sao marcados como consumidos pela obra
- a construcao passa para `RUNNING`
- o progresso continua igual ao contrato atual

### Fase 4: Cancelamento / Desmanche

Se a obra for cancelada antes de completar:

- os materiais depositados devem voltar para o jogador, se houver espaco
- o excedente deve ser dropado ao redor da construcao, se necessario
- o inventario da obra deve ser limpo ou encerrado

---

## Estrutura De Dados Proposta

### Inventario Da Obra

Usar uma estrutura persistida no backend para a obra, ligada ao actor do shelter.

Opcoes de modelagem:

- `ga_container` com `slot_role = BUILD_MATERIALS`
- `ga_container_owner` com `owner_kind = ACTOR`
- `owner_id = actorId`

### Slots

Cada slot representa um requisito do projeto.

Exemplo:

- `GRAVETO x 1`
- `PEDRA x 50`
- `FIBRA x 10`

O slot precisa guardar:

- item esperado
- quantidade requerida
- quantidade ja depositada
- quantidade restante

### Estado Do Actor

O `state_json` do actor pode guardar apenas a referencia ao inventario da obra, se necessario.

Exemplos de campo:

- `constructionMaterialContainerId`
- `constructionMaterialState`
- `constructionMaterialUpdatedAt`

Preferencia:

- o estado de quantidade fica no container persistido
- o actor guarda so o que for necessario para localizar e reconstruir o estado

---

## Contrato De UI

O card do shelter precisa passar a mostrar:

- lista de requisitos com deposito parcial
- progresso do deposito
- botao para iniciar a obra quando tudo estiver pronto
- botao de pause / resume / cancel no proprio card do actor
- mensagem inline quando `Resume` falhar por distancia

O painel `Status` nao deve concentrar controles de builder.

---

## Fluxo De Servidor

### Ao Posicionar

1. o servidor cria o actor do shelter
2. o servidor cria o inventario de materiais da construcao
3. o servidor registra os slots conforme a receita
4. o estado inicial continua `PLANNED`

### Ao Depositar

1. o cliente informa a quantidade desejada no card
2. o servidor valida o item e a quantidade
3. o servidor move o item das maos do jogador ou do equipamento para a obra
4. o servidor atualiza o slot de deposito
5. o servidor replica o novo estado

### Ao Iniciar

1. o servidor confere se todos os slots estao completos
2. o servidor consome ou trava os materiais como parte da obra
3. o servidor muda para `RUNNING`
4. o tick passa a acompanhar o progresso

### Ao Cancelar

1. o servidor tenta devolver os materiais
2. o que nao couber no inventario do jogador e dropado
3. o actor e o inventario da obra sao encerrados

---

## Regras De Cancelamento

Cancelar obra nao pode virar perda silenciosa.

Regras:

- todo material depositado deve ter destino claro
- se existir espaco, volta para o jogador
- se nao existir espaco, dropa no mundo
- o retorno deve ser autoritativo no servidor

---

## Regras De Integracao

Esse inventario novo precisa conversar com:

- inventory runtime
- actor runtime
- build progress
- cancel / dismantle
- front-end do card do shelter

E nao deve depender de:

- estado local do navegador
- contagem do front
- plausibilidade visual

---

## Ordem Sugerida De Implementacao

> Esta ordem foi usada como guia inicial. O nucleo principal da fase de materiais ja saiu do planejamento e entrou na implementacao.

1. definir o schema do inventario de obra
2. persistir o container do shelter ao posicionar
3. expor deposito parcial no servidor
4. ajustar o card do shelter para mostrar deposito
5. bloquear `Start` ate completar a receita
6. tratar cancelamento com retorno / drop
7. ajustar logs e notificacoes
8. polir UI e suportar novas receitas maiores

---

## Riscos

- misturar inventario do jogador com inventario da obra
- perder materiais em cancelamento
- permitir start sem deposito completo
- deixar o card mostrar dados sem origem persistida
- nao suportar receitas com mais de um item

---

## Regra De Ouro

Se a obra aceita materiais, ela precisa ter:

- inventario proprio
- slots persistidos
- deposito parcial
- devolucao autoritativa
- estado claro no servidor

Sem isso, a construcao volta a ser apenas uma validacao visual.
