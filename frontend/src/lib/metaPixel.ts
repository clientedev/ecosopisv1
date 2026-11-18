/**
 * Meta Pixel (Facebook / Instagram) + espelho para a API de Conversões.
 *
 * Cada evento é disparado no navegador (fbq) e enviado ao backend
 * (/api/meta/track) com o MESMO event_id — a Meta deduplica e o CRM
 * registra o funil. A compra (Purchase) é enviada pelo servidor quando o
 * pagamento é aprovado; o navegador repete com event_id "purchase_<id>".
 */

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "951267150021255";

const ATTR_COOKIE = "eco_attr";
const ATTR_DAYS = 30;

type CustomData = Record<string, any>;

declare global {
    interface Window {
        fbq?: (...args: any[]) => void;
        _fbq?: any;
    }
}

let identity: { email?: string; phone?: string; external_id?: string } = {};

export function setMetaIdentity(user: { email?: string; phone?: string; id?: number | string } | null) {
    identity = user
        ? { email: user.email || undefined, phone: user.phone || undefined, external_id: user.id ? String(user.id) : user.email }
        : {};
}

function newEventId(prefix: string) {
    const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}_${rnd}`;
}

function readCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string, days: number) {
    if (typeof document === "undefined") return;
    const exp = new Date(Date.now() + days * 864e5).toUTCString();
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax${secure}`;
}

// id anônimo estável do visitante (o _fbp só existe depois que o pixel carrega)
function visitorId(): string {
    let vid = readCookie("eco_vid");
    if (!vid) {
        vid = `eco.${Date.now()}.${Math.random().toString(36).slice(2, 12)}`;
        writeCookie("eco_vid", vid, 365);
    }
    return vid;
}

/**
 * Guarda a origem da visita (UTM / fbclid / referrer) — último clique não-direto, 30 dias.
 * O backend lê este cookie ao criar o pedido para atribuir a venda à campanha.
 */
export function captureAttribution() {
    if (typeof window === "undefined") return;
    try {
        const params = new URLSearchParams(window.location.search);
        const utm: Record<string, string> = {};
        ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => {
            const v = params.get(k);
            if (v) utm[k] = v.slice(0, 150);
        });
        const fbclid = params.get("fbclid");
        if (fbclid) {
            if (!utm.utm_source) utm.utm_source = "meta";
            if (!utm.utm_medium) utm.utm_medium = "paid_or_social";
            // _fbc no formato oficial (o pixel também cria, isto garante quando o pixel é bloqueado)
            if (!readCookie("_fbc")) writeCookie("_fbc", `fb.1.${Date.now()}.${fbclid}`, 90);
        }
        if (!utm.utm_source && document.referrer) {
            const ref = document.referrer.toLowerCase();
            if (!ref.includes(window.location.hostname)) {
                if (ref.includes("instagram.com")) Object.assign(utm, { utm_source: "instagram", utm_medium: "social" });
                else if (ref.includes("facebook.com") || ref.includes("fb.com")) Object.assign(utm, { utm_source: "facebook", utm_medium: "social" });
            }
        }
        if (utm.utm_source) {
            writeCookie(ATTR_COOKIE, JSON.stringify({ ...utm, ts: Date.now(), landing: window.location.pathname }), ATTR_DAYS);
        }
    } catch {
        /* nunca quebrar a navegação */
    }
}

