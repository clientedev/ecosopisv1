import { NextResponse, type NextRequest } from "next/server";

/**
 * As chamadas /api/* são repassadas ao backend pelo proxy do Next.
 * Aqui encaminhamos o IP e o user-agent reais do visitante para que a
 * API de Conversões da Meta consiga casar o evento com a pessoa certa.
 */
export function middleware(request: NextRequest) {
    const headers = new Headers(request.headers);
    const fwd = request.headers.get("x-forwarded-for") || "";
    const ip = (fwd.split(",")[0] || "").trim() || request.headers.get("x-real-ip") || (request as any).ip || "";
    if (ip) headers.set("x-eco-client-ip", ip);
    const ua = request.headers.get("user-agent");
    if (ua) headers.set("x-eco-client-ua", ua);
    return NextResponse.next({ request: { headers } });
}

export const config = {
    matcher: ["/api/meta/:path*", "/api/payment/:path*"],
};
