/**
 * =====================================================================
 * âš ï¸ REGRA DE OURO â€” COMENTÃRIO IMUTÃVEL (NÃƒO REMOVER)
 * =====================================================================
 *
 * âŒ ESTE BLOCO DE COMENTÃRIO NÃƒO PODE SER REMOVIDO
 * âŒ ESTE BLOCO NÃƒO PODE SER ENCURTADO
 *
 * ðŸ“¦ Arquivo: GameShell.jsx
 *
 * Papel:
 * - Orquestrar o ciclo de vida do runtime no cliente.
 * - Executar o bootstrap do mundo (snapshot inicial) apÃ³s autenticaÃ§Ã£o.
 * - Subir a conexÃ£o Socket.IO (apÃ³s snapshot existir) para receber estado confirmado.
 * - Atualizar o snapshot.runtime SOMENTE com dados confirmados pelo servidor (move:state).
 * - Entregar o snapshot (e o socket) para o render host (GameCanvas).
 *
 * Fonte da verdade:
 * - Backend (snapshot inicial via /world/bootstrap e updates via socket events).
 * - O cliente NÃƒO calcula posiÃ§Ã£o final e NÃƒO simula mundo.
 *
 * NÃƒO FAZ:
 * - NÃƒO renderiza Three.js nem cria scene/camera/renderer.
 * - NÃƒO move player localmente.
 * - NÃƒO calcula fÃ­sica, colisÃ£o ou posiÃ§Ã£o preditiva.
 * - NÃƒO implementa multiplayer (rooms/broadcast).
 * - NÃƒO persiste runtime no banco (isso Ã© responsabilidade do servidor).
 *
 * FAZ:
 * - Faz bootstrapWorld(token) e valida erros (inclui 401).
 * - Conecta socket com token (handshake auth) somente apÃ³s snapshot inicial.
 * - Escuta "move:state" e aplica patch no snapshot.runtime (imutÃ¡vel via setState).
 * - Faz cleanup de listeners e desconecta socket no unmount.
 *
 * ðŸ¤– IAs:
 * - Ao editar este arquivo, preservar o contrato: Backend autoritativo.
 * - NÃ£o introduzir simulaÃ§Ã£o local, nem duplicar fontes de verdade.
 * - MudanÃ§as devem ser incrementais e compatÃ­veis com o snapshot existente.
 *
 * =====================================================================
 */
export { GameShell } from "./GameShell/index.jsx";
