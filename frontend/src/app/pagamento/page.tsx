"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import Link from "next/link";
import { Copy, ExternalLink, QrCode, FileText } from "lucide-react";

function PaymentContent() {
    const searchParams = useSearchParams();
    const status = searchParams.get("status") || "pending";
    const orderId = searchParams.get("order_id");

    const [orderStatus, setOrderStatus] = useState<string>(status);
    const [paymentDetails, setPaymentDetails] = useState<any>(null);
    const [polling, setPolling] = useState(true);
    const [attempts, setAttempts] = useState(0);
    const [copied, setCopied] = useState(false);

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
                    if (data.payment_details && Object.keys(data.payment_details).length > 0) {
                        setPaymentDetails(data.payment_details);
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

    const copyToClipboard = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
    };

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
                            {orderId && (
                                <Link href={`/pedido/${orderId}`} style={{
                                    background: "#2d5a27", color: "white", padding: "14px 28px",
                                    borderRadius: "10px", textDecoration: "none", fontWeight: 700, fontSize: "1rem"
                                }}>
                                    Ver Detalhes do Pedido
                                </Link>
                            )}
                            <Link href="/produtos" style={{
                                border: "2px solid #2d5a27", color: "#2d5a27", padding: "14px 28px",
                                borderRadius: "10px", textDecoration: "none", fontWeight: 700, fontSize: "1rem"
                            }}>
                                Continuar Comprando
                            </Link>
                            <Link href="/perfil?tab=orders" style={{
                                border: "2px solid #64748b", color: "#64748b", padding: "14px 28px",
                                borderRadius: "10px", textDecoration: "none", fontWeight: 700, fontSize: "1rem"
                            }}>
                                Meus Pedidos
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
                            O pagamento foi cancelado ou não foi possível processá-lo. Tente novamente.
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
                                ? "Aguarde enquanto confirmamos seu pagamento..."
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

                        {paymentDetails && (
                            <div style={{
                                marginTop: "40px",
                                padding: "30px",
                                background: "#fff",
                                borderRadius: "20px",
                                border: "1px solid #e2e8f0",
                                maxWidth: "500px",
                                width: "100%",
                                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)"
                            }}>
                                {paymentDetails.method === "pix" && (
                                    <>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center", marginBottom: "20px" }}>
                                            <QrCode color="#059669" />
                                            <h3 style={{ margin: 0 }}>Pagamento via Pix</h3>
                                        </div>
                                        {paymentDetails.qr_code_url && (
                                            <img 
                                                src={paymentDetails.qr_code_url} 
                                                alt="QR Code Pix" 
                                                style={{ width: "200px", height: "200px", margin: "0 auto 20px", display: "block", padding: "10px", border: "1px solid #eee", borderRadius: "12px" }}
                                            />
                                        )}
                                        <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "15px" }}>
                                            Escaneie o QR Code acima ou copie o código abaixo para pagar:
                                        </p>
                                        <div style={{ 
                                            background: "#f8fafc", 
                                            padding: "12px", 
                                            borderRadius: "10px", 
                                            fontSize: "0.75rem", 
                                            wordBreak: "break-all",
                                            fontFamily: "monospace",
                                            border: "1px solid #e2e8f0",
                                            marginBottom: "15px",
                                            textAlign: "left"
                                        }}>
                                            {paymentDetails.qr_code_data}
                                        </div>
                                        <button 
                                            onClick={() => copyToClipboard(paymentDetails.qr_code_data)}
                                            style={{
                                                width: "100%",
                                                padding: "12px",
                                                background: copied ? "#059669" : "#fff",
                                                color: copied ? "#fff" : "#059669",
                                                border: "1px solid #059669",
                                                borderRadius: "10px",
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: "8px",
                                                transition: "all 0.2s"
                                            }}
                                        >
                                            <Copy size={18} />
                                            {copied ? "CÓDIGO COPIADO!" : "COPIAR CÓDIGO PIX"}
                                        </button>
                                    </>
                                )}

                                {paymentDetails.method === "boleto" && (
                                    <>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center", marginBottom: "20px" }}>
                                            <FileText color="#1e40af" />
                                            <h3 style={{ margin: 0 }}>Pagamento via Boleto</h3>
                                        </div>
                                        <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "20px" }}>
                                            Seu boleto foi gerado com sucesso. Clique no botão abaixo para visualizá-lo e realizar o pagamento.
                                        </p>
                                        <div style={{ marginBottom: "20px", textAlign: "left" }}>
                                            <label style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>Linha Digitável:</label>
                                            <div style={{ 
                                                background: "#f8fafc", 
                                                padding: "12px", 
                                                borderRadius: "10px", 
                                                fontSize: "0.85rem", 
                                                fontWeight: "bold",
                                                border: "1px solid #e2e8f0",
                                                fontFamily: "monospace"
                                            }}>
                                                {paymentDetails.number}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: "12px" }}>
                                            <button 
                                                onClick={() => copyToClipboard(paymentDetails.number)}
                                                style={{
                                                    flex: 1,
                                                    padding: "12px",
                                                    background: "#f1f5f9",
                                                    color: "#475569",
                                                    border: "1px solid #cbd5e1",
                                                    borderRadius: "10px",
                                                    fontWeight: 600,
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: "8px"
                                                }}
                                            >
                                                <Copy size={18} /> {copied ? "Copiado!" : "Copiar"}
                                            </button>
                                            <a 
                                                href={paymentDetails.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                style={{
                                                    flex: 1.5,
                                                    padding: "12px",
                                                    background: "#1e40af",
                                                    color: "#fff",
                                                    border: "none",
                                                    borderRadius: "10px",
                                                    fontWeight: 700,
                                                    textDecoration: "none",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: "8px"
                                                }}
                                            >
                                                VER BOLETO <ExternalLink size={18} />
                                            </a>
                                        </div>
                                        <p style={{ marginTop: "15px", fontSize: "0.75rem", color: "#ef4444" }}>
                                            Atenção: Boletos podem levar até 3 dias úteis para compensar.
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
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
