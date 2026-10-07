"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import AdminLayout from "@/components/AdminLayout/AdminLayout";
import {
    Package, CheckCircle, Truck, Clock, Download,
    ChevronDown, ChevronUp, XCircle, RefreshCw, Search,
    AlertTriangle, ExternalLink, Tag, Loader2, Copy, MapPin,
    PlusCircle, ShoppingBag, X
} from "lucide-react";
import pedidoStyles from "./pedidos.module.css";
import { fuzzySearch } from "@/utils/search";

interface Order {
    id: number;
    buyer_name: string;
    buyer_email: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    customer_cpf: string | null;
    status: string;
    total: number;
    items: any[];
    address: any;
    correios_label_url: string | null;
    etiqueta_url: string | null;
    shipment_id: string | null;
    codigo_rastreio: string | null;
    shipping_method: string | null;
    shipping_price: number;
    package_width?: number | null;
    package_height?: number | null;
    package_length?: number | null;
    package_weight?: number | null;
    shipping_service_id?: number | null;
    stripe_session_id: string | null;
    stripe_payment_id: string | null;
    mercadopago_payment_id?: string | null;
    mercadopago_preference_id?: string | null;
    payment_method: string | null;
    coupon_code: string | null;
    discount_amount: number;
    created_at: string;
}

interface PackageConfig {
    length: number;
    width: number;
    height: number;
    weight: number;
    serviceId: number;
    serviceName: string;
}

const CARRIER_SERVICES = [
    { id: 1, name: "Correios PAC", badge: "Econômico", company: "Correios", icon: "📦" },
    { id: 2, name: "Correios SEDEX", badge: "Expresso", company: "Correios", icon: "⚡" },
    { id: 17, name: "Correios Mini Envios", badge: "Pequenos Volumes", company: "Correios", icon: "✉️" },
    { id: 3, name: "Jadlog .Package", badge: "Econômico Privado", company: "Jadlog", icon: "🚛" },
    { id: 4, name: "Jadlog .Com", badge: "Expresso Privado", company: "Jadlog", icon: "🚀" },
    { id: 31, name: "Loggi Express", badge: "Logística Expressa", company: "Loggi", icon: "📦" },
    { id: 15, name: "Azul Cargo Expresso", badge: "Aéreo Express", company: "Azul", icon: "✈️" },
];

const calculateEstimatedWeight = (items: any[]): number => {
    if (!items || !Array.isArray(items) || items.length === 0) return 0.10;
    let total = 0;
    for (const item of items) {
        const name = String(item.product_name || item.name || "").toLowerCase().trim();
        let qty = Number(item.quantity) || 1;

        if (name.includes("60 unidades") || name.includes("60 un")) {
            qty *= 60;
        } else if (name.includes("10 unidades") || name.includes("10 un")) {
            qty *= 10;
        }

        // Regras:
        // - Sabonete líquido: 300g (0.30 kg)
        // - Sabonete em barra / comum: 100g (0.10 kg)
        // - Demais produtos: 100g (0.10 kg)
        let unitWeight = 0.10;
        if (name.includes("sabonete") && (name.includes("líquido") || name.includes("liquido"))) {
            unitWeight = 0.30;
        } else if (name.includes("sabonete")) {
            unitWeight = 0.10;
        } else {
            unitWeight = 0.10;
        }

        total += unitWeight * qty;
    }
    return Math.max(0.10, Number(total.toFixed(2)));
};

const getDefaultPackageForOrder = (order: Order): PackageConfig => {
    // 1. Dimensões padrão da loja (20x16x12) ou as já salvas anteriormente
    const length = (order.package_length && Number(order.package_length) > 0) ? Number(order.package_length) : 20;
    const width = (order.package_width && Number(order.package_width) > 0) ? Number(order.package_width) : 16;
    const height = (order.package_height && Number(order.package_height) > 0) ? Number(order.package_height) : 12;

    // Peso estimado aproximado calculado pelos itens do pedido
    const estimatedWeight = calculateEstimatedWeight(order.items);
    const weight = (order.package_weight && Number(order.package_weight) > 0 && Number(order.package_weight) !== 0.3)
        ? Number(order.package_weight)
        : estimatedWeight;

    // 2. Transportadora pré-selecionada com base na escolha do cliente
    let defaultServiceId = 1;
    let defaultServiceName = "Correios PAC";

    const sm = (order.shipping_method || "").toLowerCase().trim();

    // 2.1. Se já possui o shipping_service_id salvo diretamente
    if (order.shipping_service_id) {
        const found = CARRIER_SERVICES.find(c => c.id === order.shipping_service_id);
        if (found) {
            defaultServiceId = found.id;
            defaultServiceName = found.name;
            return { length, width, height, weight, serviceId: defaultServiceId, serviceName: defaultServiceName };
        }
    }

    // 2.2. Mapeamento inteligente pelo nome da opção escolhida pelo cliente
    if (sm.includes("sedex")) {
        defaultServiceId = 2;
        defaultServiceName = "Correios SEDEX";
    } else if (sm.includes("mini")) {
        defaultServiceId = 17;
        defaultServiceName = "Correios Mini Envios";
    } else if (sm.includes(".com") || sm === "com" || (sm.includes("jadlog") && sm.includes("com"))) {
        defaultServiceId = 4;
        defaultServiceName = "Jadlog .Com";
    } else if (sm.includes("package") || sm.includes(".package") || sm.includes("jadlog")) {
        defaultServiceId = 3;
        defaultServiceName = "Jadlog .Package";
    } else if (sm.includes("azul")) {
        defaultServiceId = 15;
        defaultServiceName = "Azul Cargo Expresso";
    } else if (sm.includes("loggi") || sm.includes("express")) {
        defaultServiceId = 31;
        defaultServiceName = "Loggi Express";
    } else if (sm.includes("pac")) {
        defaultServiceId = 1;
        defaultServiceName = "Correios PAC";
    } else {
        const directFound = CARRIER_SERVICES.find(c => sm.includes(c.name.toLowerCase()) || sm.includes(c.company.toLowerCase()));
        if (directFound) {
            defaultServiceId = directFound.id;
            defaultServiceName = directFound.name;
        } else {
            defaultServiceId = 1;
            defaultServiceName = "Correios PAC";
        }
    }

    return {
        length,
        width,
        height,
        weight,
        serviceId: defaultServiceId,
        serviceName: defaultServiceName,
    };
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
    pending:            { label: "No Carrinho",       color: "#d97706", icon: Clock },
    paid:               { label: "Pago",              color: "#059669", icon: CheckCircle },
    shipped:            { label: "Enviado",           color: "#2563eb", icon: Truck },
    delivered:          { label: "Entregue",          color: "#7c3aed", icon: Package },
    cancelled:          { label: "Cancelado",         color: "#dc2626", icon: XCircle },
    payment_error:      { label: "Erro Pgto.",        color: "#dc2626", icon: XCircle },
    processando_envio:  { label: "Proc. Envio",       color: "#0891b2", icon: Loader2 },
    erro_envio:         { label: "Erro Envio",        color: "#dc2626", icon: XCircle },
    PROCESSANDO_ENVIO:  { label: "Proc. Envio",       color: "#0891b2", icon: Loader2 },
    ERRO_ENVIO:         { label: "Erro Envio",        color: "#dc2626", icon: XCircle },
};

const NEXT_STATUS: Record<string, string[]> = {
    pending:            ["paid", "cancelled"],
    paid:               ["shipped", "cancelled"],
    shipped:            ["delivered", "paid"],
    delivered:          ["shipped"],
    cancelled:          ["paid"],
    erro_envio:         ["shipped", "paid"],
    ERRO_ENVIO:         ["shipped", "paid"],
    processando_envio:  ["shipped", "paid"],
    PROCESSANDO_ENVIO:  ["shipped", "paid"],
};

const ME_BALANCE_URL = "https://melhorenvio.com.br/painel/carteira";

