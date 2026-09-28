/**
 * Next.js Instrumentation Hook
 * Executado uma única vez na inicialização do servidor (boot/deploy).
 * Restaura automaticamente sessões ativas do WhatsApp Baileys salvas no PostgreSQL.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { autoConnectIfSaved } = await import('@/lib/whatsapp/whatsappService');
      // Aguarda 1.5s para estabilização do pool do banco no arranque do container
      setTimeout(() => {
        autoConnectIfSaved('default').catch((err) => {
          console.warn('[WhatsApp Boot Reconnect]:', err?.message || err);
        });
      }, 1500);
    } catch (e: any) {
      console.warn('[Instrumentation] Erro ao carregar whatsappService:', e?.message || e);
    }
  }
}
