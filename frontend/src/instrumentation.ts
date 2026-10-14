/**
 * Next.js Instrumentation Hook
 * Executado uma única vez na inicialização do servidor (boot/deploy).
 * Restaura automaticamente sessões ativas do WhatsApp Baileys salvas no PostgreSQL.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // CRÍTICO: Nunca executar durante a fase de compilação/build do Next.js (next build)
    // No Railway/Docker, o build executa em ambiente com nodejs. Se conectar aqui,
    // concorre com a instância ativa em produção, causa conflito de sessão e derruba o WhatsApp!
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return;
    }

    try {
      const { autoConnectIfSaved, gracefulShutdown } = await import('@/lib/whatsapp/whatsappService');

      // Registra handlers para shutdown gracioso (SIGTERM no Railway durante deploy)
      // Fecha o WebSocket no WhatsApp sem fazer logout e sem alterar status para DISCONNECTED no banco,
      // permitindo que o novo container assuma a sessão imediatamente sem pedir QR Code.
      if (typeof process !== 'undefined') {
        const handleShutdown = async (signal: string) => {
          console.log(`[WhatsApp Instrumentation] Recebido sinal ${signal}. Executando encerramento gracioso...`);
          try {
            await gracefulShutdown();
          } catch (e) {}
        };

        process.once('SIGTERM', () => handleShutdown('SIGTERM'));
        process.once('SIGINT', () => handleShutdown('SIGINT'));
      }

      // Aguarda 3s para estabilização do pool do banco no arranque do container
      setTimeout(() => {
        autoConnectIfSaved('default').catch((err) => {
          console.warn('[WhatsApp Boot Reconnect]:', err?.message || err);
        });
      }, 3000);
    } catch (e: any) {
      console.warn('[Instrumentation] Erro ao carregar whatsappService:', e?.message || e);
    }
  }
}