export default function AdminPedidosPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("paid");
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
    const [generatingLabel, setGeneratingLabel] = useState<number | null>(null);
    const [labelResults, setLabelResults] = useState<Record<number, { url: string; tracking: string; shipment: string }>>({});
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [notification, setNotification] = useState<{ type: "error" | "success" | "warning"; title: string; message: string } | null>(null);
    const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
    const [addressForm, setAddressForm] = useState<any>({});
    const [savingAddress, setSavingAddress] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null);
    const [syncingME, setSyncingME] = useState<number | "all" | null>(null);
    const [showExternalModal, setShowExternalModal] = useState(false);
    const [savingExternal, setSavingExternal] = useState(false);
    const [externalForm, setExternalForm] = useState({
        channel: "mercadolivre",
        customer_name: "Comprador Mercado Livre",
        customer_email: "",
        customer_phone: "",
        product_name: "Óleo Vegetal De Rosa Mosqueta Rubiginosa 100% Puro",
        quantity: 1,
        total: 19.89,
        transaction_id: "",
        notes: "Venda externa. Etiqueta e envio gerenciados pelo Mercado Envios."
    });

    const [packageForms, setPackageForms] = useState<Record<number, PackageConfig>>({});
    const [savingPackage, setSavingPackage] = useState<number | null>(null);
    const [quotingOrderId, setQuotingOrderId] = useState<number | null>(null);
    const [quotes, setQuotes] = useState<Record<number, any[]>>({});
    const [shippingModalOrder, setShippingModalOrder] = useState<Order | null>(null);
    const [modalPackage, setModalPackage] = useState<PackageConfig | null>(null);

    const getPackageForm = (order: Order): PackageConfig => {
        if (packageForms[order.id]) {
            return packageForms[order.id];
        }
        return getDefaultPackageForOrder(order);
    };

    const fetchCheapestQuoteForFreeShipping = async (order: Order, pkgConfig: PackageConfig) => {
        try {
            const res = await authFetch(`/api/shipping/quote-order/${order.id}`, {
                method: "POST",
                body: JSON.stringify({
                    package_length: Number(pkgConfig.length) || 20,
                    package_width: Number(pkgConfig.width) || 16,
                    package_height: Number(pkgConfig.height) || 12,
                    package_weight: Number(pkgConfig.weight) || 0.3,
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.options && data.options.length > 0) {
                    setQuotes(prev => ({ ...prev, [order.id]: data.options }));
                    const validQuotes = data.options.filter((q: any) => q.price && !q.error);
                    const cheapestQuote = [...validQuotes].sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];
                    if (cheapestQuote) {
                        const found = CARRIER_SERVICES.find(c => c.id === Number(cheapestQuote.id));
                        const sId = found ? found.id : Number(cheapestQuote.id);
                        const sName = found ? found.name : (cheapestQuote.name || "Opção Mais Barata");
                        setModalPackage(prev => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                serviceId: sId,
                                serviceName: sName,
                            };
                        });
                    }
                }
            }
        } catch {
            // Silencioso se offline
        }
    };

    const openShippingModal = (order: Order) => {
        const pkg = packageForms[order.id] || getDefaultPackageForOrder(order);
        const sm = (order.shipping_method || "").toLowerCase();
        const isFree = Number(order.shipping_price || 0) === 0 || sm.includes("grátis") || sm.includes("gratis") || sm.includes("free");

        let serviceId = pkg.serviceId;
        let serviceName = pkg.serviceName;

        // Se for frete grátis e houver cotações já feitas para o pedido, prioriza automaticamente a mais barata
        if (isFree && quotes[order.id] && quotes[order.id].length > 0) {
            const validQuotes = quotes[order.id].filter((q: any) => q.price && !q.error);
            const cheapestQuote = [...validQuotes].sort((a, b) => Number(a.price) - Number(b.price))[0];
            if (cheapestQuote) {
                const found = CARRIER_SERVICES.find(c => c.id === Number(cheapestQuote.id));
                if (found) {
                    serviceId = found.id;
                    serviceName = found.name;
                }
            }
        }

        const initialConfig: PackageConfig = {
            length: pkg.length,
            width: pkg.width,
            height: pkg.height,
            weight: pkg.weight,
            serviceId,
            serviceName,
        };

        setModalPackage(initialConfig);
        setShippingModalOrder(order);

        // Se for frete grátis e ainda não tiver cotações feitas, busca em segundo plano para selecionar a mais barata
        if (isFree && (!quotes[order.id] || quotes[order.id].length === 0)) {
            fetchCheapestQuoteForFreeShipping(order, initialConfig);
        }
    };

    const closeShippingModal = () => {
        setShippingModalOrder(null);
        setModalPackage(null);
    };

    const updatePackageField = (orderId: number, field: keyof PackageConfig, value: any) => {
        setPackageForms(prev => {
            const order = orders.find(o => o.id === orderId);
            const current = prev[orderId] || (order ? getDefaultPackageForOrder(order) : {
                length: 20, width: 16, height: 12, weight: 0.3, serviceId: 1, serviceName: "Correios PAC"
            });
            return {
                ...prev,
                [orderId]: {
                    ...current,
                    [field]: value
                }
            };
        });
    };

    const savePackageConfig = async (orderId: number) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        const pkg = getPackageForm(order);
        setSavingPackage(orderId);
        setNotification(null);
        try {
            const body = {
                package_length: Number(pkg.length) || 20,
                package_width: Number(pkg.width) || 16,
                package_height: Number(pkg.height) || 12,
                package_weight: Number(pkg.weight) || 0.3,
                shipping_service_id: Number(pkg.serviceId) || 1,
                shipping_method: pkg.serviceName || "Correios PAC"
            };

            const res = await authFetch(`/api/orders/${orderId}/shipping-package`, {
                method: "PATCH",
                body: JSON.stringify(body)
            });
            if (res.ok) {
                const updatedOrder = await res.json().catch(() => ({}));
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updatedOrder, ...body } : o));
                setPackageForms(prev => ({
                    ...prev,
                    [orderId]: {
                        length: body.package_length,
                        width: body.package_width,
                        height: body.package_height,
                        weight: body.package_weight,
                        serviceId: body.shipping_service_id,
                        serviceName: body.shipping_method,
                    }
                }));
                setNotification({
                    type: "success",
                    title: "Embalagem salva com sucesso!",
                    message: `Pedido #${orderId}: dimensões (${body.package_length}x${body.package_width}x${body.package_height}cm, ${body.package_weight}kg) e transportadora (${body.shipping_method}) foram salvas no sistema.`
                });
            } else {
                const err = await res.json().catch(() => ({}));
                setNotification({
                    type: "error",
                    title: "Erro ao salvar embalagem",
                    message: err.detail || "Não foi possível salvar as alterações no servidor."
                });
            }
        } catch {
            setNotification({
                type: "error",
                title: "Erro de conexão",
                message: "Falha na comunicação ao salvar embalagem."
            });
        } finally {
            setSavingPackage(null);
        }
    };

    const handleQuoteOrder = async (orderId: number) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        const pkg = getPackageForm(order);
        setQuotingOrderId(orderId);
        try {
            const res = await authFetch(`/api/shipping/quote-order/${orderId}`, {
                method: "POST",
                body: JSON.stringify({
                    package_length: Number(pkg.length),
                    package_width: Number(pkg.width),
                    package_height: Number(pkg.height),
                    package_weight: Number(pkg.weight),
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.options && data.options.length > 0) {
                    setQuotes(prev => ({ ...prev, [orderId]: data.options }));
                    setNotification({
                        type: "success",
                        title: "Cotação realizada!",
                        message: `Encontradas ${data.options.length} opções de frete para o CEP do pedido.`
                    });
                } else {
                    setNotification({
                        type: "warning",
                        title: "Sem cotações",
                        message: data.error || "Nenhuma transportadora retornou cotação para o CEP deste pedido."
                    });
                }
            }
        } catch {
            setNotification({
                type: "error",
                title: "Erro ao cotar",
                message: "Falha na comunicação ao cotar frete."
            });
        } finally {
            setQuotingOrderId(null);
        }
    };

    const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const authHeaders = () => ({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
    });

    const handleCreateExternalOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingExternal(true);
        try {
            const payload = {
                channel: externalForm.channel,
                customer_name: externalForm.customer_name || "Cliente Externo",
                customer_email: externalForm.customer_email || `vendas.${externalForm.channel}@ecosopis.com.br`,
                customer_phone: externalForm.customer_phone || null,
                total: Number(externalForm.total) || 0,
                shipping_method: externalForm.channel === "mercadolivre" ? "Mercado Envios" : "Balcão",
                shipping_price: 0,
                status: "paid",
                transaction_id: externalForm.transaction_id || null,
                notes: externalForm.notes || null,
                items: [
                    {
                        product_id: 1,
                        product_name: externalForm.product_name || "Produto",
                        quantity: Number(externalForm.quantity) || 1,
                        price: (Number(externalForm.total) || 0) / (Number(externalForm.quantity) || 1)
                    }
                ]
            };
            const res = await authFetch("/api/orders/admin/manual", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setShowExternalModal(false);
                await fetchOrders();
                setNotification({
                    type: "success",
                    title: "Venda Externa Cadastrada!",
                    message: `Pedido registrado com sucesso (${externalForm.channel === 'mercadolivre' ? 'Mercado Livre' : externalForm.channel}) no valor de R$ ${Number(externalForm.total).toFixed(2)}.`
                });
            } else {
                const err = await res.json();
                setNotification({
                    type: "error",
                    title: "Erro ao cadastrar",
                    message: err.detail || "Não foi possível cadastrar a venda externa."
                });
            }
        } catch (err: any) {
            setNotification({
                type: "error",
                title: "Erro de conexão",
                message: err.message || "Falha ao registrar venda."
            });
        } finally {
            setSavingExternal(false);
        }
    };

    // Centralized fetch that auto-redirects to login on 401
    const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
        const res = await fetch(url, {
            ...options,
            headers: { ...authHeaders(), ...(options.headers || {}) }
        });
        if (res.status === 401) {
            setNotification({ type: "error", title: "Sessão expirada", message: "Sua sessão expirou. Faça login novamente." });
            setTimeout(() => router.push("/admin"), 2000);
        }
        return res;
    };

    const handleSyncME = async (orderId?: number) => {
        setSyncingME(orderId || "all");
        setNotification(null);
        try {
            const url = orderId ? `/api/shipping/sync/${orderId}` : `/api/shipping/sync-all`;
            const res = await authFetch(url, { method: "POST" });
            if (res.status === 401) return;
            const data = await res.json();
            if (res.ok) {
                await fetchOrders();
                if (orderId) {
                    setNotification({
                        type: "success",
                        title: "Sincronizado com Melhor Envio!",
                        message: `Pedido #${orderId} atualizado: Status: ${data.status} · Rastreio: ${data.tracking_code || "Ainda não disponível"}`
                    });
                } else {
                    setNotification({
                        type: "success",
                        title: "Pedidos sincronizados!",
                        message: `Foram sincronizados ${data.synced || 0} pedidos com a API do Melhor Envio.`
                    });
                }
            } else {
                setNotification({
                    type: "warning",
                    title: "Aviso de sincronização",
                    message: data.detail || data.motivo || "Não foi possível sincronizar no momento."
                });
            }
        } catch (e) {
            setNotification({
                type: "error",
                title: "Erro de conexão",
                message: "Falha na comunicação ao sincronizar com Melhor Envio."
            });
        } finally {
            setSyncingME(null);
        }
    };


    useEffect(() => {
        fetchOrders();
        const dismissed = localStorage.getItem("me_banner_dismissed");
        if (dismissed) setBannerDismissed(true);
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/orders/admin/all", { headers: authHeaders() });
            if (res.status === 401 || res.status === 403) { router.push("/admin"); return; }
            if (res.ok) setOrders(await res.json());
        } catch (e) {
            console.error("Erro ao carregar pedidos:", e);
        } finally {
            setLoading(false);
        }
    };

    const parseMEError = (detail: string): { title: string; message: string } => {
        const raw = detail || "";
        const lower = raw.toLowerCase();
        if (lower.includes("carrinho")) {
            return {
                title: "Etiqueta enviada para o Carrinho do Melhor Envio!",
                message: "O envio foi adicionado com sucesso ao carrinho do Melhor Envio com as configurações selecionadas. Você pode visualizá-la e efetuar a compra no painel do Melhor Envio quando desejar."
            };
        }
        if (lower.includes("saldo") && lower.includes("insuficiente")) {
            const match = raw.match(/R\$\s*[\d.,]+/g);
            const balanceStr = match ? match[0] : "insuficiente";
            return {
                title: "Saldo insuficiente na Melhor Envio",
                message: `Seu saldo atual (${balanceStr}) não cobre o valor da etiqueta. Acesse a carteira da Melhor Envio para adicionar créditos e tente novamente.`
            };
        }
        if (lower.includes("token") || lower.includes("unauthorized") || raw.includes("401")) {
            return { title: "Token Melhor Envio inválido", message: "O token de autenticação da Melhor Envio está inválido ou expirado. Atualize o token nas configurações do sistema." };
        }
        if (lower.includes("cep") || lower.includes("postal")) {
            const cepMatch = raw.match(/['"](\d{5,8})['"]|CEP[:\s]+([\d-]+)/i);
            const badCep = cepMatch ? (cepMatch[1] || cepMatch[2]) : null;
            const rawDetail = raw.replace(/^Erro Melhor Envio:\s*/i, "").substring(0, 400);
            return {
                title: "Erro no CEP / endereço",
                message: `Erro retornado pela Melhor Envio: "${rawDetail}". ${badCep ? `CEP detectado: "${badCep}". ` : ""}Verifique o endereço e tente novamente.`
            };
        }
        if (lower.includes("status") && lower.includes("não pode")) {
            return { title: "Status incompatível", message: "Apenas pedidos com status 'Pago' ou com erro anterior podem ter etiqueta gerada." };
        }
        if (
            lower.includes("nameresolution") || lower.includes("failed to resolve") ||
            lower.includes("max retries exceeded") || lower.includes("name or service not known") ||
            lower.includes("connectionerror") || lower.includes("connection refused") ||
            lower.includes("timed out") || lower.includes("remotedisconnected") ||
            lower.includes("timeout")
        ) {
            return {
                title: "Serviço Melhor Envio temporariamente indisponível",
                message: "Não foi possível conectar ao serviço Melhor Envio no momento. Isso pode ser uma instabilidade temporária. Aguarde alguns minutos e tente novamente. Se o problema persistir, verifique se o token da Melhor Envio está configurado corretamente."
            };
        }
        if (lower.includes("nenhuma opção de frete")) {
            return { title: "Nenhuma opção de frete disponível", message: "A Melhor Envio não retornou opções de frete para o CEP deste pedido. Verifique o endereço e tente novamente." };
        }
        const cleanedMessage = raw.replace(/^Erro Melhor Envio:\s*/i, "").substring(0, 250);
        return { title: "Não foi possível gerar a etiqueta", message: cleanedMessage || "Ocorreu um erro inesperado. Tente novamente em instantes." };
    };

    const handleEditAddress = (orderId: number, currentAddress: any) => {
        setEditingAddressId(orderId);
        setAddressForm({
            postal_code: currentAddress.postal_code || currentAddress.cep || currentAddress.zip || "",
            street: currentAddress.street || "",
            number: currentAddress.number || "",
            complement: currentAddress.complement || "",
            neighborhood: currentAddress.neighborhood || "",
            city: currentAddress.city || "",
            state: currentAddress.state || ""
        });
    };

    const saveAddress = async (orderId: number) => {
        setSavingAddress(true);
        setNotification(null);
        try {
            const res = await authFetch(`/api/orders/${orderId}/address`, {
                method: "PATCH",
                body: JSON.stringify({ address: addressForm })
            });
            if (res.status === 401) return; // already handled by authFetch
            const data = await res.json();
            if (res.ok) {
                setNotification({ type: "success", title: "Endereço atualizado!", message: "Você já pode tentar processar o Melhor Envio novamente." });
                setEditingAddressId(null);
                await fetchOrders();
            } else {
                setNotification({ type: "error", title: "Erro ao atualizar endereço", message: data.detail || "Revise os dados e tente novamente." });
            }
        } catch (e) {
            setNotification({ type: "error", title: "Erro de conexão", message: "Falha na comunicação com o servidor." });
        } finally {
            setSavingAddress(false);
        }
    };

    const handleClearAll = async () => {
        if (!confirm("⚠️ Esta ação irá EXCLUIR PERMANENTEMENTE todos os pedidos. Confirmar?")) return;
        if (!confirm("Confirmação final: excluir histórico de testes?")) return;
        try {
            const res = await fetch("/api/orders/admin/clear-all", { method: "DELETE", headers: authHeaders() });
            if (res.ok) {
                setNotification({ type: "success", title: "Histórico zerado!", message: "Todos os pedidos foram removidos com sucesso." });
                await fetchOrders();
            } else {
                const err = await res.json();
                setNotification({ type: "error", title: "Erro ao zerar histórico", message: err.detail || "Tente novamente." });
            }
        } catch {
            setNotification({ type: "error", title: "Erro de conexão", message: "Não foi possível conectar ao servidor. Verifique sua rede e tente novamente." });
        }
    };

    const updateStatus = async (orderId: number, newStatus: string) => {
        setUpdatingStatus(orderId);
        try {
            const res = await authFetch(`/api/orders/${orderId}/status`, {
                method: "PATCH", body: JSON.stringify({ status: newStatus })
            });
            if (res.status === 401) { setUpdatingStatus(null); return; }
            const data = await res.json();
            if (res.ok) {
                await fetchOrders();
                setNotification({ type: "success", title: "Status atualizado!", message: `Pedido #${orderId} → ${STATUS_LABELS[newStatus]?.label || newStatus}` });
            } else {
                setNotification({ type: "error", title: "Falha ao atualizar status", message: data.detail || "Tente novamente." });
            }
        } catch {
            setNotification({ type: "error", title: "Erro de conexão", message: "Não foi possível conectar ao servidor." });
        }
        finally { setUpdatingStatus(null); }
    };

    const gerarEtiquetaME = async (orderId: number, customPkg?: PackageConfig) => {
        setGeneratingLabel(orderId);
        setNotification(null);
        try {
            const order = orders.find(o => o.id === orderId);
            const pkg = customPkg || (order ? getPackageForm(order) : null);

            const bodyPayload = pkg ? {
                package_length: Number(pkg.length),
                package_width: Number(pkg.width),
                package_height: Number(pkg.height),
                package_weight: Number(pkg.weight),
                shipping_service_id: Number(pkg.serviceId),
                shipping_method: pkg.serviceName,
                force_recreate: true
            } : undefined;

            const res = await authFetch(`/api/shipping/generate-label/${orderId}`, {
                method: "POST",
                body: bodyPayload ? JSON.stringify(bodyPayload) : undefined
            });
            if (res.status === 401) { setGeneratingLabel(null); return; }
            const data = await res.json();
            if (res.ok) {
                await fetchOrders();
                if (data.label_url) {
                    setLabelResults(prev => ({
                        ...prev,
                        [orderId]: {
                            url: data.label_url,
                            tracking: data.tracking_code || "",
                            shipment: data.shipment_id || ""
                        }
                    }));
                    if (data.simulated) {
                        setNotification({
                            type: "warning",
                            title: "Etiqueta provisória gerada",
                            message: `Pedido #${orderId}: foi gerada uma etiqueta local provisória pois o serviço Melhor Envio está temporariamente indisponível. Você pode baixá-la agora e reprocessar pelo Melhor Envio assim que o serviço estiver estável.`
                        });
                    } else {
                        setNotification({
                            type: "success",
                            title: "Etiqueta gerada com sucesso!",
                            message: `Pedido #${orderId} · Rastreio: ${data.tracking_code || "disponível em breve"}`
                        });
                    }
                    window.open(data.label_url, "_blank");
                } else if (data.in_cart || data.message || data.shipment_id) {
                    setNotification({
                        type: "success",
                        title: "Envio no Carrinho do Melhor Envio!",
                        message: data.message || `Pedido #${orderId} adicionado ao carrinho do Melhor Envio (ID: ${data.shipment_id || ""}). Você pode conferir e decidir se compra a etiqueta diretamente no painel do Melhor Envio.`
                    });
                }
            } else {
                const parsed = parseMEError(data.detail || "");
                setNotification({ type: "error", title: parsed.title, message: parsed.message });
            }
        } catch {
            setNotification({ type: "error", title: "Erro de conexão", message: "Não foi possível contactar o servidor. Verifique sua rede e tente novamente." });
        }
        finally { setGeneratingLabel(null); }
    };

    const handleQuoteInModal = async (order: Order) => {
        if (!modalPackage) return;
        setQuotingOrderId(order.id);
        try {
            const res = await authFetch(`/api/shipping/quote-order/${order.id}`, {
                method: "POST",
                body: JSON.stringify({
                    package_length: Number(modalPackage.length) || 20,
                    package_width: Number(modalPackage.width) || 16,
                    package_height: Number(modalPackage.height) || 12,
                    package_weight: Number(modalPackage.weight) || 0.3,
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.options && data.options.length > 0) {
                    setQuotes(prev => ({ ...prev, [order.id]: data.options }));
                    const sm = (order.shipping_method || "").toLowerCase();
                    const isFree = Number(order.shipping_price || 0) === 0 || sm.includes("grátis") || sm.includes("gratis") || sm.includes("free");

                    const validQuotes = data.options.filter((q: any) => q.price && !q.error);
                    if (isFree && validQuotes.length > 0) {
                        const cheapestQuote = [...validQuotes].sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];
                        if (cheapestQuote) {
                            const found = CARRIER_SERVICES.find(c => c.id === Number(cheapestQuote.id));
                            const sId = found ? found.id : Number(cheapestQuote.id);
                            const sName = found ? found.name : (cheapestQuote.name || "Opção Mais Barata");
                            setModalPackage(prev => prev ? {
                                ...prev,
                                serviceId: sId,
                                serviceName: sName,
                            } : null);
                            setNotification({
                                type: "success",
                                title: "Frete Grátis: Opção mais barata selecionada!",
                                message: `Selecionada automaticamente: ${sName} (R$ ${Number(cheapestQuote.price).toFixed(2).replace(".", ",")}). Se quiser, você pode alterar no seletor abaixo.`
                            });
                            return;
                        }
                    }

                    setNotification({
                        type: "success",
                        title: "Cotação realizada!",
                        message: `Encontradas ${data.options.length} opções de frete. Selecione a transportadora desejada.`
                    });
                } else {
                    setNotification({
                        type: "warning",
                        title: "Sem cotações",
                        message: data.error || "Nenhuma transportadora retornou cotação para o CEP deste pedido."
                    });
                }
            }
        } catch {
            setNotification({
                type: "error",
                title: "Erro ao cotar",
                message: "Falha na comunicação ao cotar frete."
            });
        } finally {
            setQuotingOrderId(null);
        }
    };

    const handleSendFromModal = async (orderId: number) => {
        const order = orders.find(o => o.id === orderId);
        if (!order || !modalPackage) return;
        try {
            const finalPkg: PackageConfig = {
                length: Number(modalPackage.length) || 20,
                width: Number(modalPackage.width) || 16,
                height: Number(modalPackage.height) || 12,
                weight: Number(modalPackage.weight) || 0.3,
                serviceId: Number(modalPackage.serviceId) || 1,
                serviceName: modalPackage.serviceName || "Correios PAC",
            };
            setPackageForms(prev => ({ ...prev, [orderId]: finalPkg }));
            await gerarEtiquetaME(orderId, finalPkg);
            closeShippingModal();
        } catch {
            // Notificações já tratadas em gerarEtiquetaME
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => alert(`Copiado: ${text}`));
    };

    const downloadOrderPdf = async (orderId: number) => {
        setDownloadingPdf(orderId);
        setNotification(null);
        try {
            const res = await fetch(`/api/orders/${orderId}/label`, {
                headers: authHeaders()
            });
            if (!res.ok) {
                const data = await res.json();
                setNotification({
                    type: "error",
                    title: "Erro ao extrair PDF",
                    message: data.detail || "Não foi possível gerar o PDF do pedido."
                });
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `pedido-${orderId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setNotification({
                type: "success",
                title: "PDF extraído com sucesso!",
                message: `O PDF do pedido #${orderId} foi baixado.`
            });
        } catch (e) {
            console.error("Erro ao baixar PDF:", e);
            setNotification({
                type: "error",
                title: "Erro de conexão",
                message: "Não foi possível conectar ao servidor para baixar o PDF."
            });
        } finally {
            setDownloadingPdf(null);
        }
    };

    const dismissBanner = () => {
        setBannerDismissed(true);
        localStorage.setItem("me_banner_dismissed", "1");
    };

    const filteredOrders = searchTerm 
        ? fuzzySearch(orders.filter(o => filter === "all" || o.status === filter), searchTerm, ["id", "buyer_name", "customer_name", "buyer_email", "customer_email", "codigo_rastreio", "shipment_id"])
        : orders.filter(o => filter === "all" || o.status === filter);

    const stats = {
        total:    orders.length,
        pending:  orders.filter(o => o.status === "pending").length,
        paid:     orders.filter(o => o.status === "paid").length,
        shipped:  orders.filter(o => o.status === "shipped").length,
        delivered:orders.filter(o => o.status === "delivered").length,
        revenue:  orders.filter(o => ["paid","shipped","delivered"].includes(o.status))
                        .reduce((s, o) => s + (o.total || 0), 0),
    };

    return (
        <AdminLayout>
            <AdminSidebar activePath="/admin/pedidos" />

            <main className={pedidoStyles.mainContainer}>

                {/* ── Notificação in-page ── */}
                {notification && (
                    <div style={{
                        background: notification.type === "error" ? "#fef2f2" : notification.type === "success" ? "#f0fdf4" : "#fffbeb",
                        border: `1.5px solid ${notification.type === "error" ? "#fca5a5" : notification.type === "success" ? "#86efac" : "#fcd34d"}`,
                        borderRadius: "14px",
                        padding: "1rem 1.25rem",
                        marginBottom: "1rem",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.75rem",
                    }}>
                        <div style={{ fontSize: "1.3rem", flexShrink: 0, marginTop: "1px" }}>
                            {notification.type === "error" ? "❌" : notification.type === "success" ? "✅" : "⚠️"}
                        </div>
                        <div style={{ flex: 1 }}>
                            <strong style={{ display: "block", color: notification.type === "error" ? "#b91c1c" : notification.type === "success" ? "#15803d" : "#92400e", fontSize: "0.95rem", marginBottom: "2px" }}>
                                {notification.title}
                            </strong>
                            <span style={{ fontSize: "0.85rem", color: "#374151", lineHeight: 1.5 }}>{notification.message}</span>
                            {notification.type === "error" && notification.title.includes("Saldo") && (
                                <a href="https://melhorenvio.com.br/painel/carteira" target="_blank" rel="noopener noreferrer"
                                    style={{ display: "inline-block", marginTop: "6px", background: "#ea580c", color: "#fff", padding: "5px 14px", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700, textDecoration: "none" }}>
                                    💳 Abastecer Carteira Melhor Envio
                                </a>
                            )}
                        </div>
                        <button onClick={() => setNotification(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "1.1rem", padding: "0", flexShrink: 0 }}>✕</button>
                    </div>
                )}

                {/* ── Banner Melhor Envio ── */}
                {!bannerDismissed && (
                    <div style={{
                        background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                        border: "1.5px solid #fb923c",
                        borderRadius: "16px",
                        padding: "1rem 1.5rem",
                        marginBottom: "1.5rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        flexWrap: "wrap"
                    }}>
                        <AlertTriangle size={22} color="#ea580c" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <strong style={{ color: "#9a3412", fontSize: "0.95rem" }}>
                                ⚠️ Lembre-se de abastecer o saldo da Melhor Envio
                            </strong>
                            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#7c2d12" }}>
                                Sem saldo na carteira, a etiqueta não será gerada. Mantenha saldo suficiente antes de gerar etiquetas.
                            </p>
                        </div>
                        <a
                            href={ME_BALANCE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                                background: "#ea580c", color: "white", padding: "8px 16px",
                                borderRadius: "10px", fontSize: "0.82rem", fontWeight: 700,
                                textDecoration: "none", whiteSpace: "nowrap"
                            }}
                        >
                            Abastecer Saldo <ExternalLink size={14} />
                        </a>
                        <button
                            onClick={dismissBanner}
                            style={{ background: "none", border: "none", color: "#9a3412", cursor: "pointer", fontSize: "1.1rem", padding: "4px" }}
                        >
                            ✕
                        </button>
                    </div>
                )}

                <header className={pedidoStyles.headerRow}>
                    <div className={pedidoStyles.titleSection}>
                        <div className={pedidoStyles.titleIcon}>
                            <Package size={26} color="white" strokeWidth={1.8} />
                        </div>
                        <div className={pedidoStyles.titleText}>
                            <h1>Gestão de Pedidos</h1>
                            <p>Gerencie vendas e gere etiquetas via Melhor Envio.</p>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button 
                            onClick={() => setShowExternalModal(true)} 
                            className={pedidoStyles.btnAction}
                            style={{ background: "#f59e0b", borderColor: "#f59e0b", color: "#ffffff", fontWeight: 700 }}
                            title="Lançar venda externa (Mercado Livre, Shopee, WhatsApp, Balcão)"
                        >
                            <PlusCircle size={14} /> + Nova Venda Externa
                        </button>
                        <button 
                            onClick={() => handleSyncME()} 
                            disabled={syncingME === "all"} 
                            className={pedidoStyles.btnAction + " " + pedidoStyles.btnPrimary}
                            style={{ background: "#2563eb", borderColor: "#2563eb", color: "#ffffff" }}
                            title="Sincroniza todos os pedidos com a API do Melhor Envio"
                        >
                            {syncingME === "all" ? (
                                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Sincronizando ME...</>
                            ) : (
                                <><Truck size={14} /> Sincronizar Melhor Envio</>
                            )}
                        </button>
                        <button onClick={fetchOrders} className={pedidoStyles.btnAction + " " + pedidoStyles.btnSecondary}>
                            <RefreshCw size={14} /> Atualizar
                        </button>
                    </div>
                </header>

                <section className={pedidoStyles.statsGrid}>
                    {[
                        { label: "Total",       value: stats.total,     icon: "📊", color: "#1a1a1a" },
                        { label: "No Carrinho",   value: stats.pending,   icon: "🛒", color: "#d97706" },
                        { label: "Pagos",       value: stats.paid,      icon: "✅", color: "#059669" },
                        { label: "Enviados",    value: stats.shipped,   icon: "🚚", color: "#2563eb" },
                        { label: "Entregues",   value: stats.delivered, icon: "📦", color: "#7c3aed" },
                        { label: "Faturamento", value: `R$ ${stats.revenue.toFixed(2).replace(".", ",")}`, icon: "💰", color: "#2d5a27" },
                    ].map(stat => (
                        <div key={stat.label} className={pedidoStyles.statCard}>
                            <div className={pedidoStyles.statIcon}>{stat.icon}</div>
                            <div className={pedidoStyles.statValue} style={{ color: stat.color }}>{stat.value}</div>
                            <div className={pedidoStyles.statLabel}>{stat.label}</div>
                        </div>
                    ))}
                </section>

                <div className={pedidoStyles.filtersRow}>
                    <div className={pedidoStyles.searchSection}>
                        <Search className={pedidoStyles.searchIcon} size={18} />
                        <input
                            className={pedidoStyles.searchInput}
                            placeholder="Buscar por ID, nome, e-mail, rastreio..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className={pedidoStyles.filterTabs}>
                        {["all","pending","paid","shipped","delivered","cancelled","erro_envio","processando_envio"].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`${pedidoStyles.filterBtn} ${filter === f ? pedidoStyles.filterBtnActive : pedidoStyles.filterBtnInactive}`}
                            >
                                {f === "all" ? "Todos" : (STATUS_LABELS[f]?.label || f)}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: "center", padding: "4rem", color: "#6b7280" }}>
                        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
                        <p>Carregando pedidos...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "4rem", color: "#6b7280" }}>Nenhum pedido encontrado.</div>
                ) : (
                    <div className={pedidoStyles.ordersList}>
                        {filteredOrders.map(order => {
                            const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: "#6b7280", icon: Clock };
                            const StatusIcon = statusInfo.icon;
                            const isExpanded = expandedId === order.id;
                            const transitions = NEXT_STATUS[order.status] || [];
                            const name = order.buyer_name || order.customer_name || "Cliente";
                            const email = order.buyer_email || order.customer_email || "";
                            const labelResult = labelResults[order.id];
                            const etiquetaUrl = order.etiqueta_url || labelResult?.url;
                            const trackingCode = order.codigo_rastreio || labelResult?.tracking;
                            const shipmentId = order.shipment_id || labelResult?.shipment;
                            const canGenerateLabel = ["paid","shipped","erro_envio","ERRO_ENVIO"].includes(order.status);

                            return (
                                <div key={order.id} className={`${pedidoStyles.orderCard} ${isExpanded ? pedidoStyles.orderCardExpanded : ""}`}>
                                    <div className={pedidoStyles.orderRowHeader} onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                                        <div className={pedidoStyles.orderMainInfo}>
                                            <div className={pedidoStyles.orderIdBox}>
                                                <span>Pedido</span>
                                                <strong>#{order.id}</strong>
                                            </div>
                                            <div className={pedidoStyles.customerBrief}>
                                                <h3 title={name}>{name}</h3>
                                                <p>{email}</p>
                                                {order.payment_method === 'mercadolivre' ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: "0.72rem", backgroundColor: "#fef08a", border: "1px solid #fde047", padding: "2px 8px", borderRadius: "8px", color: "#854d0e", fontWeight: 700, marginTop: "2px", marginBottom: "2px" }}>
                                                        🟡 Mercado Livre {order.mercadopago_payment_id ? `· Transação #${order.mercadopago_payment_id}` : ""}
                                                    </span>
                                                ) : order.payment_method === 'shopee' ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: "0.72rem", backgroundColor: "#ffedd5", border: "1px solid #fed7aa", padding: "2px 8px", borderRadius: "8px", color: "#c2410c", fontWeight: 700, marginTop: "2px", marginBottom: "2px" }}>
                                                        🟠 Shopee {order.mercadopago_payment_id ? `· #${order.mercadopago_payment_id}` : ""}
                                                    </span>
                                                ) : order.payment_method === 'whatsapp' ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: "0.72rem", backgroundColor: "#dcfce7", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: "8px", color: "#15803d", fontWeight: 700, marginTop: "2px", marginBottom: "2px" }}>
                                                        💬 WhatsApp
                                                    </span>
                                                ) : order.payment_method === 'balcao' ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: "0.72rem", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", padding: "2px 8px", borderRadius: "8px", color: "#334155", fontWeight: 700, marginTop: "2px", marginBottom: "2px" }}>
                                                        🏪 Balcão / Loja Física
                                                    </span>
                                                ) : order.payment_method ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: "0.7rem", backgroundColor: "#e2e8f0", padding: "2px 6px", borderRadius: "8px", color: "#475569", fontWeight: 700, marginTop: "2px", marginBottom: "2px" }}>
                                                        🟢 Loja Virtual (Via {order.payment_method === 'mercadopago' ? 'Mercado Pago' : order.payment_method === 'mercadopago_pix' ? 'PIX' : order.payment_method === 'mercadopago_card' ? 'Cartão' : order.payment_method})
                                                    </span>
                                                ) : null}
                                                {trackingCode && (
                                                    <p style={{ color: "#2563eb", fontSize: "0.75rem", marginTop: "2px" }}>
                                                        🔍 Rastreio: <strong>{trackingCode}</strong>
                                                    </p>
                                                )}
                                                {order.customer_phone && (
                                                    <a 
                                                        href={`https://wa.me/${order.customer_phone.replace(/\D/g, '')}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '4px', 
                                                            color: '#25D366', 
                                                            fontWeight: 'bold',
                                                            textDecoration: 'none',
                                                            fontSize: '0.75rem',
                                                            marginTop: '2px'
                                                        }}
                                                    >
                                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.393 0 12.03c0 2.123.544 4.197 1.582 6.033L0 24l6.105-1.602a11.83 11.83 0 005.937 1.598h.005c6.637 0 12.032-5.395 12.034-12.03a11.83 11.83 0 00-3.489-8.452z"/>
                                                        </svg>
                                                        {order.customer_phone}
                                                    </a>
                                                )}
                                                <div className={pedidoStyles.orderDate}>
                                                    {order.created_at ? new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={pedidoStyles.orderRightSide}>
                                            <div className={pedidoStyles.orderValueTotal}>
                                                <span>Total</span>
                                                <strong>R$ {Number(order.total || 0).toFixed(2).replace(".", ",")}</strong>
                                            </div>
                                            <div className={pedidoStyles.badge} style={{ background: `${statusInfo.color}15`, color: statusInfo.color, border: `1px solid ${statusInfo.color}30` }}>
                                                <StatusIcon size={14} /> {statusInfo.label}
                                            </div>
                                            <div style={{ color: "#cbd5e1" }}>
                                                {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className={pedidoStyles.expandedContent}>
                                            <div className={pedidoStyles.orderDetailGrid}>

                                                {/* Timeline */}
                                                <div className={pedidoStyles.orderTimelineSection}>
                                                    <h4 className={pedidoStyles.sectionTitle}>📍 Status do Pedido</h4>
                                                    <div className={pedidoStyles.timeline}>
                                                        {["pending","paid","shipped","delivered"].map((s, i, arr) => {
                                                            const currentIdx = ["pending","paid","shipped","delivered"].indexOf(order.status);
                                                            const isActive = i <= currentIdx && !["cancelled","payment_error"].includes(order.status);
                                                            const SIcon = STATUS_LABELS[s].icon;
                                                            return (
                                                                <div key={s} className={`${pedidoStyles.timelineItem} ${isActive ? pedidoStyles.timelineActive : ""}`}>
                                                                    <div className={pedidoStyles.timelineNode}><SIcon size={14} /></div>
                                                                    <div className={pedidoStyles.timelineLabel}>{STATUS_LABELS[s].label}</div>
                                                                    {i < arr.length - 1 && <div className={pedidoStyles.timelineConnector}></div>}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Melhor Envio Info */}
                                                    {(shipmentId || trackingCode) && (
                                                        <div style={{ marginTop: "1.5rem", background: "#eff6ff", borderRadius: "10px", padding: "1rem", fontSize: "0.8rem" }}>
                                                            <p style={{ fontWeight: 700, color: "#1e40af", marginBottom: "0.5rem" }}>📦 Melhor Envio</p>
                                                            {shipmentId && (
                                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                                                    <span style={{ color: "#64748b" }}>ID do Envio:</span>
                                                                    <span style={{ fontFamily: "monospace", color: "#1e293b", display: "flex", alignItems: "center", gap: "4px" }}>
                                                                        {shipmentId.slice(0, 18)}...
                                                                        <Copy size={12} style={{ cursor: "pointer", color: "#64748b" }} onClick={(e) => { e.stopPropagation(); copyToClipboard(shipmentId); }} />
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {trackingCode && (
                                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                                    <span style={{ color: "#64748b" }}>Rastreio:</span>
                                                                    <span style={{ fontFamily: "monospace", color: "#1e40af", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                                                                        {trackingCode}
                                                                        <Copy size={12} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); copyToClipboard(trackingCode); }} />
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Informações de Venda Externa / Mercado Livre */}
                                                    {order.payment_method === 'mercadolivre' && (
                                                        <div style={{ marginTop: "1rem", background: "#fef9c3", border: "1px solid #fde047", borderRadius: "10px", padding: "0.85rem 1rem", fontSize: "0.82rem", color: "#713f12" }}>
                                                            <p style={{ fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: "6px" }}>
                                                                🟡 Venda Concluída no Mercado Livre
                                                            </p>
                                                            <p style={{ margin: "0 0 6px" }}>
                                                                O pagamento foi aprovado pelo Mercado Pago. O envio e a etiqueta fiscal/correios são gerenciados diretamente pelo <strong>Mercado Envios</strong> dentro do painel do Mercado Livre.
                                                            </p>
                                                            {order.mercadopago_payment_id && (
                                                                <p style={{ margin: 0, fontFamily: "monospace", fontSize: "0.8rem", color: "#854d0e" }}>
                                                                    Transação / ID MP: <strong>{order.mercadopago_payment_id}</strong>
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Itens + Resumo */}
                                                <div className={pedidoStyles.itemsSection}>
                                                    <h4 className={pedidoStyles.sectionTitle}>🛒 Itens do Pedido</h4>
                                                    <div className={pedidoStyles.itemList}>
                                                        {(order.items || []).map((item: any, i: number) => (
                                                            <div key={i} className={pedidoStyles.itemRow}>
                                                                <span>{item.quantity}x {item.product_name}</span>
                                                                <span style={{ fontWeight: 600 }}>R$ {(item.price * item.quantity).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className={pedidoStyles.summarySection}>
                                                        <h5 className={pedidoStyles.miniSectionTitle}>Resumo Financeiro</h5>
                                                        <div className={pedidoStyles.summaryRow}>
                                                            <span>Subtotal</span>
                                                            <span>R$ {(order.total - order.shipping_price + (order.discount_amount || 0)).toFixed(2)}</span>
                                                        </div>
                                                        <div className={pedidoStyles.summaryRow}>
                                                            <span>Frete ({order.shipping_method || "—"})</span>
                                                            <span>
                                                                {Number(order.shipping_price || 0) === 0
                                                                    ? <strong style={{ color: "#059669" }}>GRÁTIS (cliente)</strong>
                                                                    : `R$ ${Number(order.shipping_price || 0).toFixed(2)}`
                                                                }
                                                            </span>
                                                        </div>
                                                        {Number(order.shipping_price || 0) === 0 && (order.shipment_id || order.etiqueta_url) && (
                                                            <div style={{ background: "#eff6ff", borderRadius: "8px", padding: "6px 10px", fontSize: "0.75rem", color: "#1e40af", marginTop: "4px", border: "1px solid #bfdbfe" }}>
                                                                ℹ️ Frete grátis para o cliente — custo real processado internamente via Melhor Envio (admin paga).
                                                            </div>
                                                        )}
                                                        {(order.discount_amount || 0) > 0 && (
                                                            <div className={pedidoStyles.summaryRow} style={{ color: "#059669" }}>
                                                                <span>Desconto {order.coupon_code ? `(${order.coupon_code})` : ""}</span>
                                                                <span>-R$ {Number(order.discount_amount).toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        <div className={pedidoStyles.summaryTotal}>
                                                            <span>Total Final</span>
                                                            <span>R$ {Number(order.total || 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Dados do Destinatário */}
                                            <div className={pedidoStyles.customerInfo}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                                    <h4 className={pedidoStyles.sectionTitle} style={{ margin: 0 }}>👤 Dados de Entrega</h4>
                                                    {editingAddressId !== order.id && order.address && (
                                                        <button 
                                                            onClick={() => handleEditAddress(order.id, order.address)} 
                                                            style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, textDecoration: "underline" }}
                                                        >
                                                            Editar Endereço
                                                        </button>
                                                    )}
                                                </div>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.85rem" }}>
                                                    <div>
                                                        <strong>Nome:</strong> {name}<br />
                                                        <strong>E-mail:</strong> {email}<br />
                                                        {order.customer_phone && (
                                                            <>
                                                                <strong>Tel:</strong> 
                                                                <a 
                                                                    href={`https://wa.me/${order.customer_phone.replace(/\D/g, '')}`} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    style={{ 
                                                                        display: 'inline-flex', 
                                                                        alignItems: 'center', 
                                                                        gap: '4px', 
                                                                        color: '#25D366', 
                                                                        fontWeight: 'bold',
                                                                        textDecoration: 'none',
                                                                        marginLeft: '4px'
                                                                    }}
                                                                >
                                                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.393 0 12.03c0 2.123.544 4.197 1.582 6.033L0 24l6.105-1.602a11.83 11.83 0 005.937 1.598h.005c6.637 0 12.032-5.395 12.034-12.03a11.83 11.83 0 00-3.489-8.452z"/>
                                                                    </svg>
                                                                    {order.customer_phone}
                                                                </a>
                                                                <br />
                                                            </>
                                                        )}
                                                        {order.customer_cpf && <><strong>CPF:</strong> {order.customer_cpf}<br /></>}
                                                    </div>
                                                    {editingAddressId === order.id ? (
                                                        <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "8px" }}>
                                                                <input placeholder="CEP" value={addressForm.postal_code} onChange={e => setAddressForm({...addressForm, postal_code: e.target.value})} style={{ padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "4px", gridColumn: "span 2" }} />
                                                                <input placeholder="Rua" value={addressForm.street} onChange={e => setAddressForm({...addressForm, street: e.target.value})} style={{ padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "4px", gridColumn: "span 2" }} />
                                                                <input placeholder="Número" value={addressForm.number} onChange={e => setAddressForm({...addressForm, number: e.target.value})} style={{ padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "4px" }} />
                                                                <input placeholder="Complemento" value={addressForm.complement} onChange={e => setAddressForm({...addressForm, complement: e.target.value})} style={{ padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "4px" }} />
                                                                <input placeholder="Bairro" value={addressForm.neighborhood} onChange={e => setAddressForm({...addressForm, neighborhood: e.target.value})} style={{ padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "4px", gridColumn: "span 2" }} />
                                                                <input placeholder="Cidade" value={addressForm.city} onChange={e => setAddressForm({...addressForm, city: e.target.value})} style={{ padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "4px" }} />
                                                                <input placeholder="UF" value={addressForm.state} onChange={e => setAddressForm({...addressForm, state: e.target.value})} style={{ padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "4px" }} maxLength={2} />
                                                            </div>
                                                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                                                <button onClick={() => setEditingAddressId(null)} style={{ padding: "4px 10px", background: "#e2e8f0", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Cancelar</button>
                                                                <button onClick={() => saveAddress(order.id)} disabled={savingAddress} style={{ padding: "4px 10px", background: "#059669", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>
                                                                    {savingAddress ? "Salvando..." : "Salvar"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : order.address ? (
                                                        <div style={{ color: "#4b5563" }}>
                                                            <strong style={{ color: "#111" }}>Endereço:</strong><br />
                                                            {order.address.street}, {order.address.number}
                                                            {order.address.complement ? ` - ${order.address.complement}` : ""}<br />
                                                            {order.address.neighborhood} — {order.address.city}/{order.address.state}<br />
                                                            CEP: {order.address.postal_code || order.address.cep || order.address.zip}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {/* Configuração da Embalagem e Transportadora (apenas pedidos da loja que ainda NÃO foram enviados) */}
                                            {order.payment_method !== 'mercadolivre' && !['shipped', 'delivered'].includes(order.status) && (() => {
                                                const pkg = getPackageForm(order);
                                                return (
                                                    <div style={{
                                                        background: "#f8fafc",
                                                        border: "1px solid #e2e8f0",
                                                        borderRadius: "8px",
                                                        padding: "12px 14px",
                                                        marginBottom: "12px"
                                                    }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                                            <strong style={{ fontSize: "0.85rem", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                                                                📦 Embalagem & Transportadora ({pkg.serviceName})
                                                                {order.shipment_id && !order.etiqueta_url && (
                                                                    <span style={{ fontSize: "0.72rem", background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                                                                        🛒 No Carrinho ME
                                                                    </span>
                                                                )}
                                                            </strong>
                                                            <div style={{ display: "flex", gap: "6px" }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuoteOrder(order.id)}
                                                                    disabled={quotingOrderId === order.id}
                                                                    style={{
                                                                        background: "#fff",
                                                                        border: "1px solid #cbd5e1",
                                                                        borderRadius: "4px",
                                                                        padding: "3px 8px",
                                                                        fontSize: "0.75rem",
                                                                        cursor: "pointer",
                                                                        color: "#334155",
                                                                        fontWeight: 600
                                                                    }}
                                                                    title="Cotar valores reais para o CEP do pedido"
                                                                >
                                                                    {quotingOrderId === order.id ? "Cotando..." : "⚡ Cotar Frete"}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openShippingModal(order)}
                                                                    style={{
                                                                        background: "#059669",
                                                                        border: "none",
                                                                        borderRadius: "4px",
                                                                        padding: "3px 8px",
                                                                        fontSize: "0.75rem",
                                                                        color: "#fff",
                                                                        fontWeight: 600,
                                                                        cursor: "pointer"
                                                                    }}
                                                                    title="Abrir modal de configuração e envio"
                                                                >
                                                                    🚀 Mandar ao Melhor Envio
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Dimensões e Peso */}
                                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "8px", marginBottom: "10px" }}>
                                                            <div>
                                                                <label style={{ fontSize: "0.72rem", color: "#64748b", display: "block", marginBottom: "2px" }}>Comprimento (cm)</label>
                                                                <input
                                                                    type="number"
                                                                    min="5"
                                                                    max="150"
                                                                    value={pkg.length ?? ""}
                                                                    onChange={e => updatePackageField(order.id, "length", e.target.value === "" ? "" : Number(e.target.value))}
                                                                    style={{ width: "100%", padding: "5px 8px", fontSize: "0.82rem", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box" }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: "0.72rem", color: "#64748b", display: "block", marginBottom: "2px" }}>Largura (cm)</label>
                                                                <input
                                                                    type="number"
                                                                    min="5"
                                                                    max="150"
                                                                    value={pkg.width ?? ""}
                                                                    onChange={e => updatePackageField(order.id, "width", e.target.value === "" ? "" : Number(e.target.value))}
                                                                    style={{ width: "100%", padding: "5px 8px", fontSize: "0.82rem", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box" }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: "0.72rem", color: "#64748b", display: "block", marginBottom: "2px" }}>Altura (cm)</label>
                                                                <input
                                                                    type="number"
                                                                    min="2"
                                                                    max="150"
                                                                    value={pkg.height ?? ""}
                                                                    onChange={e => updatePackageField(order.id, "height", e.target.value === "" ? "" : Number(e.target.value))}
                                                                    style={{ width: "100%", padding: "5px 8px", fontSize: "0.82rem", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box" }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: "0.72rem", color: "#64748b", display: "block", marginBottom: "2px" }}>Peso (kg)</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.05"
                                                                    min="0.1"
                                                                    max="50"
                                                                    value={pkg.weight ?? ""}
                                                                    onChange={e => updatePackageField(order.id, "weight", e.target.value === "" ? "" : Number(e.target.value))}
                                                                    style={{ width: "100%", padding: "5px 8px", fontSize: "0.82rem", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box" }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Seletor de Transportadora */}
                                                        <div>
                                                            <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block" }}>Transportadora / Serviço</label>
                                                            <select
                                                                value={pkg.serviceId}
                                                                onChange={e => {
                                                                    const sId = Number(e.target.value);
                                                                    const found = CARRIER_SERVICES.find(c => c.id === sId);
                                                                    updatePackageField(order.id, "serviceId", sId);
                                                                    if (found) {
                                                                        updatePackageField(order.id, "serviceName", found.name);
                                                                    }
                                                                }}
                                                                style={{ width: "100%", padding: "4px 6px", fontSize: "0.8rem", border: "1px solid #cbd5e1", borderRadius: "4px", background: "#fff" }}
                                                            >
                                                                {CARRIER_SERVICES.map(srv => {
                                                                    const quoteOpt = quotes[order.id]?.find((q: any) => q.id === srv.id);
                                                                    return (
                                                                        <option key={srv.id} value={srv.id}>
                                                                            {srv.icon} {srv.name} — {srv.badge} {quoteOpt ? `[R$ ${Number(quoteOpt.price).toFixed(2)}]` : ""}
                                                                        </option>
                                                                    );
                                                                })}
                                                            </select>
                                                            {order.shipping_method && (
                                                                <span style={{ fontSize: "0.7rem", color: "#166534", display: "block", marginTop: "3px", fontWeight: 500 }}>
                                                                    🚚 Opção escolhida pelo cliente: <strong>{order.shipping_method}</strong> (R$ {Number(order.shipping_price || 0).toFixed(2)})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Ações */}
                                            <div className={pedidoStyles.actionFooter}>
                                                {/* Extrair PDF */}
                                                <button
                                                    onClick={() => downloadOrderPdf(order.id)}
                                                    disabled={downloadingPdf === order.id}
                                                    className={`${pedidoStyles.btnAction} ${pedidoStyles.btnSecondary}`}
                                                    title="Extrair dados do pedido em PDF"
                                                >
                                                    {downloadingPdf === order.id ? (
                                                        <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Extraindo...</>
                                                    ) : (
                                                        <><Download size={14} /> Extrair PDF</>
                                                    )}
                                                </button>

                                                {/* Etiqueta */}
                                                {order.payment_method === 'mercadolivre' ? (
                                                    <a
                                                        href="https://www.mercadolivre.com.br/vendas/lista"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={pedidoStyles.btnAction}
                                                        style={{
                                                             background: "#ffe600",
                                                             color: "#2d3277",
                                                             borderColor: "#ffe600",
                                                             fontWeight: 700,
                                                             textDecoration: "none",
                                                             display: "inline-flex",
                                                             alignItems: "center",
                                                             gap: "6px"
                                                         }}
                                                         title="Gerenciar envio e imprimir etiqueta no Mercado Envios / Mercado Livre"
                                                    >
                                                         🟡 Etiqueta no Mercado Envios (ML) <ExternalLink size={14} />
                                                    </a>
                                                ) : etiquetaUrl ? (
                                                    <>
                                                        <button
                                                            onClick={() => window.open(etiquetaUrl, "_blank")}
                                                            className={`${pedidoStyles.btnAction} ${pedidoStyles.btnPrimary}`}
                                                        >
                                                            <Download size={14} /> Baixar Etiqueta
                                                        </button>
                                                        <button
                                                            onClick={() => openShippingModal(order)}
                                                            disabled={generatingLabel === order.id}
                                                            className={`${pedidoStyles.btnAction} ${pedidoStyles.btnSecondary}`}
                                                            title="Reenviar pedido ao Melhor Envio e gerar nova etiqueta"
                                                        >
                                                            <RefreshCw size={14} />
                                                            {generatingLabel === order.id ? "Processando..." : "Reenviar ao Melhor Envio"}
                                                        </button>
                                                    </>
                                                ) : canGenerateLabel && (
                                                    <button
                                                        onClick={() => openShippingModal(order)}
                                                        disabled={generatingLabel === order.id}
                                                        className={`${pedidoStyles.btnAction} ${pedidoStyles.btnPrimary}`}
                                                        style={{ position: "relative" }}
                                                    >
                                                        {generatingLabel === order.id ? (
                                                            <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Processando...</>
                                                        ) : order.shipment_id ? (
                                                            <><Tag size={14} /> Verificar / Gerar Etiqueta ME</>
                                                        ) : (
                                                            <><Tag size={14} /> Mandar p/ Carrinho Melhor Envio</>
                                                        )}
                                                    </button>
                                                )}

                                                {/* Rastrear no ME */}
                                                {trackingCode && (
                                                    <a
                                                        href={`https://melhorrastreio.com.br/rastreio/${trackingCode}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`${pedidoStyles.btnAction} ${pedidoStyles.btnSecondary}`}
                                                        style={{ textDecoration: "none" }}
                                                    >
                                                        <MapPin size={14} /> Rastrear Envio
                                                    </a>
                                                )}

                                                {/* Sincronizar com ME */}
                                                {shipmentId && (
                                                    <button
                                                        onClick={() => handleSyncME(order.id)}
                                                        disabled={syncingME === order.id}
                                                        className={`${pedidoStyles.btnAction} ${pedidoStyles.btnSecondary}`}
                                                        title="Consultar status e rastreio no Melhor Envio"
                                                    >
                                                        {syncingME === order.id ? (
                                                            <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Sincronizando...</>
                                                        ) : (
                                                            <><RefreshCw size={14} /> Sincronizar ME</>
                                                        )}
                                                    </button>
                                                )}


                                                {/* Transições de Status */}
                                                {transitions.map(ns => {
                                                    const isRevert = ns === "paid" && ["erro_envio", "ERRO_ENVIO"].includes(order.status);
                                                    const label = isRevert ? "Reverter para Pago" : `Marcar como ${STATUS_LABELS[ns]?.label || ns}`;
                                                    return (
                                                        <button
                                                            key={ns}
                                                            onClick={() => updateStatus(order.id, ns)}
                                                            disabled={updatingStatus === order.id}
                                                            className={`${pedidoStyles.btnAction} ${isRevert ? pedidoStyles.btnPrimary : pedidoStyles.btnSecondary}`}
                                                            style={{ 
                                                                color: isRevert ? "#ffffff" : STATUS_LABELS[ns]?.color,
                                                                backgroundColor: isRevert ? "#10b981" : undefined,
                                                                borderColor: isRevert ? "#10b981" : undefined
                                                            }}
                                                        >
                                                            {updatingStatus === order.id ? "..." : label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <footer className={pedidoStyles.clearSection}>
                    <p style={{ fontSize: "0.875rem", color: "#ef4444" }}>Zona de Perigo</p>
                    <button onClick={handleClearAll} className={pedidoStyles.btnClear}>
                        <XCircle size={16} /> Zerar Histórico de Pedidos
                    </button>
                    <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.5rem" }}>
                        Esta ação removerá todos os pedidos permanentemente. Use apenas para limpeza de testes.
                    </p>
                </footer>

                {/* Modal de Cadastro de Venda Externa */}
                {showExternalModal && (
                    <div style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: "1rem"
                    }} onClick={() => setShowExternalModal(false)}>
                        <div style={{
                            backgroundColor: "#ffffff",
                            borderRadius: "16px",
                            maxWidth: "520px",
                            width: "100%",
                            maxHeight: "90vh",
                            overflowY: "auto",
                            padding: "1.75rem",
                            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
                        }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <PlusCircle size={20} color="#f59e0b" /> Lançar Venda Externa
                                    </h3>
                                    <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                                        Cadastre vendas do Mercado Livre, Shopee, WhatsApp ou Balcão para manter o histórico e faturamento consolidados.
                                    </p>
                                </div>
                                <button onClick={() => setShowExternalModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px" }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateExternalOrder} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                                        Canal de Venda
                                    </label>
                                    <select
                                        value={externalForm.channel}
                                        onChange={(e) => {
                                            const ch = e.target.value;
                                            setExternalForm(prev => ({
                                                ...prev,
                                                channel: ch,
                                                customer_name: ch === "mercadolivre" ? "Comprador Mercado Livre" : ch === "shopee" ? "Comprador Shopee" : prev.customer_name,
                                                notes: ch === "mercadolivre" ? "Venda externa. Etiqueta gerada pelo Mercado Envios." : prev.notes
                                            }));
                                        }}
                                        style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", backgroundColor: "#fff" }}
                                    >
                                        <option value="mercadolivre">🟡 Mercado Livre</option>
                                        <option value="shopee">🟠 Shopee</option>
                                        <option value="whatsapp">💬 WhatsApp / Pedido Direto</option>
                                        <option value="balcao">🏪 Balcão / Loja Física</option>
                                        <option value="outro">📦 Outro Canal</option>
                                    </select>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                                            ID da Transação / Pedido
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: 181368521047"
                                            value={externalForm.transaction_id}
                                            onChange={(e) => setExternalForm({ ...externalForm, transaction_id: e.target.value })}
                                            style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                                            Nome do Cliente
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ex: Comprador Mercado Livre"
                                            value={externalForm.customer_name}
                                            onChange={(e) => setExternalForm({ ...externalForm, customer_name: e.target.value })}
                                            style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                                        Produto / Descrição dos Itens
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Óleo Vegetal De Rosa Mosqueta Rubiginosa 100% Puro"
                                        value={externalForm.product_name}
                                        onChange={(e) => setExternalForm({ ...externalForm, product_name: e.target.value })}
                                        style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
                                    />
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                                            Quantidade
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            value={externalForm.quantity}
                                            onChange={(e) => setExternalForm({ ...externalForm, quantity: Number(e.target.value) || 1 })}
                                            style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                                            Valor Total (R$)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            required
                                            value={externalForm.total}
                                            onChange={(e) => setExternalForm({ ...externalForm, total: Number(e.target.value) || 0 })}
                                            style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                                        Observações / Envio
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Envio gerenciado pelo Mercado Envios"
                                        value={externalForm.notes}
                                        onChange={(e) => setExternalForm({ ...externalForm, notes: e.target.value })}
                                        style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
                                    />
                                </div>

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "0.5rem" }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowExternalModal(false)}
                                        style={{ padding: "0.6rem 1.25rem", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f8fafc", color: "#475569", fontWeight: 600, cursor: "pointer" }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingExternal}
                                        style={{ padding: "0.6rem 1.5rem", borderRadius: "8px", border: "none", background: "#f59e0b", color: "#ffffff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                    >
                                        {savingExternal ? (
                                            <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Salvando...</>
                                        ) : (
                                            "Cadastrar Venda"
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal de Configuração de Embalagem & Envio ao Melhor Envio */}
                {shippingModalOrder && modalPackage && (() => {
                    const order = shippingModalOrder;
                    const pkg = modalPackage;
                    const isAlreadyShipped = ['shipped', 'delivered'].includes(order.status) || Boolean(order.etiqueta_url);
                    const customerChosenCarrier = order.shipping_method || "Correios PAC";
                    const customerName = order.buyer_name || order.customer_name || "Cliente";
                    const isProcessing = generatingLabel === order.id;

                    return (
                        <div style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "rgba(0, 0, 0, 0.55)",
                            backdropFilter: "blur(4px)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 9999,
                            padding: "1rem"
                        }} onClick={closeShippingModal}>
                            <div style={{
                                backgroundColor: "#ffffff",
                                borderRadius: "16px",
                                maxWidth: "560px",
                                width: "100%",
                                maxHeight: "92vh",
                                overflowY: "auto",
                                padding: "1.75rem",
                                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "1.2rem"
                            }} onClick={e => e.stopPropagation()}>
                                {/* Cabeçalho do Modal */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                                            📦 {isAlreadyShipped ? "Mandar Mais Uma Etiqueta" : "Enviar ao Melhor Envio"} · Pedido #{order.id}
                                        </h3>
                                        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                                            {customerName} · Total: R$ {Number(order.total || 0).toFixed(2).replace(".", ",")}
                                            {order.address?.city && ` · ${order.address.city}/${order.address.state || ""}`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={closeShippingModal}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px" }}
                                        title="Fechar"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Destaque da escolha do cliente */}
                                <div style={{
                                    background: "#f0fdf4",
                                    border: "1px solid #bbf7d0",
                                    borderRadius: "10px",
                                    padding: "10px 14px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px"
                                }}>
                                    <Truck size={22} color="#15803d" style={{ flexShrink: 0 }} />
                                    <div style={{ fontSize: "0.82rem", color: "#166534" }}>
                                        <div style={{ fontWeight: 600 }}>Transportadora escolhida pelo cliente:</div>
                                        <div style={{ fontSize: "0.92rem", fontWeight: 800, marginTop: "2px", color: "#14532d" }}>
                                            {customerChosenCarrier} {order.shipping_price ? `(R$ ${Number(order.shipping_price).toFixed(2).replace(".", ",")})` : ""}
                                        </div>
                                    </div>
                                </div>

                                {/* Alerta explicativo se já tiver sido enviado antes */}
                                {isAlreadyShipped && (
                                    <div style={{
                                        background: "#fffbeb",
                                        border: "1px solid #fde68a",
                                        borderRadius: "10px",
                                        padding: "10px 14px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px"
                                    }}>
                                        <AlertTriangle size={20} color="#b45309" style={{ flexShrink: 0 }} />
                                        <div style={{ fontSize: "0.78rem", color: "#92400e" }}>
                                            Este pedido já possui uma etiqueta gerada. Se você mudar a embalagem ou transportadora, poderá mandar <strong>mais uma etiqueta</strong> para o carrinho do seu Melhor Envio, onde você decide se realiza a compra ou não.
                                        </div>
                                    </div>
                                )}

                                {/* Dimensões e Peso pré-preenchidos */}
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                        <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155" }}>
                                            Dimensões da Embalagem & Peso
                                        </label>
                                        <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                                            Padrão da loja: 20x16x12 cm
                                        </span>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                                        <div>
                                            <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: "2px" }}>Compr. (cm)</label>
                                            <input
                                                type="number"
                                                min="5"
                                                max="150"
                                                value={modalPackage.length === 0 ? "" : modalPackage.length}
                                                onChange={e => {
                                                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                                                    setModalPackage(prev => prev ? { ...prev, length: val } : null);
                                                }}
                                                style={{ width: "100%", padding: "7px 8px", fontSize: "0.85rem", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: "2px" }}>Largura (cm)</label>
                                            <input
                                                type="number"
                                                min="5"
                                                max="150"
                                                value={modalPackage.width === 0 ? "" : modalPackage.width}
                                                onChange={e => {
                                                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                                                    setModalPackage(prev => prev ? { ...prev, width: val } : null);
                                                }}
                                                style={{ width: "100%", padding: "7px 8px", fontSize: "0.85rem", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: "2px" }}>Altura (cm)</label>
                                            <input
                                                type="number"
                                                min="2"
                                                max="150"
                                                value={modalPackage.height === 0 ? "" : modalPackage.height}
                                                onChange={e => {
                                                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                                                    setModalPackage(prev => prev ? { ...prev, height: val } : null);
                                                }}
                                                style={{ width: "100%", padding: "7px 8px", fontSize: "0.85rem", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: "2px" }}>Peso (kg)</label>
                                            <input
                                                type="number"
                                                step="0.05"
                                                min="0.1"
                                                max="50"
                                                value={modalPackage.weight === 0 ? "" : modalPackage.weight}
                                                onChange={e => {
                                                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                                                    setModalPackage(prev => prev ? { ...prev, weight: val } : null);
                                                }}
                                                style={{ width: "100%", padding: "7px 8px", fontSize: "0.85rem", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box" }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Seleção de Transportadora */}
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                        <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155" }}>
                                            Transportadora / Serviço no Melhor Envio
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => handleQuoteInModal(order)}
                                            disabled={quotingOrderId === order.id}
                                            style={{
                                                background: "#f8fafc",
                                                border: "1px solid #cbd5e1",
                                                borderRadius: "6px",
                                                padding: "3px 8px",
                                                fontSize: "0.72rem",
                                                cursor: "pointer",
                                                color: "#334155",
                                                fontWeight: 600
                                            }}
                                            title="Cotar valores reais para o CEP do pedido"
                                        >
                                            {quotingOrderId === order.id ? "Cotando..." : "⚡ Cotar Frete Agora"}
                                        </button>
                                    </div>
                                    <select
                                        value={modalPackage.serviceId}
                                        onChange={e => {
                                            const sId = Number(e.target.value);
                                            const found = CARRIER_SERVICES.find(c => c.id === sId);
                                            setModalPackage(prev => prev ? {
                                                ...prev,
                                                serviceId: sId,
                                                serviceName: found ? found.name : prev.serviceName
                                            } : null);
                                        }}
                                        style={{ width: "100%", padding: "8px 10px", fontSize: "0.85rem", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff", boxSizing: "border-box" }}
                                    >
                                        {CARRIER_SERVICES.map(srv => {
                                            const quoteOpt = quotes[order.id]?.find((q: any) => q.id === srv.id);
                                            return (
                                                <option key={srv.id} value={srv.id}>
                                                    {srv.icon} {srv.name} — {srv.badge} {quoteOpt ? `[R$ ${Number(quoteOpt.price).toFixed(2)}]` : ""}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                {/* Informação contextual */}
                                <div style={{
                                    fontSize: "0.74rem",
                                    color: "#64748b",
                                    background: "#f8fafc",
                                    border: "1px dashed #cbd5e1",
                                    borderRadius: "8px",
                                    padding: "8px 12px"
                                }}>
                                    💡 O envio será enviado para o carrinho da sua conta no <strong>Melhor Envio</strong>. Lá na plataforma você decide se realiza a compra da etiqueta ou não.
                                </div>

                                {/* Ações do Modal */}
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                                    <button
                                        type="button"
                                        onClick={closeShippingModal}
                                        disabled={isProcessing}
                                        style={{
                                            padding: "0.6rem 1.25rem",
                                            borderRadius: "8px",
                                            border: "1px solid #cbd5e1",
                                            background: "#ffffff",
                                            color: "#475569",
                                            fontWeight: 600,
                                            cursor: "pointer",
                                            fontSize: "0.85rem"
                                        }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSendFromModal(order.id)}
                                        disabled={isProcessing}
                                        style={{
                                            padding: "0.6rem 1.4rem",
                                            borderRadius: "8px",
                                            border: "none",
                                            background: isAlreadyShipped ? "#2563eb" : "#059669",
                                            color: "#ffffff",
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            fontSize: "0.88rem",
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                                        }}
                                    >
                                        {isProcessing ? (
                                            <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Processando...</>
                                        ) : isAlreadyShipped ? (
                                            <><RefreshCw size={16} /> Mandar mais uma etiqueta pro Melhor Envio</>
                                        ) : (
                                            <><Tag size={16} /> Mandar pro Melhor Envio</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                <style>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </main>
        </AdminLayout>
    );
}
