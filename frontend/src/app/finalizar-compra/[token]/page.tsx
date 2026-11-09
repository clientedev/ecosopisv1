"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import CheckoutTransparente from "@/components/CheckoutTransparente/CheckoutTransparente";
import { useAuth } from "@/context/AuthContext";
import styles from "./page.module.css";
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Truck,
  ShieldCheck,
  Tag,
  MapPin,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  Search,
} from "lucide-react";

interface ReviewItem {
  id: number;
  name: string;
  slug?: string;
  price: number;
  quantity: number;
  image_url?: string;
  isWholesale?: boolean;
}

interface CatalogItem {
  id: number;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  is_on_sale: boolean;
  image_url: string;
  is_wholesale: boolean;
  stock: number;
}

const BRAZILIAN_STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

const SOUTH_SOUTHEAST_UFS = ["SP", "RJ", "MG", "ES", "PR", "SC", "RS"];

function resolveProductImageUrl(url?: string): string {
  if (!url) return "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/api/")) return url;
  if (url.startsWith("/static/")) return url;
  if (url.startsWith("/images/")) return `/api${url}`;
  if (url.startsWith("images/")) return `/api/${url}`;
  if (url.startsWith("/attached_assets/")) return `/static${url}`;
  if (url.startsWith("attached_assets/")) return `/static/${url}`;
  if (url.startsWith("/uploads/")) return `/static${url}`;
  if (url.startsWith("uploads/")) return `/static/${url}`;
  return url;
}

function isValidCPF(cpf: string): boolean {
  const clean = (cpf || "").replace(/\D/g, "");
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i), 10) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean.charAt(9), 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i), 10) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(clean.charAt(10), 10);
}