export function initMetaPixel() {
    if (typeof window === "undefined" || window.fbq) return;
    /* eslint-disable */
    (function (f: any, b: any, e: any, v: any) {
        if (f.fbq) return;
        const n: any = (f.fbq = function () {
            n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        });
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = "2.0";
        n.queue = [];
        const t = b.createElement(e);
        t.async = true;
        t.src = v;
        const s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    // O PageView de navegação interna é disparado por nós (com eventID p/ deduplicar com a CAPI);
    // desliga o PageView automático do pixel em mudanças de rota (pushState).
    (window.fbq as any).disablePushState = true;
    const am: Record<string, string> = {};
    if (identity.email) am.em = identity.email.trim().toLowerCase();
    if (identity.external_id) am.external_id = identity.external_id;
    window.fbq!("init", META_PIXEL_ID, am);
}

function sendToServer(eventName: string, eventId: string, customData?: CustomData) {
    try {
        const body = JSON.stringify({
            event_name: eventName,
            event_id: eventId,
            url: window.location.href.slice(0, 500),
            path: window.location.pathname,
            visitor_id: visitorId(),
            custom_data: customData || null,
            email: identity.email || null,
            phone: identity.phone || null,
            external_id: identity.external_id || null,
        });
        fetch("/api/meta/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch {
        /* silencioso */
    }
}

export function trackMeta(eventName: string, customData?: CustomData, eventId?: string) {
    if (typeof window === "undefined") return;
    const id = eventId || newEventId(eventName.toLowerCase());
    try {
        if (!window.fbq) initMetaPixel();
        window.fbq?.("track", eventName, customData || {}, { eventID: id });
    } catch {
        /* pixel bloqueado (adblock) — o servidor ainda recebe */
    }
    if (eventName !== "Purchase") sendToServer(eventName, id, customData);
    return id;
}

// ── Helpers de e-commerce ─────────────────────────────────────────────────────
const num = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

export function trackPageView() {
    trackMeta("PageView");
}

export function trackViewContent(product: { id: number | string; name?: string; price?: number; sale_price?: number; is_on_sale?: boolean; category?: string }) {
    if (!product?.id) return;
    const price = product.is_on_sale && product.sale_price ? product.sale_price : product.price;
    trackMeta("ViewContent", {
        content_ids: [String(product.id)],
        content_name: product.name,
        content_type: "product",
        content_category: product.category,
        value: num(price),
        currency: "BRL",
    });
}

export function trackAddToCart(product: { id: number | string; name?: string; price?: number }, quantity = 1) {
    if (!product?.id) return;
    trackMeta("AddToCart", {
        content_ids: [String(product.id)],
        content_name: product.name,
        content_type: "product",
        contents: [{ id: String(product.id), quantity, item_price: num(product.price) }],
        value: num((product.price || 0) * quantity),
        currency: "BRL",
    });
}

export function trackInitiateCheckout(items: Array<{ id: number | string; quantity: number; price: number }>, total: number) {
    if (!items?.length) return;
    // evita disparar várias vezes para o mesmo carrinho (navegação entre etapas)
    const signature = items.map((i) => `${i.id}x${i.quantity}`).sort().join(",") + `|${num(total)}`;
    try {
        const key = "eco_ic_sig";
        const prev = JSON.parse(sessionStorage.getItem(key) || "null");
        if (prev && prev.sig === signature && Date.now() - prev.ts < 30 * 60 * 1000) return;
        sessionStorage.setItem(key, JSON.stringify({ sig: signature, ts: Date.now() }));
    } catch {
        /* ignore */
    }
    trackMeta("InitiateCheckout", {
        content_ids: items.map((i) => String(i.id)),
        contents: items.map((i) => ({ id: String(i.id), quantity: i.quantity, item_price: num(i.price) })),
        content_type: "product",
        num_items: items.reduce((s, i) => s + (i.quantity || 1), 0),
        value: num(total),
        currency: "BRL",
    });
}

export function trackPurchase(order: { id: number | string; total: number; items?: any[] }) {
    if (!order?.id) return;
    try {
        const key = `eco_purchase_${order.id}`;
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "1");
    } catch {
        /* ignore */
    }
    const items = Array.isArray(order.items) ? order.items : [];
    trackMeta(
        "Purchase",
        {
            content_ids: items.map((i: any) => String(i.product_id ?? i.id)).filter(Boolean),
            contents: items.map((i: any) => ({ id: String(i.product_id ?? i.id), quantity: Number(i.quantity || 1), item_price: num(i.price) })),
            content_type: "product",
            value: num(order.total),
            currency: "BRL",
            order_id: String(order.id),
        },
        `purchase_${order.id}`,
    );
}
