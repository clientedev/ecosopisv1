"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import CheckoutTransparente from "@/components/CheckoutTransparente/CheckoutTransparente";
import BrandLoader from "@/components/BrandLoader/BrandLoader";
import Link from "next/link";
import {
  ShoppingBag,
  Truck,
  ShieldCheck,
  MapPin,
  User,
  Plus,
  Minus,
  Trash2,
  Check,
  Tag,
  CreditCard,
  Loader2,
  Sparkles,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

interface ReviewItem {
  id: number;
  name: string;
  slug?: string;
  price: number;
  quantity: number;
  image_url?: string;
  isWholesale?: boolean;
}

export default function FinalizarCompraWhatsAppPage() {
  const params = useParams();
  const checkoutToken = String(params?.token || "");

  const [loadingPage, setLoadingPage] = useState(true);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);

  // Itens e Catálogo para adição rápida
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [showAddCatalogModal, setShowAddCatalogModal] = useState(false);

  // Dados do cliente
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");

  // Endereço e CEP
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
  const [shippingError, setShippingError] = useState<string | null>(null);

  // Cupom
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    type: string;
    value: number;
  } | null>(null);
  const [couponError, setCouponError] = useState("");

  // Estado do pedido caso já finalizado
  const [completedOrderId, setCompletedOrderId] = useState<number | null>(null);
  const [completedGuestToken, setCompletedGuestToken] = useState<string | null>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [checkoutProLoading, setCheckoutProLoading] = useState(false);

  const formatCpf = (value: string) => {
    const digits = (value || "").replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatPhone = (value: string) => {
    const digits = (value || "").replace(/\D/g, "");
    const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2, 13) : digits.slice(0, 11);
    if (local.length <= 2) return local;
    if (local.length <= 7) return `(${local.slice(0, 2)}) ${local.slice(2)}`;
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  };

  const formatCep = (value: string) => {
    const digits = (value || "").replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const isCpfValid = (cpf: string): boolean => {
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
  };

  // Carrega os dados do pré-pedido gerado pelo WhatsApp
  useEffect(() => {
    if (!checkoutToken) return;
    setLoadingPage(true);
    fetch(`/api/whatsapp/catalog-checkout/${encodeURIComponent(checkoutToken)}`)
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Link de compra não encontrado.");
        }
        return res.json();
      })
      .then(data => {
        setCustomerName(data.customer_name || "");
        setCustomerEmail(data.customer_email || "");
        setCustomerPhone(formatPhone(data.phone || ""));
        setCustomerCpf(formatCpf(data.customer_cpf || ""));
        const initialCep = data.cep || data.address?.postal_code || data.address?.cep || "";
        setCep(formatCep(initialCep));
        setAddress({
          street: data.address?.street || "",
          number: data.address?.number || "",
          complement: data.address?.complement || "",
          neighborhood: data.address?.neighborhood || "",
          city: data.address?.city || "",
          state: data.address?.state || "SP",
        });
        setItems(Array.isArray(data.items) ? data.items : []);
        setCatalog(Array.isArray(data.catalog) ? data.catalog : []);
        if (data.coupon_code) {
          setCouponCode(data.coupon_code);
        }
        if (data.order_id && data.status === "paid") {
          setCompletedOrderId(Number(data.order_id));
          setCompletedGuestToken(data.guest_access_token || null);
        }
      })
      .catch(err => {
        setNotFoundError(err.message || "Não foi possível carregar este link de compra.");
      })
      .finally(() => {
        setLoadingPage(false);
      });
  }, [checkoutToken]);

  // Cálculo de Atacado (10+ unidades elegíveis = 45% OFF) e Subtotal
  const wholesaleItemsCount = useMemo(() => {
    return items
      .filter(i => i.isWholesale)
      .reduce((acc, i) => acc + (i.quantity || 1), 0);
  }, [items]);

  const isWholesaleEligible = wholesaleItemsCount >= 10;

  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const unitPrice =
        isWholesaleEligible && item.isWholesale
          ? Math.round(item.price * 0.55 * 100) / 100
          : item.price;
      return acc + unitPrice * item.quantity;
    }, 0);
  }, [items, isWholesaleEligible]);

  // Regra oficial de Frete Grátis Ecosopis
  const getFreeShippingThreshold = (cepValue: string) => {
    const clean = (cepValue || "").replace(/\D/g, "");
    if (clean.length !== 8) return null;
    const prefix = parseInt(clean.substring(0, 2), 10);
    if ((prefix >= 1 && prefix <= 39) || (prefix >= 80 && prefix <= 99)) {
      return 148.9;
    }
    return 248.9;
  };

  const freeShippingThreshold = getFreeShippingThreshold(cep);
  const appliesFreeShipping =
    freeShippingThreshold !== null && subtotal >= freeShippingThreshold;

  const cheapestShippingOption = useMemo(() => {
    if (shippingOptions.length === 0) return null;
    return [...shippingOptions].sort((a, b) => a.price - b.price)[0];
  }, [shippingOptions]);

  const isOptionFree = useCallback(
    (opt: any) => {
      if (!opt) return false;
      if (appliedCoupon?.type === "free_shipping") return true;
      if (
        appliesFreeShipping &&
        cheapestShippingOption &&
        opt.id === cheapestShippingOption.id
      ) {
        return true;
      }
      return false;
    },
    [appliedCoupon, appliesFreeShipping, cheapestShippingOption]
  );

  const shippingPrice = useMemo(() => {
    if (!selectedShipping) return 0;
    if (isOptionFree(selectedShipping)) return 0;
    return Number(selectedShipping.price || 0);
  }, [selectedShipping, isOptionFree]);

  // Cálculo de Desconto de Cupom
  const discountAmount = useMemo(() => {
    if (!appliedCoupon || isWholesaleEligible) return 0;
    if (appliedCoupon.type === "percentage") {
      return Math.round(subtotal * (appliedCoupon.value / 100) * 100) / 100;
    }
    if (appliedCoupon.type === "fixed") {
      return Math.min(subtotal, Number(appliedCoupon.value || 0));
    }
    return 0;
  }, [appliedCoupon, subtotal, isWholesaleEligible]);

  const finalTotal = useMemo(() => {
    return Math.max(0.01, Math.round((subtotal + shippingPrice - discountAmount) * 100) / 100);
  }, [subtotal, shippingPrice, discountAmount]);

  // Cálculo automático de frete via /api/shipping/calculate sempre que CEP ou itens mudarem
  useEffect(() => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8 || items.length === 0) {
      setShippingOptions([]);
      setSelectedShipping(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingShipping(true);
      setShippingError(null);
      try {
        const reqBody = {
          dest_cep: cleanCep,
          items: items.map(item => {
            const name = (item.name || "").toLowerCase();
            const unitWeight =
              name.includes("sabonete") &&
              (name.includes("líquido") || name.includes("liquido"))
                ? 0.3
                : 0.1;
            return {
              id: String(item.id),
              name: item.name,
              width: 16,
              height: 12,
              length: 20,
              weight: unitWeight,
              price: item.price,
              quantity: item.quantity,
            };
          }),
        };

        const res = await fetch("/api/shipping/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody),
        });

        if (res.ok) {
          const data = await res.json();
          setShippingOptions(data);
          if (data.length > 0) {
            const sorted = [...data].sort((a: any, b: any) => a.price - b.price);
            setSelectedShipping(sorted[0]);
          } else {
            setSelectedShipping(null);
          }
        } else {
          const err = await res.json().catch(() => ({}));
          setShippingError(err.detail || "Não foi possível calcular o frete para este CEP.");
        }
      } catch {
        setShippingError("Erro de conexão ao consultar opções de frete.");
      } finally {
        setLoadingShipping(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [cep, items]);

  // Busca automática de rua/bairro/cidade ao alterar CEP
  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          setAddress(prev => ({
            ...prev,
            street: data.logradouro || prev.street,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
        }
      }
    } catch {}
  };

  // Manipulação de itens na revisão
  const updateItemQty = (id: number, delta: number) => {
    setItems(prev =>
      prev
        .map(item =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter(item => item.quantity > 0)
    );
  };

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const addProductFromCatalog = (prod: any) => {
    const effectivePrice =
      prod.is_on_sale && prod.sale_price && prod.sale_price > 0
        ? Number(prod.sale_price)
        : Number(prod.price || 0);

    setItems(prev => {
      const idx = prev.findIndex(i => i.id === prod.id);
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
          price: effectivePrice,
          quantity: 1,
          image_url: prod.image_url,
          isWholesale: Boolean(prod.is_wholesale),
        },
      ];
    });
    setShowAddCatalogModal(false);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError("");
    if (isWholesaleEligible) {
      setCouponError("Cupons não são acumulativos com o desconto de Atacado (45% OFF).");
      return;
    }
    try {
      const res = await fetch(`/api/coupons/validate/${encodeURIComponent(couponCode.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.min_purchase_value && subtotal < data.min_purchase_value) {
          setCouponError(`Compra mínima de R$ ${Number(data.min_purchase_value).toFixed(2)} necessária.`);
          return;
        }
        setAppliedCoupon({
          code: data.code,
          type: data.discount_type,
          value: data.discount_value,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        setCouponError(err.detail || "Cupom inválido ou expirado.");
        setAppliedCoupon(null);
      }
    } catch {
      setCouponError("Erro ao validar cupom.");
    }
  };

  // Salva revisão no banco do WhatsApp Checkout
  const persistReviewChanges = async (extraFields: Record<string, any> = {}) => {
    if (!checkoutToken) return;
    setSavingReview(true);
    try {
      await fetch(`/api/whatsapp/catalog-checkout/${encodeURIComponent(checkoutToken)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim(),
          customer_cpf: customerCpf.replace(/\D/g, ""),
          phone: customerPhone.replace(/\D/g, ""),
          cep: cep.replace(/\D/g, ""),
          address: {
            ...address,
            postal_code: cep.replace(/\D/g, ""),
            cep: cep.replace(/\D/g, ""),
            email: customerEmail.trim(),
          },
          items,
          coupon_code: appliedCoupon?.code || null,
          shipping_method: selectedShipping
            ? `${selectedShipping.company ? `${selectedShipping.company} ` : ""}${selectedShipping.name}`.trim()
            : "PAC",
          shipping_service_id: selectedShipping?.id ? Number(selectedShipping.id) : null,
          shipping_price: shippingPrice,
          ...extraFields,
        }),
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
    } catch {} finally {
      setSavingReview(false);
    }
  };

  const validateCustomerData = () => {
    if (items.length === 0) {
      alert("⚠️ Seu pedido está vazio. Adicione ao menos 1 produto do catálogo.");
      return false;
    }
    if (!customerName.trim() || customerName.trim().length < 3) {
      alert("⚠️ Por favor, preencha seu Nome Completo.");
      return false;
    }
    if (!customerEmail.trim() || !customerEmail.includes("@")) {
      alert("⚠️ Por favor, informe um E-mail válido para receber o comprovante e rastreio.");
      return false;
    }
    const cleanCpf = customerCpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11 || !isCpfValid(cleanCpf)) {
      alert("⚠️ Por favor, informe um CPF válido com 11 dígitos.");
      return false;
    }
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      alert("⚠️ Por favor, informe um CEP válido com 8 dígitos.");
      return false;
    }
    if (!address.street.trim() || !address.number.trim() || !address.neighborhood.trim() || !address.city.trim() || !address.state.trim()) {
      alert("⚠️ Preencha todos os campos do endereço de entrega (Rua, Número, Bairro, Cidade e UF).");
      return false;
    }
    if (!selectedShipping) {
      alert("⚠️ Aguarde o cálculo ou selecione uma opção de frete.");
      return false;
    }
    return true;
  };

  // Monta o objeto compatível com o CheckoutTransparente e Checkout Pro oficiais da Ecosopis
  const checkoutOrderData = useMemo(() => {
    const cleanCep = cep.replace(/\D/g, "");
    return {
      items: items.map(i => {
        const isDiscounted = Boolean(i.isWholesale && isWholesaleEligible);
        const unitPrice = isDiscounted ? Math.round(i.price * 0.55 * 100) / 100 : i.price;
        return {
          product_id: i.id,
          product_name: isDiscounted ? `${i.name} (Atacado)` : i.name,
          quantity: i.quantity,
          price: unitPrice,
        };
      }),
      total: finalTotal,
      shippingPrice,
      shippingMethod: selectedShipping
        ? `${selectedShipping.company ? `${selectedShipping.company} ` : ""}${selectedShipping.name}`.trim()
        : "Melhor Envio",
      shippingServiceId: selectedShipping?.id ? Number(selectedShipping.id) : null,
      address: {
        ...address,
        email: customerEmail.trim(),
        postal_code: cleanCep,
        zip: cleanCep,
        cep: cleanCep,
      },
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.replace(/\D/g, ""),
      customerCpf: customerCpf.replace(/\D/g, ""),
      couponCode: isWholesaleEligible ? null : appliedCoupon?.code || null,
      discountAmount: isWholesaleEligible ? 0 : discountAmount,
      cashbackAmount: 0,
    };
  }, [
    items,
    isWholesaleEligible,
    finalTotal,
    shippingPrice,
    selectedShipping,
    address,
    customerEmail,
    customerName,
    customerPhone,
    customerCpf,
    cep,
    appliedCoupon,
    discountAmount,
  ]);

  const handleCheckoutProRedirect = async () => {
    if (!validateCustomerData()) return;
    setCheckoutProLoading(true);
    try {
      await persistReviewChanges();
      const res = await fetch("/api/payment/create-mercadopago-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: checkoutOrderData.items,
          total: checkoutOrderData.total,
          shipping_price: checkoutOrderData.shippingPrice,
          shipping_method: checkoutOrderData.shippingMethod,
          shipping_service_id: checkoutOrderData.shippingServiceId,
          customer_name: checkoutOrderData.customerName,
          customer_email: checkoutOrderData.customerEmail,
          customer_phone: checkoutOrderData.customerPhone,
          customer_cpf: checkoutOrderData.customerCpf,
          address: checkoutOrderData.address,
          coupon_code: checkoutOrderData.couponCode,
          discount_amount: checkoutOrderData.discountAmount,
          cashback_amount: 0,
        }),
      });
      const data = await res.json();
      if (res.ok && data.checkout_url) {
        if (data.guest_access_token && data.order_id && typeof window !== "undefined") {
          localStorage.setItem("guest_order_token_" + data.order_id, data.guest_access_token);
          localStorage.setItem("last_guest_order_token", data.guest_access_token);
        }
        await persistReviewChanges({
          order_id: data.order_id,
          guest_access_token: data.guest_access_token,
          status: "payment_initiated",
        });
        window.location.href = data.checkout_url;
      } else {
        alert(data.detail || "Não foi possível abrir o Checkout Pro do Mercado Pago.");
      }
    } catch {
      alert("Erro de comunicação ao iniciar o pagamento.");
    } finally {
      setCheckoutProLoading(false);
    }
  };

  const handlePaymentSuccess = async (orderId: number, guestAccessToken?: string | null) => {
    if (typeof window !== "undefined" && orderId && guestAccessToken) {
      localStorage.setItem(`guest_order_token_${orderId}`, guestAccessToken);
      localStorage.setItem("last_guest_order_token", guestAccessToken);
    }
    await persistReviewChanges({
      order_id: orderId,
      guest_access_token: guestAccessToken || null,
      status: "paid",
    });
    setCompletedOrderId(orderId);
    setCompletedGuestToken(guestAccessToken || null);
    const gt = guestAccessToken ? `&guest_token=${encodeURIComponent(guestAccessToken)}` : "";
    window.location.href = `/pagamento?status=approved&order_id=${orderId}${gt}`;
  };

  if (loadingPage) {
    return <BrandLoader fullScreen />;
  }

  if (notFoundError) {
    return (
      <main>
        <Header />
        <div style={{ minHeight: "65vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
          <AlertCircle size={56} color="#dc2626" style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: "1.6rem", color: "#1e293b", marginBottom: 8 }}>Link de Compra Não Encontrado</h1>
          <p style={{ color: "#64748b", maxWidth: 460, marginBottom: 24 }}>{notFoundError}</p>
          <Link href="/produtos" style={{ background: "#2d5a27", color: "white", padding: "14px 28px", borderRadius: 10, textDecoration: "none", fontWeight: 700 }}>
            Ver Catálogo da Loja
          </Link>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <Header />

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 16px 72px" }}>
        {/* Banner Topo */}
        <div
          style={{
            background: "linear-gradient(135deg, #1b4332 0%, #2d5a27 100%)",
            color: "white",
            borderRadius: 20,
            padding: "24px 28px",
            marginBottom: 28,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            boxShadow: "0 10px 30px rgba(45,90,39,0.2)",
          }}
        >
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.16)", padding: "4px 12px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 700, marginBottom: 8 }}>
              <Sparkles size={14} /> COMPRA ASSISTIDA PELO WHATSAPP ECOSOPIS
            </div>
            <h1 style={{ margin: 0, fontSize: "1.55rem", fontWeight: 800 }}>
              Revise seu Pedido & Finalize o Pagamento
            </h1>
            <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.85)", fontSize: "0.92rem" }}>
              Confira seus produtos, endereço e escolha como prefere pagar: PIX imediato, Cartão em até 12x, PIX + Cartão ou Boleto.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.12)", padding: "10px 16px", borderRadius: 12, fontSize: "0.85rem" }}>
            <ShieldCheck size={20} color="#86efac" />
            <span>Ambiente 100% Seguro</span>
          </div>
        </div>

        {completedOrderId ? (
          <div style={{ background: "white", borderRadius: 20, padding: "40px 28px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>🎉</div>
            <h2 style={{ color: "#15803d", fontSize: "1.8rem", marginBottom: 8 }}>Pedido #{completedOrderId} Confirmado!</h2>
            <p style={{ color: "#475569", marginBottom: 24 }}>
              Seu pagamento já foi processado com sucesso. Acompanhe o status e o código de rastreio do seu pedido abaixo:
            </p>
            <Link
              href={`/pedido/${completedOrderId}${completedGuestToken ? `?guest_token=${encodeURIComponent(completedGuestToken)}` : ""}`}
              style={{ display: "inline-block", background: "#2d5a27", color: "white", padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 700 }}
            >
              Acompanhar Meu Pedido #{completedOrderId}
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: 24,
              alignItems: "start",
            }}
          >
            {/* COLUNA ESQUERDA: REVISÃO DE ITENS, DADOS E ENDEREÇO */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* 1. ITENS DO PEDIDO */}
              <div style={{ background: "white", borderRadius: 18, padding: "24px", boxShadow: "0 4px 18px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#1e293b", display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
                    <ShoppingBag size={20} color="#2d5a27" />
                    1. Seus Produtos ({items.reduce((acc, i) => acc + i.quantity, 0)})
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowAddCatalogModal(true)}
                    style={{
                      background: "#f0fdf4",
                      color: "#166534",
                      border: "1px solid #bbf7d0",
                      borderRadius: 10,
                      padding: "8px 14px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Plus size={15} /> Adicionar Mais Produtos
                  </button>
                </div>

                {items.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 12px", color: "#64748b" }}>
                    Nenhum produto selecionado. Clique em <strong>Adicionar Mais Produtos</strong> acima.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {items.map(item => {
                      const unitPrice =
                        isWholesaleEligible && item.isWholesale
                          ? Math.round(item.price * 0.55 * 100) / 100
                          : item.price;
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "12px 14px",
                            background: "#f8fafc",
                            borderRadius: 12,
                            border: "1px solid #e2e8f0",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 180 }}>
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", border: "1px solid #e2e8f0" }}
                              />
                            ) : (
                              <div style={{ width: 48, height: 48, borderRadius: 10, background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                🌿
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.92rem" }}>
                                {item.name}
                              </div>
                              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                                R$ {unitPrice.toFixed(2).replace(".", ",")} / un.
                                {isWholesaleEligible && item.isWholesale && (
                                  <span style={{ marginLeft: 6, color: "#15803d", fontWeight: 700 }}>(Atacado 45% OFF)</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => updateItemQty(item.id, -1)}
                              style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #cbd5e1", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              <Minus size={14} />
                            </button>
                            <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700, fontSize: "0.95rem" }}>
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateItemQty(item.id, 1)}
                              style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #cbd5e1", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              title="Remover item"
                              style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 4 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div style={{ fontWeight: 800, color: "#2d5a27", fontSize: "0.95rem", minWidth: 85, textAlign: "right" }}>
                            R$ {(unitPrice * item.quantity).toFixed(2).replace(".", ",")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. DADOS DO CLIENTE */}
              <div style={{ background: "white", borderRadius: 18, padding: "24px", boxShadow: "0 4px 18px rgba(0,0,0,0.05)" }}>
                <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "#1e293b", display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
                  <User size={20} color="#2d5a27" />
                  2. Dados Pessoais para Nota & Rastreio
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Seu nome completo"
                      style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: "0.9rem", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      CPF *
                    </label>
                    <input
                      type="text"
                      value={customerCpf}
                      onChange={e => setCustomerCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: "0.9rem", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      E-mail *
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={e => setCustomerEmail(e.target.value)}
                      placeholder="seu@email.com"
                      style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: "0.9rem", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      WhatsApp / Telefone *
                    </label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(formatPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: "0.9rem", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              </div>

              {/* 3. ENDEREÇO E FRETE */}
              <div style={{ background: "white", borderRadius: 18, padding: "24px", boxShadow: "0 4px 18px rgba(0,0,0,0.05)" }}>
                <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "#1e293b", display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
                  <MapPin size={20} color="#2d5a27" />
                  3. Endereço de Entrega & Frete
                </h2>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      CEP *
                    </label>
                    <input
                      type="text"
                      value={cep}
                      onChange={e => setCep(formatCep(e.target.value))}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                      style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: "0.9rem", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Rua / Logradouro *
                    </label>
                    <input
                      type="text"
                      value={address.street}
                      onChange={e => setAddress({ ...address, street: e.target.value })}
                      placeholder="Rua, Avenida..."
                      style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: "0.9rem", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Número *
                    </label>
                    <input
                      type="text"
                      value={address.number}
                      onChange={e => setAddress({ ...address, number: e.target.value })}
                      placeholder="Nº"
                      style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: "0.9rem", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Complemento
                    </label>
                    <input
                      type="text"
                      value={address.complement}
                      onChange={e => setAddress({ ...address, complement: e.target.value })}
                      placeholder="Apto, Bloco..."
                      style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: "0.9rem", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Bairro *
                    </label>
                    <input
                      type="text"
                      value={address.neighborhood}
                      onChange={e => setAddress({ ...address, neighborhood: e.target.value })}
                      placeholder="Bairro"
                      style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: "0.9rem", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Cidade *
                    </label>
                    <input
                      type="text"
                      value={address.city}
                      onChange={e => setAddress({ ...address, city: e.target.value })}
                      placeholder="Cidade"
                      style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: "0.9rem", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Estado (UF) *
                    </label>
                    <select
                      value={address.state}
                      onChange={e => setAddress({ ...address, state: e.target.value })}
                      style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: "0.9rem", background: "white", boxSizing: "border-box" }}
                    >
                      {BRAZILIAN_STATES.map(uf => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Opções de Frete */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: 10 }}>
                    <Truck size={17} color="#2d5a27" />
                    Opções de Envio (Melhor Envio / Correios):
                  </div>

                  {loadingShipping ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: "0.88rem", padding: "8px 0" }}>
                      <Loader2 size={16} className="animate-spin" /> Calculando opções de frete para o CEP {cep}...
                    </div>
                  ) : shippingError ? (
                    <div style={{ color: "#dc2626", fontSize: "0.85rem", padding: "8px 0" }}>⚠️ {shippingError}</div>
                  ) : shippingOptions.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {shippingOptions.map((opt: any) => {
                        const free = isOptionFree(opt);
                        const selected = selectedShipping?.id === opt.id;
                        return (
                          <label
                            key={opt.id}
                            onClick={() => setSelectedShipping(opt)}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "12px 14px",
                              borderRadius: 12,
                              border: selected ? "2px solid #2d5a27" : "1px solid #cbd5e1",
                              background: selected ? "#f0fdf4" : "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <input
                                type="radio"
                                checked={selected}
                                onChange={() => setSelectedShipping(opt)}
                                style={{ accentColor: "#2d5a27" }}
                              />
                              <div>
                                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>
                                  {opt.company ? `${opt.company} - ` : ""}
                                  {opt.name}
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                                  Prazo estimado: até {opt.delivery_time || opt.custom_delivery_time || 7} dias úteis
                                </div>
                              </div>
                            </div>
                            <div style={{ fontWeight: 800, color: free ? "#15803d" : "#1e293b", fontSize: "0.95rem" }}>
                              {free ? "GRÁTIS" : `R$ ${Number(opt.price).toFixed(2).replace(".", ",")}`}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                      Preencha o CEP com 8 dígitos para visualizar as opções de entrega.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => persistReviewChanges()}
                    disabled={savingReview}
                    style={{
                      background: savedFeedback ? "#15803d" : "#f1f5f9",
                      color: savedFeedback ? "white" : "#334155",
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                      padding: "8px 16px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {savedFeedback ? (
                      <>
                        <Check size={15} /> Alterações Salvas!
                      </>
                    ) : savingReview ? (
                      "Salvando..."
                    ) : (
                      "Salvar Revisão dos Dados"
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: RESUMO DE VALORES, CUPOM E TODOS OS MÉTODOS DE PAGAMENTO */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* RESUMO + CUPOM */}
              <div style={{ background: "white", borderRadius: 18, padding: "24px", boxShadow: "0 4px 18px rgba(0,0,0,0.05)" }}>
                <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "#1e293b", fontWeight: 800 }}>
                  Resumo do Pedido
                </h2>

                {/* Cupom */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                    <Tag size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                    Cupom de Desconto
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Ex: PRIMEIRACOMPRA"
                      style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      style={{ background: "#2d5a27", color: "white", border: "none", borderRadius: 10, padding: "0 16px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
                    >
                      Aplicar
                    </button>
                  </div>
                  {couponError && (
                    <div style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4 }}>{couponError}</div>
                  )}
                  {appliedCoupon && (
                    <div style={{ color: "#15803d", fontSize: "0.8rem", fontWeight: 700, marginTop: 4 }}>
                      ✓ Cupom {appliedCoupon.code} aplicado!
                    </div>
                  )}
                </div>

                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#475569" }}>
                    <span>Subtotal dos produtos</span>
                    <strong>R$ {subtotal.toFixed(2).replace(".", ",")}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#475569" }}>
                    <span>Frete ({selectedShipping ? selectedShipping.name : "A calcular"})</span>
                    <strong style={{ color: shippingPrice === 0 && selectedShipping ? "#15803d" : "#1e293b" }}>
                      {selectedShipping
                        ? shippingPrice === 0
                          ? "Grátis"
                          : `R$ ${shippingPrice.toFixed(2).replace(".", ",")}`
                        : "—"}
                    </strong>
                  </div>
                  {discountAmount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#15803d" }}>
                      <span>Desconto ({appliedCoupon?.code})</span>
                      <strong>- R$ {discountAmount.toFixed(2).replace(".", ",")}</strong>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderTop: "2px solid #e2e8f0",
                      paddingTop: 12,
                      marginTop: 4,
                    }}
                  >
                    <span style={{ fontSize: "1.08rem", fontWeight: 800, color: "#1e293b" }}>Total a Pagar</span>
                    <span style={{ fontSize: "1.35rem", fontWeight: 900, color: "#2d5a27" }}>
                      R$ {finalTotal.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>
              </div>

              {/* PAGAMENTO: CHECKOUT TRANSPARENTE (PIX, CARTÃO, PIX+CARTÃO) + CHECKOUT PRO / BOLETO */}
              <div style={{ background: "white", borderRadius: 18, padding: "24px", boxShadow: "0 4px 18px rgba(0,0,0,0.05)" }}>
                <h2 style={{ margin: "0 0 14px", fontSize: "1.1rem", color: "#1e293b", display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
                  <CreditCard size={20} color="#2d5a27" />
                  4. Escolha a Forma de Pagamento
                </h2>

                <CheckoutTransparente
                  orderData={checkoutOrderData}
                  userEmail={customerEmail.trim()}
                  token={typeof window !== "undefined" ? localStorage.getItem("token") : null}
                  splitPaymentEnabled={true}
                  onPaymentSuccess={handlePaymentSuccess}
                  onFallbackToCheckoutPro={handleCheckoutProRedirect}
                  validateCustomerData={validateCustomerData}
                />

                {/* Opção adicional para Boleto / Saldo Mercado Pago via Checkout Pro */}
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px dashed #e2e8f0", textAlign: "center" }}>
                  <p style={{ margin: "0 0 10px", fontSize: "0.82rem", color: "#64748b" }}>
                    Prefere pagar com <strong>Boleto Bancário</strong> ou <strong>Saldo da Conta Mercado Pago</strong>?
                  </p>
                  <button
                    type="button"
                    onClick={handleCheckoutProRedirect}
                    disabled={checkoutProLoading}
                    style={{
                      width: "100%",
                      padding: "12px 18px",
                      borderRadius: 12,
                      border: "1.5px solid #009ee3",
                      background: "#f0f9ff",
                      color: "#0284c7",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <ExternalLink size={16} />
                    {checkoutProLoading
                      ? "Abrindo Ambiente Mercado Pago..."
                      : "Pagar via Mercado Pago (Boleto / Cartão / PIX)"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal para adicionar mais produtos do catálogo durante a revisão */}
      {showAddCatalogModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowAddCatalogModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 20,
              maxWidth: 620,
              width: "100%",
              maxHeight: "82vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#1e293b" }}>🌿 Catálogo de Produtos Ecosopis</h3>
              <button
                type="button"
                onClick={() => setShowAddCatalogModal(false)}
                style={{ border: "none", background: "#f1f5f9", borderRadius: 8, padding: "6px 12px", fontWeight: 700, cursor: "pointer" }}
              >
                Fechar ✕
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {catalog.map(prod => {
                const pPrice =
                  prod.is_on_sale && prod.sale_price && prod.sale_price > 0
                    ? Number(prod.sale_price)
                    : Number(prod.price || 0);
                return (
                  <div
                    key={prod.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {prod.image_url ? (
                        <img src={prod.image_url} alt={prod.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>🌿</div>
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>{prod.name}</div>
                        <div style={{ fontSize: "0.8rem", color: "#2d5a27", fontWeight: 700 }}>
                          R$ {pPrice.toFixed(2).replace(".", ",")}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addProductFromCatalog(prod)}
                      style={{
                        background: "#2d5a27",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 14px",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      + Adicionar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}