function formatCpf(val: string): string {
  const digits = (val || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function formatCep(val: string): string {
  const digits = (val || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

export default function FinalizarCompraWhatsAppPage() {
  const params = useParams();
  const router = useRouter();
  const { token: authToken, refreshProfile } = useAuth();
  const checkoutToken = String(params?.token || "");

  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);
  const [savingChanges, setSavingChanges] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Dados do Pedido e Catálogo
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [showAddCatalog, setShowAddCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  // Dados Pessoais
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Endereço
  const [cep, setCep] = useState("");
  const [address, setAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "SP",
  });

  // Frete
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<any>(null);
  const [loadingShipping, setLoadingShipping] = useState(false);

  // Cupom
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    type: string;
    value: number;
  } | null>(null);
  const [couponMessage, setCouponMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Ordem & Pagamento
  const [orderCreated, setOrderCreated] = useState<any>(null);
  const [guestAccessToken, setGuestAccessToken] = useState<string | null>(null);
  const [paymentTab, setPaymentTab] = useState<"transparente" | "mercadopago_pro">("transparente");
  const [creatingOrderForPro, setCreatingOrderForPro] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);

  // Carrega dados da sessão de checkout do WhatsApp
  useEffect(() => {
    if (!checkoutToken) return;
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/whatsapp/catalog-checkout/${encodeURIComponent(checkoutToken)}`);
        const data = await res.json();
        if (!res.ok) {
          if (active) setNotFoundError(data?.error || "Link de compra não encontrado.");
          return;
        }
        if (!active) return;

        setItems(Array.isArray(data.items) ? data.items : []);
        setCatalog(Array.isArray(data.catalog) ? data.catalog : []);
        setCustomerName(data.customer_name || "");
        setCustomerEmail(data.customer_email || "");
        setCustomerCpf(formatCpf(data.customer_cpf || ""));
        setCustomerPhone(data.phone || "");

        const rawCep = data.cep || data.address?.postal_code || data.address?.cep || "";
        setCep(formatCep(rawCep));
        setAddress({
          street: data.address?.street || "",
          number: data.address?.number || "",
          complement: data.address?.complement || "",
          neighborhood: data.address?.neighborhood || "",
          city: data.address?.city || "",
          state: data.address?.state || "SP",
        });

        if (data.coupon_code) {
          setCouponInput(data.coupon_code);
        }
        if (data.shipping_method) {
          const parts = String(data.shipping_method).split(" - ");
          const initialOpt = {
            id: data.shipping_service_id || 1,
            company: parts[0] || "Correios",
            name: parts.slice(1).join(" - ") || data.shipping_method,
            price: Number(data.shipping_price || 0),
            delivery_time: 5,
          };
          setShippingOptions([initialOpt]);
          setSelectedShipping(initialOpt);
        }
        if (data.guest_access_token) {
          setGuestAccessToken(data.guest_access_token);
        }
        if (data.status === "paid" && data.order_id) {
          setOrderCompleted(true);
        }
      } catch {
        if (active) setNotFoundError("Não foi possível carregar os dados do seu pedido.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [checkoutToken]);

  // Cálculos de Atacado (10+ itens elegíveis = 45% OFF) e Subtotal
  const wholesaleCount = useMemo(
    () => items.filter((i) => i.isWholesale).reduce((acc, i) => acc + i.quantity, 0),
    [items]
  );
  const isWholesaleEligible = wholesaleCount >= 10;

  const subtotal = useMemo(() => {
    let sum = 0;
    for (const item of items) {
      const unitPrice =
        isWholesaleEligible && item.isWholesale
          ? Math.round(item.price * 0.55 * 100) / 100
          : item.price;
      sum += unitPrice * item.quantity;
    }
    return Math.round(sum * 100) / 100;
  }, [items, isWholesaleEligible]);

  const rawTotalBeforeWholesale = useMemo(
    () => items.reduce((acc, i) => acc + i.price * i.quantity, 0),
    [items]
  );
  const wholesaleSavings = Math.max(
    0,
    Math.round((rawTotalBeforeWholesale - subtotal) * 100) / 100
  );

  // Barra de Progresso de Frete Grátis igual ao /carrinho (por prefixo de CEP ou UF)
  const freeShippingThreshold = useMemo(() => {
    const cleanCep = (cep || "").replace(/\D/g, "");
    if (cleanCep.length === 8) {
      const prefix = parseInt(cleanCep.substring(0, 2), 10);
      if ((prefix >= 1 && prefix <= 39) || (prefix >= 80 && prefix <= 99)) {
        return 148.9;
      }
      return 248.9;
    }
    const uf = (address.state || "SP").toUpperCase();
    return SOUTH_SOUTHEAST_UFS.includes(uf) ? 148.9 : 248.9;
  }, [cep, address.state]);

  const appliesFreeShipping = subtotal >= freeShippingThreshold;

  const missingForFreeShipping = useMemo(() => {
    return Math.max(0, Math.round((freeShippingThreshold - subtotal) * 100) / 100);
  }, [freeShippingThreshold, subtotal]);

  // Identifica a opção mais barata para aplicar o Frete Grátis igual ao /carrinho
  const cheapestOption = useMemo(() => {
    if (!shippingOptions || shippingOptions.length === 0) return null;
    return [...shippingOptions].sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0];
  }, [shippingOptions]);

  // Cálculo de Frete automático ao ter CEP válido e itens (formato exato do /api/shipping/calculate)
  const calculateShippingForCep = useCallback(
    async (cepValue: string) => {
      const cleanCep = (cepValue || "").replace(/\D/g, "");
      if (cleanCep.length !== 8 || items.length === 0) return;

      setLoadingShipping(true);
      try {
        const reqBody = {
          dest_cep: cleanCep,
          items: items.map((item) => {
            const lowerName = (item.name || "").toLowerCase().trim();
            let unitWeight = 0.1;
            if (
              lowerName.includes("sabonete") &&
              (lowerName.includes("líquido") || lowerName.includes("liquido"))
            ) {
              unitWeight = 0.3;
            }
            const unitPrice =
              isWholesaleEligible && item.isWholesale
                ? Math.round(item.price * 0.55 * 100) / 100
                : item.price;
            return {
              id: String(item.id),
              name: item.name,
              width: 16,
              height: 12,
              length: 20,
              weight: unitWeight,
              price: unitPrice,
              quantity: item.quantity,
            };
          }),
        };

        const res = await fetch("/api/shipping/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody),
        });

        let list: any[] = [];
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            list = data;
          }
        }

        // Fallback regional caso o Melhor Envio retorne vazio/503
        if (list.length === 0) {
          const prefix = parseInt(cleanCep.substring(0, 2) || "1", 10);
          const isSP = prefix >= 1 && prefix <= 19;
          const isSouthSoutheast =
            (prefix >= 1 && prefix <= 39) || (prefix >= 80 && prefix <= 99);
          list = [
            {
              id: 1,
              company: "Correios",
              name: "PAC",
              price: isSP ? 16.9 : isSouthSoutheast ? 22.9 : 31.9,
              delivery_time: isSP ? 4 : isSouthSoutheast ? 6 : 9,
            },
            {
              id: 2,
              company: "Correios",
              name: "SEDEX",
              price: isSP ? 21.9 : isSouthSoutheast ? 32.9 : 48.9,
              delivery_time: isSP ? 2 : isSouthSoutheast ? 3 : 5,
            },
          ];
        }

        const sorted = [...list].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        setShippingOptions(sorted);
        if (sorted.length > 0) {
          const cheapest = sorted[0];
          setSelectedShipping((prev: any) => {
            if (prev) {
              const stillExists = sorted.find(
                (o: any) => o.id === prev.id || o.name === prev.name
              );
              if (stillExists) return stillExists;
            }
            return cheapest;
          });
        }
      } catch (err) {
        console.error("Erro ao calcular frete:", err);
      } finally {
        setLoadingShipping(false);
      }
    },
    [items, isWholesaleEligible]
  );

  useEffect(() => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length === 8 && items.length > 0 && !loading) {
      const timer = setTimeout(() => {
        calculateShippingForCep(cleanCep);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [cep, subtotal, items.length, loading, calculateShippingForCep]);

  // Busca endereço automático ao digitar CEP
  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          setAddress((prev) => ({
            ...prev,
            street: data.logradouro || prev.street,
            neighborhood: data.bairro || prev.neighborhood || "Centro",
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
        }
      }
    } catch { }
  };

  // Salva alterações da revisão no banco
  const persistReviewState = useCallback(
    async (overrideFields?: Record<string, any>) => {
      if (!checkoutToken) return;
      setSavingChanges(true);
      try {
        await fetch(`/api/whatsapp/catalog-checkout/${encodeURIComponent(checkoutToken)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: customerName,
            customer_email: customerEmail,
            customer_cpf: customerCpf.replace(/\D/g, ""),
            phone: customerPhone,
            cep: cep.replace(/\D/g, ""),
            address: {
              ...address,
              postal_code: cep.replace(/\D/g, ""),
              cep: cep.replace(/\D/g, ""),
              email: customerEmail,
            },
            items,
            coupon_code: appliedCoupon?.code || "",
            shipping_method: selectedShipping
              ? `${selectedShipping.company || ""} - ${selectedShipping.name || ""}`
              : "",
            shipping_service_id: selectedShipping?.id ? Number(selectedShipping.id) : null,
            shipping_price: selectedShipping ? Number(selectedShipping.price || 0) : 0,
            ...overrideFields,
          }),
        });
        setOrderCreated(null);
        setSaveFeedback("Alterações salvas!");
        setTimeout(() => setSaveFeedback(null), 2500);
      } catch {
      } finally {
        setSavingChanges(false);
      }
    },
    [
      checkoutToken,
      customerName,
      customerEmail,
      customerCpf,
      customerPhone,
      cep,
      address,
      items,
      appliedCoupon,
      selectedShipping,
    ]
  );

  // Manipulação de Itens do Pedido
  const updateItemQty = (id: number, delta: number) => {
    setItems((prev) => {
      const next = prev
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0);
      return next;
    });
    setOrderCreated(null);
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setOrderCreated(null);
  };

  const addProductFromCatalog = (prod: CatalogItem) => {
    const unitPrice =
      prod.is_on_sale && prod.sale_price && prod.sale_price > 0
        ? prod.sale_price
        : prod.price;

    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === prod.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          id: prod.id,
          name: prod.name,
          slug: prod.slug,
          price: unitPrice,
          quantity: 1,
          image_url: prod.image_url,
          isWholesale: prod.is_wholesale,
        },
      ];
    });
    setOrderCreated(null);
  };

  // Aplicação de Cupom
  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponMessage(null);

    if (isWholesaleEligible) {
      setCouponMessage({
        text: "Cupons não são cumulativos com o desconto de 45% de atacado.",
        isError: true,
      });
      return;
    }

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          email: customerEmail.trim() || undefined,
          cpf: customerCpf.replace(/\D/g, "") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponMessage({
          text: data?.detail || "Cupom inválido ou expirado.",
          isError: true,
        });
        return;
      }
      setAppliedCoupon({
        code: data.code,
        type: data.discount_type,
        value: Number(data.discount_value || 0),
      });
      setCouponMessage({
        text: `Cupom ${data.code} aplicado com sucesso!`,
        isError: false,
      });
      setOrderCreated(null);
    } catch {
      setCouponMessage({
        text: "Erro ao validar cupom. Tente novamente.",
        isError: true,
      });
    }
  };

  // Cálculo de Desconto e Total Final
  const discountAmount = useMemo(() => {
    if (!appliedCoupon || isWholesaleEligible) return 0;
    if (appliedCoupon.type === "percentage") {
      return Math.round(((subtotal * appliedCoupon.value) / 100) * 100) / 100;
    }
    if (appliedCoupon.type === "fixed") {
      return Math.min(subtotal, appliedCoupon.value);
    }
    return 0;
  }, [appliedCoupon, subtotal, isWholesaleEligible]);

  const isFreeShippingCoupon = appliedCoupon?.type === "free_shipping";
  const isSelectedShippingFree =
    isFreeShippingCoupon ||
    Boolean(
      appliesFreeShipping &&
        selectedShipping &&
        cheapestOption &&
        (selectedShipping.id === cheapestOption.id ||
          selectedShipping.name === cheapestOption.name)
    );
  const shippingCost = isSelectedShippingFree
    ? 0
    : selectedShipping
      ? Number(selectedShipping.price || 0)
      : 0;

  const finalTotal = Math.max(
    0,
    Math.round((subtotal - discountAmount + shippingCost) * 100) / 100
  );

  // Validação dos campos obrigatórios antes de liberar pagamento
  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (items.length === 0) errs.push("Adicione pelo menos 1 produto ao pedido.");
    if (!customerName || customerName.trim().length < 3) errs.push("Informe seu Nome Completo.");
    if (!customerEmail || !customerEmail.includes("@")) errs.push("Informe um E-mail válido.");
    if (!isValidCPF(customerCpf)) errs.push("Informe um CPF válido (11 dígitos).");
    if (cep.replace(/\D/g, "").length !== 8) errs.push("Informe um CEP válido de 8 dígitos.");
    if (!address.street.trim()) errs.push("Informe a Rua / Logradouro de entrega.");
    if (!address.number.trim()) errs.push("Informe o Número do endereço.");
    if (!address.city.trim() || !address.state.trim()) errs.push("Informe a Cidade e Estado (UF).");
    if (!selectedShipping) errs.push("Selecione uma opção de Frete.");
    return errs;
  }, [items, customerName, customerEmail, customerCpf, cep, address, selectedShipping]);

  const isFormValid = validationErrors.length === 0;

  // Criação do Pedido Oficial no Backend (/api/orders)
  const ensureBackendOrder = useCallback(async (): Promise<any> => {
    if (orderCreated && orderCreated.id) {
      return orderCreated;
    }

    if (!isFormValid) {
      throw new Error(validationErrors[0] || "Preencha todos os dados obrigatórios.");
    }

    const cleanCpf = customerCpf.replace(/\D/g, "");
    const cleanCep = cep.replace(/\D/g, "");

    const orderPayload = {
      items: items.map((item) => ({
        product_id: item.id,
        name: item.name,
        quantity: item.quantity,
        price:
          isWholesaleEligible && item.isWholesale
            ? Math.round(item.price * 0.55 * 100) / 100
            : item.price,
      })),
      total_amount: finalTotal,
      shipping_price: shippingCost,
      shipping_method: selectedShipping
        ? `${selectedShipping.company || ""} - ${selectedShipping.name || ""}`
        : "Correios",
      shipping_service_id: selectedShipping?.id ? Number(selectedShipping.id) : null,
      shipping_address: {
        street: address.street.trim(),
        number: address.number.trim(),
        complement: address.complement.trim(),
        neighborhood: address.neighborhood.trim() || "Centro",
        city: address.city.trim(),
        state: address.state.trim().toUpperCase(),
        postal_code: cleanCep,
        cep: cleanCep,
        email: customerEmail.trim().toLowerCase(),
      },
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim().toLowerCase(),
      customer_phone: customerPhone.trim(),
      customer_cpf: cleanCpf,
      coupon_code: appliedCoupon?.code || null,
      discount_amount: discountAmount,
      cashback_used: 0,
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const effectiveToken = authToken || guestAccessToken;
    if (effectiveToken) {
      headers["Authorization"] = `Bearer ${effectiveToken}`;
    }

    const res = await fetch("/api/orders", {
      method: "POST",
      headers,
      body: JSON.stringify(orderPayload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.detail || "Não foi possível registrar o pedido.");
    }

    if (data.guest_access_token) {
      setGuestAccessToken(data.guest_access_token);
      if (typeof window !== "undefined" && !authToken) {
        localStorage.setItem("token", data.guest_access_token);
        refreshProfile().catch(() => {});
      }
    }

    setOrderCreated(data);

    await persistReviewState({
      order_id: data.id,
      guest_access_token: data.guest_access_token || guestAccessToken,
      status: "order_created",
    });

    return data;
  }, [
    orderCreated,
    isFormValid,
    validationErrors,
    customerCpf,
    cep,
    items,
    isWholesaleEligible,
    finalTotal,
    shippingCost,
    selectedShipping,
    address,
    customerEmail,
    customerName,
    customerPhone,
    appliedCoupon,
    discountAmount,
    authToken,
    guestAccessToken,
    refreshProfile,
    persistReviewState,
  ]);

  // Redirecionamento para Mercado Pago Checkout Pro (inclui Boleto, Saldo MP, etc.)
  const handleMercadoPagoProCheckout = async () => {
    try {
      setCreatingOrderForPro(true);
      const order = await ensureBackendOrder();
      const effectiveToken = authToken || order?.guest_access_token || guestAccessToken;

      const prefHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (effectiveToken) {
        prefHeaders["Authorization"] = `Bearer ${effectiveToken}`;
      }

      const prefRes = await fetch("/api/payment/preference", {
        method: "POST",
        headers: prefHeaders,
        body: JSON.stringify({ order_id: order.id }),
      });
      const prefData = await prefRes.json();
      if (!prefRes.ok || !prefData.init_point) {
        throw new Error(prefData?.detail || "Erro ao gerar link do Mercado Pago.");
      }

      window.location.href = prefData.init_point;
    } catch (err: any) {
      alert(err?.message || "Erro ao iniciar pagamento externo.");
    } finally {
      setCreatingOrderForPro(false);
    }
  };

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((p) => p.name.toLowerCase().includes(q));
  }, [catalog, catalogSearch]);

  if (loading) {
    return (
      <>
        <Header />
        <div
          className={styles.pageWrapper}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "70vh",
          }}
        >
          <Loader2 size={42} color="#2d5a27" className="animate-spin" />
          <p style={{ marginTop: "14px", color: "#2d5a27", fontWeight: 700, fontSize: "1.05rem" }}>
            Carregando seu pedido exclusivo da Ecosopis...
          </p>
        </div>
        <Footer />
      </>
    );
  }

  if (notFoundError) {
    return (
      <>
        <Header />
        <div
          className={styles.pageWrapper}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "70vh",
            padding: "24px",
          }}
        >
          <div
            className={styles.sectionCard}
            style={{ maxWidth: "480px", textAlign: "center", padding: "36px 28px" }}
          >
            <AlertCircle size={48} color="#dc2626" style={{ margin: "0 auto 14px" }} />
            <h2
              style={{
                fontFamily: "var(--font-header)",
                fontSize: "1.35rem",
                fontWeight: 800,
                color: "#1a3a16",
                marginBottom: "8px",
              }}
            >
              Link de Compra Indisponível
            </h2>
            <p style={{ color: "#64748b", marginBottom: "24px", fontSize: "0.95rem" }}>
              {notFoundError}
            </p>
            <Link
              href="/produtos"
              className="btn-primary"
              style={{
                display: "inline-block",
                padding: "13px 26px",
                borderRadius: "12px",
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              Ir para a Loja Ecosopis
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (orderCompleted) {
    return (
      <>
        <Header />
        <div
          className={styles.pageWrapper}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "75vh",
            padding: "24px",
          }}
        >
          <div
            className={styles.sectionCard}
            style={{ maxWidth: "540px", textAlign: "center", padding: "40px 32px" }}
          >
            <CheckCircle2 size={60} color="#16a34a" style={{ margin: "0 auto 16px" }} />
            <h1
              style={{
                fontFamily: "var(--font-header)",
                fontSize: "1.6rem",
                fontWeight: 800,
                color: "#1a3a16",
                marginBottom: "10px",
              }}
            >
              Pedido Confirmado com Sucesso! 🌿
            </h1>
            <p
              style={{
                color: "#475569",
                fontSize: "0.98rem",
                lineHeight: 1.6,
                marginBottom: "24px",
              }}
            >
              Muito obrigado pela sua compra, <strong>{customerName}</strong>! Você receberá as
              atualizações e o código de rastreio diretamente em seu <strong>WhatsApp</strong> e por{" "}
              <strong>E-mail</strong>.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => router.push("/conta?order_success=true")}
                className="btn-primary"
                style={{
                  padding: "13px 24px",
                  borderRadius: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Acompanhar Meu Pedido
              </button>
              <Link
                href="/"
                style={{
                  padding: "13px 24px",
                  background: "#f8fafc",
                  color: "#1a3a16",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "12px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Voltar à Loja
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className={styles.pageWrapper}>
        <div className={styles.container}>
          {/* Barra de etapas idêntica ao restante do site (/carrinho) */}
          <div className={styles.stepsHeader}>
            <div className={`${styles.stepIndicator} ${styles.stepDone}`}>
              <span className={styles.stepNum}>✓</span> Atendimento WhatsApp
            </div>
            <ChevronRight size={16} color="#94a3b8" />
            <div className={`${styles.stepIndicator} ${styles.stepActive}`}>
              <span className={styles.stepNum}>2</span> Revisão & Entrega
            </div>
            <ChevronRight size={16} color="#94a3b8" />
            <div className={`${styles.stepIndicator} ${isFormValid ? styles.stepActive : ""}`}>
              <span className={styles.stepNum}>3</span> Pagamento Seguro
            </div>
          </div>

          {/* Cabeçalho Clean da Página */}
          <div className={styles.heroBanner}>
            <div className={styles.heroBannerLeft}>
              <span className={styles.whatsappBadge}>
                🌿 Pedido via WhatsApp • Checkout Oficial Ecosopis
              </span>
              <h1 className={styles.heroTitle}>Revise e Finalize seu Pedido</h1>
              <p className={styles.heroSubtitle}>
                Confira seus produtos, confirme o endereço de entrega e escolha como prefere pagar.
              </p>
            </div>
            <div className={styles.heroTrustPills}>
              <div className={styles.trustPill}>
                <ShieldCheck size={18} color="#2d5a27" />
                <span>Ambiente 100% Seguro</span>
              </div>
              <div className={styles.trustPill}>
                <Truck size={18} color="#2d5a27" />
                <span>Envio com Rastreio</span>
              </div>
            </div>
          </div>

          {/* Grid Principal: Coluna Esquerda (Produtos, Dados, Endereço, Frete) + Coluna Direita (Resumo & Pagamento) */}
          <div className={styles.checkoutGrid}>
            <div className={styles.leftColumn}>
              {/* 1. SACOLA DE PRODUTOS */}
              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <div className={styles.sectionIcon}>
                      <ShoppingBag size={20} />
                    </div>
                    <div>
                      <h2 className={styles.sectionTitle}>
                        1. Produtos do seu Pedido ({items.reduce((a, b) => a + b.quantity, 0)})
                      </h2>
                      <p className={styles.sectionSubtitle}>
                        Ajuste as quantidades ou adicione mais produtos se desejar
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.addCatalogToggleBtn}
                    onClick={() => setShowAddCatalog((prev) => !prev)}
                  >
                    <Plus size={15} />
                    {showAddCatalog ? "Fechar Catálogo" : "Adicionar mais produtos"}
                  </button>
                </div>

                {/* Barra de Progresso de Frete Grátis igual ao /carrinho */}
                {missingForFreeShipping > 0 && !isFreeShippingCoupon ? (
                  <div className={styles.freeShippingCard}>
                    <p className={styles.freeShippingText}>
                      Faltam <strong>R$ {missingForFreeShipping.toFixed(2).replace(".", ",")}</strong>{" "}
                      para você ganhar <strong>FRETE GRÁTIS</strong>!
                    </p>
                    <div className={styles.freeShippingBarTrack}>
                      <div
                        className={styles.freeShippingBarFill}
                        style={{
                          width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className={styles.freeShippingEarned}>
                    <Truck size={20} />
                    <span>
                      🎉 Parabéns! Você conquistou <strong>FRETE GRÁTIS</strong> neste pedido!
                    </span>
                  </div>
                )}

                {/* Alerta de Atacado igual ao /carrinho */}
                {wholesaleCount > 0 && isWholesaleEligible && (
                  <div className={`${styles.wholesaleBanner} ${styles.wholesaleBannerActive}`}>
                    <span className={styles.wholesaleTag}>🔥 Lote de Fábrica Ativado (45% OFF)</span>
                    <p className={styles.wholesaleText}>
                      Você garantiu <strong>45% de desconto de atacado</strong> (economia de{" "}
                      <strong>R$ {wholesaleSavings.toFixed(2).replace(".", ",")}</strong>)!
                    </p>
                  </div>
                )}
                {wholesaleCount > 0 && !isWholesaleEligible && (
                  <div className={styles.wholesaleBanner}>
                    <span className={styles.wholesaleTag}>⚡ Oportunidade de Atacado</span>
                    <p className={styles.wholesaleText}>
                      Adicione mais <strong>{10 - wholesaleCount} unidades</strong> elegíveis para
                      ativar <strong>45% OFF direto de fábrica</strong>!
                    </p>
                  </div>
                )}

                {/* Lista de Produtos com Fotos */}
                {items.length === 0 ? (
                  <div
                    style={{
                      padding: "28px",
                      textAlign: "center",
                      color: "#64748b",
                      background: "#f8fafc",
                      borderRadius: "14px",
                    }}
                  >
                    Seu carrinho está vazio. Clique em <strong>Adicionar mais produtos</strong> acima
                    para escolher.
                  </div>
                ) : (
                  <div className={styles.itemsList}>
                    {items.map((item) => {
                      const catalogMatch = catalog.find((c) => c.id === item.id);
                      const imgSrc = resolveProductImageUrl(
                        item.image_url || catalogMatch?.image_url
                      );
                      const unitPrice =
                        isWholesaleEligible && item.isWholesale
                          ? Math.round(item.price * 0.55 * 100) / 100
                          : item.price;

                      return (
                        <div key={item.id} className={styles.cartItem}>
                          <div className={styles.itemMain}>
                            <div className={styles.itemThumbWrapper}>
                              <img src={imgSrc} alt={item.name} className={styles.itemThumb} />
                            </div>
                            <div className={styles.itemDetails}>
                              <div className={styles.itemTitleRow}>
                                <h4 className={styles.itemName}>{item.name}</h4>
                                {item.isWholesale && (
                                  <span
                                    className={`${styles.wholesaleBadge} ${isWholesaleEligible ? styles.wholesaleBadgeUnlocked : ""
                                      }`}
                                  >
                                    {isWholesaleEligible ? "ATACADO • 45% OFF" : "ATACADO (MÍN. 10)"}
                                  </span>
                                )}
                              </div>
                              <div className={styles.itemPriceRow}>
                                {isWholesaleEligible && item.isWholesale ? (
                                  <>
                                    <span className={styles.unitPriceOld}>
                                      R$ {item.price.toFixed(2).replace(".", ",")}
                                    </span>
                                    <span className={styles.unitPrice}>
                                      R$ {unitPrice.toFixed(2).replace(".", ",")} / un.
                                    </span>
                                  </>
                                ) : (
                                  <span className={styles.unitPrice}>
                                    R$ {unitPrice.toFixed(2).replace(".", ",")} / un.
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className={styles.itemControls}>
                            <div className={styles.quantityPill}>
                              <button
                                type="button"
                                className={styles.qtyBtn}
                                onClick={() => updateItemQty(item.id, -1)}
                                aria-label="Diminuir quantidade"
                              >
                                <Minus size={14} />
                              </button>
                              <span className={styles.qtyValue}>{item.quantity}</span>
                              <button
                                type="button"
                                className={styles.qtyBtn}
                                onClick={() => updateItemQty(item.id, 1)}
                                aria-label="Aumentar quantidade"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <div className={styles.lineTotal}>
                              R$ {(unitPrice * item.quantity).toFixed(2).replace(".", ",")}
                            </div>

                            <button
                              type="button"
                              className={styles.removeItemBtn}
                              onClick={() => removeItem(item.id)}
                              title="Remover produto"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Gaveta para adicionar mais produtos do catálogo com fotos e busca */}
                {showAddCatalog && (
                  <div className={styles.catalogDrawer}>
                    <div style={{ position: "relative" }}>
                      <Search
                        size={16}
                        color="#94a3b8"
                        style={{ position: "absolute", left: "12px", top: "13px" }}
                      />
                      <input
                        type="text"
                        placeholder="Buscar outro produto da Ecosopis..."
                        className={styles.catalogSearchInput}
                        style={{ paddingLeft: "36px" }}
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                      />
                    </div>
                    <div className={styles.catalogMiniGrid}>
                      {filteredCatalog.map((prod) => {
                        const pPrice =
                          prod.is_on_sale && prod.sale_price ? prod.sale_price : prod.price;
                        return (
                          <div key={prod.id} className={styles.catalogMiniCard}>
                            <img
                              src={resolveProductImageUrl(prod.image_url)}
                              alt={prod.name}
                              className={styles.catalogMiniImg}
                            />
                            <div className={styles.catalogMiniInfo}>
                              <div className={styles.catalogMiniName} title={prod.name}>
                                {prod.name}
                              </div>
                              <div className={styles.catalogMiniPrice}>
                                R$ {Number(pPrice).toFixed(2).replace(".", ",")}
                              </div>
                            </div>
                            <button
                              type="button"
                              className={styles.catalogMiniAddBtn}
                              onClick={() => addProductFromCatalog(prod)}
                            >
                              + Adicionar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* 2. DADOS PESSOAIS */}
              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <div className={styles.sectionIcon}>
                      <User size={20} />
                    </div>
                    <div>
                      <h2 className={styles.sectionTitle}>2. Seus Dados Pessoais</h2>
                      <p className={styles.sectionSubtitle}>
                        Utilizados para emissão da nota, etiqueta de envio e envio do rastreio
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formFieldFull}>
                    <label className={styles.fieldLabel}>Nome Completo *</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setOrderCreated(null);
                      }}
                      placeholder="Ex: Maria da Silva"
                      className={styles.inputField}
                    />
                  </div>

                  <div>
                    <label className={styles.fieldLabel}>CPF (11 dígitos) *</label>
                    <input
                      type="text"
                      value={customerCpf}
                      onChange={(e) => {
                        setCustomerCpf(formatCpf(e.target.value));
                        setOrderCreated(null);
                      }}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      inputMode="numeric"
                      className={`${styles.inputField} ${customerCpf && !isValidCPF(customerCpf) ? styles.inputError : ""
                        }`}
                    />
                  </div>

                  <div>
                    <label className={styles.fieldLabel}>WhatsApp / Telefone *</label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        setOrderCreated(null);
                      }}
                      placeholder="(11) 99999-9999"
                      className={styles.inputField}
                    />
                  </div>

                  <div className={styles.formFieldFull}>
                    <label className={styles.fieldLabel}>Seu melhor E-mail *</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => {
                        setCustomerEmail(e.target.value);
                        setOrderCreated(null);
                      }}
                      placeholder="seuemail@exemplo.com"
                      className={styles.inputField}
                    />
                  </div>
                </div>
              </section>

              {/* 3. ENDEREÇO DE ENTREGA */}
              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <div className={styles.sectionIcon}>
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h2 className={styles.sectionTitle}>3. Endereço de Entrega</h2>
                      <p className={styles.sectionSubtitle}>
                        Confira ou edite onde você deseja receber sua encomenda Ecosopis
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div>
                    <label className={styles.fieldLabel}>CEP *</label>
                    <div className={styles.cepRow}>
                      <input
                        type="text"
                        value={cep}
                        onChange={(e) => {
                          setCep(formatCep(e.target.value));
                          setOrderCreated(null);
                        }}
                        onBlur={handleCepBlur}
                        placeholder="00000-000"
                        maxLength={9}
                        inputMode="numeric"
                        className={styles.inputField}
                      />
                      <button
                        type="button"
                        onClick={handleCepBlur}
                        className={styles.secondaryBtn}
                      >
                        Buscar
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={styles.fieldLabel}>Bairro *</label>
                    <input
                      type="text"
                      value={address.neighborhood}
                      onChange={(e) => {
                        setAddress({ ...address, neighborhood: e.target.value });
                        setOrderCreated(null);
                      }}
                      placeholder="Centro"
                      className={styles.inputField}
                    />
                  </div>

                  <div className={styles.formFieldFull}>
                    <label className={styles.fieldLabel}>Rua / Logradouro *</label>
                    <input
                      type="text"
                      value={address.street}
                      onChange={(e) => {
                        setAddress({ ...address, street: e.target.value });
                        setOrderCreated(null);
                      }}
                      placeholder="Rua, Avenida, Alameda..."
                      className={styles.inputField}
                    />
                  </div>

                  <div>
                    <label className={styles.fieldLabel}>Número *</label>
                    <input
                      type="text"
                      value={address.number}
                      onChange={(e) => {
                        setAddress({ ...address, number: e.target.value });
                        setOrderCreated(null);
                      }}
                      placeholder="Ex: 120"
                      className={styles.inputField}
                    />
                  </div>

                  <div>
                    <label className={styles.fieldLabel}>Complemento (Opcional)</label>
                    <input
                      type="text"
                      value={address.complement}
                      onChange={(e) => {
                        setAddress({ ...address, complement: e.target.value });
                        setOrderCreated(null);
                      }}
                      placeholder="Apto, Bloco, Casa..."
                      className={styles.inputField}
                    />
                  </div>

                  <div>
                    <label className={styles.fieldLabel}>Cidade *</label>
                    <input
                      type="text"
                      value={address.city}
                      onChange={(e) => {
                        setAddress({ ...address, city: e.target.value });
                        setOrderCreated(null);
                      }}
                      placeholder="Sua Cidade"
                      className={styles.inputField}
                    />
                  </div>

                  <div>
                    <label className={styles.fieldLabel}>Estado (UF) *</label>
                    <select
                      value={address.state}
                      onChange={(e) => {
                        setAddress({ ...address, state: e.target.value });
                        setOrderCreated(null);
                      }}
                      className={styles.inputField}
                    >
                      {BRAZILIAN_STATES.map((st) => (
                        <option key={st.uf} value={st.uf}>
                          {st.uf} - {st.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.saveRow}>
                  <button
                    type="button"
                    onClick={() => persistReviewState()}
                    disabled={savingChanges}
                    className={styles.saveBtn}
                  >
                    <RefreshCw size={14} />
                    {savingChanges ? "Salvando..." : "Salvar alterações dos dados"}
                  </button>
                  {saveFeedback && <span className={styles.savedToast}>✓ {saveFeedback}</span>}
                </div>
              </section>

              {/* 4. OPÇÕES DE FRETE E ENTREGA */}
              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <div className={styles.sectionIcon}>
                      <Truck size={20} />
                    </div>
                    <div>
                      <h2 className={styles.sectionTitle}>4. Opção de Frete e Entrega</h2>
                      <p className={styles.sectionSubtitle}>
                        Selecione a modalidade de envio para o CEP {cep || "informado"}
                      </p>
                    </div>
                  </div>
                </div>

                {loadingShipping ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: "#64748b",
                      padding: "14px 4px",
                    }}
                  >
                    <Loader2 size={20} className="animate-spin" color="#2d5a27" />
                    <span>Calculando melhores opções de entrega para o seu CEP...</span>
                  </div>
                ) : shippingOptions.length === 0 ? (
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: "0.9rem",
                      padding: "14px",
                      background: "#f8fafc",
                      borderRadius: "12px",
                    }}
                  >
                    Informe um CEP válido de 8 dígitos acima para calcular as opções de entrega.
                  </div>
                ) : (
                  <div className={styles.shippingList}>
                    {shippingOptions.map((opt, idx) => {
                      const isSelected =
                        selectedShipping &&
                        (selectedShipping.id === opt.id || selectedShipping.name === opt.name);
                      const isOptCheapest =
                        cheapestOption &&
                        (opt.id === cheapestOption.id || opt.name === cheapestOption.name);
                      const optPrice =
                        isFreeShippingCoupon || (appliesFreeShipping && isOptCheapest)
                          ? 0
                          : Number(opt.price || 0);

                      return (
                        <div
                          key={opt.id || idx}
                          onClick={() => {
                            setSelectedShipping(opt);
                            setOrderCreated(null);
                          }}
                          className={`${styles.shippingOption} ${isSelected ? styles.shippingOptionSelected : ""
                            }`}
                        >
                          <div className={styles.shippingOptionLeft}>
                            <div className={styles.radioCircle}>
                              {isSelected && <div className={styles.radioDot} />}
                            </div>
                            <div>
                              <span className={styles.carrierBadge}>
                                {opt.company || "Transportadora"}
                              </span>
                              <div className={styles.shippingName}>{opt.name}</div>
                              <div className={styles.shippingEta}>
                                {opt.delivery_time
                                  ? `Entrega estimada: até ${opt.delivery_time} dias úteis`
                                  : "Envio rápido com código de rastreio"}
                              </div>
                            </div>
                          </div>

                          <div>
                            {optPrice === 0 ? (
                              <span className={styles.shippingPriceFree}>FRETE GRÁTIS</span>
                            ) : (
                              <span className={styles.shippingPrice}>
                                R$ {optPrice.toFixed(2).replace(".", ",")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* COLUNA DIREITA: RESUMO DO PEDIDO, CUPOM & PAGAMENTO */}
            <aside className={styles.rightColumn}>
              <div className={styles.summaryCard}>
                <h3 className={styles.summaryTitle}>
                  <span>Resumo do Pedido</span>
                  <Lock size={18} color="#2d5a27" />
                </h3>

                {/* Campo de Cupom de Desconto igual ao /carrinho */}
                {appliedCoupon ? (
                  <div className={styles.appliedCouponBox}>
                    <span>
                      🏷️ Cupom <strong>{appliedCoupon.code}</strong> ativo
                    </span>
                    <button
                      type="button"
                      className={styles.removeCouponBtn}
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponMessage(null);
                        setOrderCreated(null);
                      }}
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <div className={styles.promoCodeBox}>
                    <Tag size={16} color="#64748b" />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="CUPOM (ex: PRIMEIRACOMPRA)"
                      className={styles.couponInput}
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className={styles.couponApplyBtn}
                    >
                      Aplicar
                    </button>
                  </div>
                )}

                {couponMessage && (
                  <p
                    style={{
                      margin: "-8px 0 14px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: couponMessage.isError ? "#dc2626" : "#15803d",
                    }}
                  >
                    {couponMessage.text}
                  </p>
                )}

                {/* Linhas de Valores */}
                <div className={styles.summaryRow}>
                  <span>Subtotal ({items.reduce((a, b) => a + b.quantity, 0)} itens)</span>
                  <strong style={{ color: "#1e293b" }}>
                    R$ {subtotal.toFixed(2).replace(".", ",")}
                  </strong>
                </div>

                {isWholesaleEligible && wholesaleSavings > 0 && (
                  <div className={`${styles.summaryRow} ${styles.summaryRowDiscount}`}>
                    <span>Desconto Atacado (45% OFF)</span>
                    <span>Applied (-R$ {wholesaleSavings.toFixed(2).replace(".", ",")})</span>
                  </div>
                )}

                {discountAmount > 0 && (
                  <div className={`${styles.summaryRow} ${styles.summaryRowDiscount}`}>
                    <span>Desconto Cupom ({appliedCoupon?.code})</span>
                    <span>- R$ {discountAmount.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}

                <div className={styles.summaryRow}>
                  <span>Frete ({selectedShipping ? selectedShipping.name : "A selecionar"})</span>
                  <strong style={{ color: shippingCost === 0 ? "#15803d" : "#1e293b" }}>
                    {selectedShipping
                      ? shippingCost === 0
                        ? "GRÁTIS"
                        : `R$ ${shippingCost.toFixed(2).replace(".", ",")}`
                      : "—"}
                  </strong>
                </div>

                <div className={styles.totalRow}>
                  <span>Total</span>
                  <span>R$ {finalTotal.toFixed(2).replace(".", ",")}</span>
                </div>

                {/* SEÇÃO DE PAGAMENTO INTEGRADA */}
                <div className={styles.paymentSection}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "12px",
                      fontFamily: "var(--font-header)",
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      color: "#1a3a16",
                    }}
                  >
                    <ShieldCheck size={18} color="#2d5a27" />
                    <span>ESCOLHA COMO PAGAR</span>
                  </div>

                  {!isFormValid ? (
                    <div className={styles.pendingChecklistBox}>
                      <p className={styles.pendingChecklistTitle}>
                        ⚠️ Complete os dados ao lado para liberar o pagamento:
                      </p>
                      <ul className={styles.pendingChecklistItems}>
                        {validationErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <>
                      <div className={styles.paymentTabs}>
                        <button
                          type="button"
                          onClick={() => setPaymentTab("transparente")}
                          className={`${styles.paymentTab} ${paymentTab === "transparente" ? styles.paymentTabActive : ""
                            }`}
                        >
                          PIX, Cartão (até 12x) ou PIX + Cartão
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentTab("mercadopago_pro")}
                          className={`${styles.paymentTab} ${paymentTab === "mercadopago_pro" ? styles.paymentTabActive : ""
                            }`}
                        >
                          Mercado Pago / Boleto
                        </button>
                      </div>

                      {paymentTab === "transparente" ? (
                        <CheckoutTransparente
                          orderData={{
                            orderId: orderCreated?.id || null,
                            items: items.map((item) => ({
                              id: item.id,
                              product_id: item.id,
                              name: item.name,
                              product_name:
                                isWholesaleEligible && item.isWholesale
                                  ? `${item.name} (Atacado)`
                                  : item.name,
                              quantity: item.quantity,
                              price:
                                isWholesaleEligible && item.isWholesale
                                  ? Math.round(item.price * 0.55 * 100) / 100
                                  : item.price,
                            })),
                            total: finalTotal,
                            shippingPrice: shippingCost,
                            shippingMethod: selectedShipping
                              ? `${selectedShipping.company || ""} - ${selectedShipping.name || ""}`
                              : "Correios",
                            shippingServiceId: selectedShipping?.id
                              ? Number(selectedShipping.id)
                              : null,
                            address: {
                              street: address.street.trim(),
                              number: address.number.trim(),
                              complement: address.complement.trim(),
                              neighborhood: address.neighborhood.trim() || "Centro",
                              city: address.city.trim(),
                              state: address.state.trim().toUpperCase(),
                              postal_code: cep.replace(/\D/g, ""),
                              cep: cep.replace(/\D/g, ""),
                              email: customerEmail.trim().toLowerCase(),
                            },
                            customerName: customerName.trim(),
                            customerEmail: customerEmail.trim().toLowerCase(),
                            customerPhone: customerPhone.trim(),
                            customerCpf: customerCpf.replace(/\D/g, ""),
                            couponCode: appliedCoupon?.code || null,
                            discountAmount,
                            cashbackAmount: 0,
                          }}
                          userEmail={customerEmail.trim().toLowerCase()}
                          token={authToken || orderCreated?.guest_access_token || guestAccessToken}
                          splitPaymentEnabled={true}
                          validateCustomerData={() => isFormValid}
                          onFallbackToCheckoutPro={() => setPaymentTab("mercadopago_pro")}
                          onPaymentSuccess={async (paidOrderId, newGuestToken) => {
                            if (newGuestToken) {
                              setGuestAccessToken(newGuestToken);
                              if (typeof window !== "undefined" && !authToken) {
                                localStorage.setItem("token", newGuestToken);
                                refreshProfile().catch(() => {});
                              }
                            }
                            await persistReviewState({
                              order_id: paidOrderId,
                              guest_access_token: newGuestToken || guestAccessToken,
                              status: "paid",
                            });
                            setOrderCompleted(true);
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            padding: "18px",
                            background: "#f8fafc",
                            borderRadius: "14px",
                            border: "1px solid #e2e8f0",
                            textAlign: "center",
                          }}
                        >
                          <p
                            style={{
                              color: "#334155",
                              fontSize: "0.88rem",
                              marginBottom: "14px",
                              lineHeight: 1.5,
                            }}
                          >
                            Pague com <strong>Boleto Bancário</strong>,{" "}
                            <strong>Saldo Mercado Pago</strong>, <strong>PIX</strong> ou{" "}
                            <strong>Cartão</strong> diretamente no ambiente seguro do Mercado Pago:
                          </p>
                          <button
                            type="button"
                            onClick={handleMercadoPagoProCheckout}
                            disabled={creatingOrderForPro}
                            style={{
                              width: "100%",
                              padding: "14px 18px",
                              background: "#009ee3",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "12px",
                              fontWeight: 800,
                              fontSize: "0.95rem",
                              cursor: creatingOrderForPro ? "wait" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              boxShadow: "0 4px 12px rgba(0, 158, 227, 0.25)",
                            }}
                          >
                            {creatingOrderForPro ? (
                              <>
                                <Loader2 size={18} className="animate-spin" />
                                Redirecionando ao Mercado Pago...
                              </>
                            ) : (
                              <>
                                <ExternalLink size={18} />
                                Pagar no Mercado Pago / Boleto
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Selo de Segurança igual ao /carrinho */}
                <div className={styles.securityBadge}>
                  <ShieldCheck size={28} color="#2d5a27" />
                  <div>
                    <strong>Compra 100% Segura • Ecosopis</strong>
                    <p>Seus dados estão protegidos com criptografia SSL de 256 bits.</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
