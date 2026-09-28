import { getWhatsAppEvents, getWhatsAppStatus } from '@/lib/whatsapp/whatsappService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const events = getWhatsAppEvents();

  const stream = new ReadableStream({
    async start(controller) {
      // 1. Envia status inicial imediatamente
      try {
        const initialStatus = await getWhatsAppStatus();
        controller.enqueue(
          encoder.encode(`event: status\ndata: ${JSON.stringify(initialStatus)}\n\n`)
        );
      } catch (err) {
        console.error('Erro ao enviar status inicial SSE:', err);
      }

      // 2. Listeners de eventos em tempo real
      const onStatus = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Stream fechada pelo cliente
        }
      };

      const onQr = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: qr\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {}
      };

      const onMessageSent = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: message_sent\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {}
      };

      // Heartbeat para manter conexão aberta em proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (e) {
          clearInterval(heartbeat);
        }
      }, 15000);

      events.on('status', onStatus);
      events.on('qr', onQr);
      events.on('message_sent', onMessageSent);

      // Cleanup quando cliente desconecta
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        events.off('status', onStatus);
        events.off('qr', onQr);
        events.off('message_sent', onMessageSent);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  });
}
