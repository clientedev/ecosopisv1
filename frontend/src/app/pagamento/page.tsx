"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import Link from "next/link";

function PaymentContent() {
    const searchParams = useSearchParams();
    const status = searchParams.get("status") || searchParams.get("collection_status") || "pending";
    const orderId = searchParams.get("order_id") || searchParams.get("external_reference");

    const [orderStatus, setOrderStatus] = useState<string>(status);
    const [polling, setPolling] = useState(true);
    const [attempts, setAttempts] = useState(0);

    useEffect(() => {
        if (!orderId || status === "failure") {
            setPolling(false);
            return;
        }
        if (status === "approved") {
            setOrderStatus("approved");
            setPolling(false);
            return;
        }

        // Poll backend to confirm payment status
        const checkStatus = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) { setPolling(false); return; }

                // Use relative path for Next.js rewrites
                const apiUrl = "/api";
                const res = await fetch(`${apiUrl}/payment/status/${orderId}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "paid") {
                        setOrderStatus("approved");
                        setPolling(false);
                        return;
                    }
                }
            } catch (e) {
                console.error("Error polling payment status:", e);
            }

            setAttempts(prev => {
                const next = prev + 1;
                if (next >= 8) setPolling(false); // max 8 attempts = ~40s
                return next;
            });
        };

        if (polling) {
            const interval = setInterval(checkStatus, 5000);
            checkStatus();
            return () => clearInterval(interval);
        }
    }, [orderId, status, polling]);

    const isApproved = orderStatus === "approved" || orderStatus === "paid";
    const isFailure = status === "failure" || status === "rejected";
    const isPending = !isApproved && !isFailure;

    return (
        <main>
            <Header />
            <div style={{
                minHeight: "70vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "60px 20px",
                textAlign: "center",
                fontFamily: "var(--font-karla, Inter, sans-serif)"
            }}>
                {isApproved && (
                    <>
                        <div style={{ fontSize: "4rem", marginBottom: "20px" }}>🎉</div>
                        <h1 style={{ color: "#15803d", fontSize: "2rem", marginBottom: "12px" }}>
                            Pagamento Confirmado!
                        </h1>
                        <p style={{ color: "#555", fontSize: "1.1rem", marginBottom: "8px" }}>
                            Seu pedido #{orderId} foi recebido e o pagamento aprovado.
                        </p>
                        <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: "32px" }}>
                            Em breve você receberá uma confirmação por e-mail e acompanhará o envio.
                        </p>
                        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
                            <Link href="/produtos" style={{
                                background: "#2d5a27", color: "white", padding: "14px 28px",
                                borderRadius: "10px", textDecoration: "none", fontWeight: 700, fontSize: "1rem"
                            }}>
                                Continuar Comprando
                            </Link>
                            <Link href="/conta" style={{
                                border: "2px solid #2d5a27", color: "#2d5a27", padding: "14px 28px",
                                borderRadius: "10px", textDecoration: "none", fontWeight: 700, fontSize: "1rem"
                            }}>
                                Minha Conta
                            </Link>
                        </div>
                    </>
                )}

                {isFailure && (
                    <>
                        <div style={{ fontSize: "4rem", marginBottom: "20px" }}>😔</div>
                        <h1 style={{ color: "#dc2626", fontSize: "2rem", marginBottom: "12px" }}>
                            Pagamento não concluído
                        </h1>
                        <p style={{ color: "#555", fontSize: "1.1rem", marginBottom: "32px" }}>
                            Não foi possível processar seu pagamento. Tente novamente.
                        </p>
                        <Link href="/carrinho" style={{
                            background: "#2d5a27", color: "white", padding: "14px 28px",
                            borderRadius: "10px", textDecoration: "none", fontWeight: 700
                        }}>
                            Tentar Novamente
                        </Link>
                    </>
                )}

                {isPending && (
                    <>
                        <div style={{ fontSize: "4rem", marginBottom: "20px" }}>⏳</div>
                        <h1 style={{ color: "#d97706", fontSize: "2rem", marginBottom: "12px" }}>
                            {polling && attempts < 8 ? "Verificando pagamento..." : "Pagamento em análise"}
                        </h1>
                        <p style={{ color: "#555", fontSize: "1.1rem", marginBottom: "8px" }}>
                            {polling && attempts < 8
                                ? "Aguarde enquanto confirmamos seu pagamento com o Mercado Pago..."
                                : "Seu pagamento está sendo processado. Você receberá uma confirmação em breve."}
                        </p>
                        {polling && attempts < 8 && (
                            <div style={{ margin: "20px auto", width: "40px", height: "40px", border: "4px solid #f3f4f6", borderTop: "4px solid #2d5a27", borderRadius: "50%", animation: "spin 1s linear infinite" }}>
                                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            </div>
                        )}
                        {orderId && (
                            <p style={{ color: "#888", fontSize: "0.85rem", marginTop: "12px" }}>
                                Pedido #{orderId}
                            </p>
                        )}
                        <div style={{ marginTop: "32px", display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
                            <Link href="/produtos" style={{
                                border: "2px solid #2d5a27", color: "#2d5a27", padding: "14px 28px",
                                borderRadius: "10px", textDecoration: "none", fontWeight: 700
                            }}>
                                Continuar Navegando
                            </Link>
                        </div>
                    </>
                )}
            </div>
            <Footer />
        </main>
    );
}

export default function PagamentoPage() {
    return (
        <Suspense fallback={<div style={{ padding: "100px", textAlign: "center" }}>Carregando...</div>}>
            <PaymentContent />
        </Suspense>
    );
}
