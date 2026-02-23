import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";

export default function Envio() {
    const shippingOptions = [
        {
            icon: "🚚",
            name: "PAC",
            description: "Entrega econômica pelos Correios",
            time: "5–10 dias úteis",
            price: "A partir de R$ 15,90"
        },
        {
            icon: "⚡",
            name: "SEDEX",
            description: "Entrega expressa pelos Correios",
            time: "1–3 dias úteis",
            price: "A partir de R$ 28,50"
        },
        {
            icon: "🎁",
            name: "Frete Grátis",
            description: "Para compras acima de R$ 150",
            time: "5–8 dias úteis",
            price: "Grátis"
        }
    ];

    return (
        <main>
            <Header />
            <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 20px 80px" }}>
                <h1 style={{ textAlign: "center", color: "#2d5a27", marginBottom: 8, fontSize: "2rem" }}>
                    Envio & Entrega
                </h1>
                <p style={{ textAlign: "center", color: "#666", marginBottom: 56 }}>
                    Enviamos para todo o Brasil com segurança e cuidado.
                </p>

                {/* Shipping Options */}
                <h2 style={{ color: "#2d5a27", marginBottom: 24 }}>Opções de Envio</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 56 }}>
                    {shippingOptions.map((opt, i) => (
                        <div key={i} style={{
                            background: "#fff", borderRadius: 14, padding: "28px 24px",
                            border: "1px solid #e8f5e9", boxShadow: "0 2px 12px rgba(45,90,39,0.07)",
                            textAlign: "center"
                        }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>{opt.icon}</div>
                            <h3 style={{ color: "#2d5a27", marginBottom: 8 }}>{opt.name}</h3>
                            <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: 12 }}>{opt.description}</p>
                            <div style={{
                                background: "#f0f7ee", borderRadius: 8, padding: "10px 16px",
                                display: "inline-block", marginBottom: 8
                            }}>
                                <span style={{ color: "#2d5a27", fontWeight: 700, fontSize: "0.85rem" }}>⏱ {opt.time}</span>
                            </div>
                            <p style={{ color: "#4a7c59", fontWeight: 600, marginTop: 8 }}>{opt.price}</p>
                        </div>
                    ))}
                </div>

                {/* Policies */}
                <h2 style={{ color: "#2d5a27", marginBottom: 24 }}>Políticas de Envio</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[
                        {
                            title: "⏳ Prazo de Processamento",
                            text: "Os pedidos são processados em até 2 dias úteis após a confirmação do pagamento. Pedidos feitos até as 14h são processados no mesmo dia."
                        },
                        {
                            title: "📦 Embalagem Sustentável",
                            text: "Todos os produtos são enviados em embalagens ecológicas, recicláveis e com proteção máxima para garantir que seus cosméticos cheguem em perfeito estado."
                        },
                        {
                            title: "🔍 Rastreamento",
                            text: "Após o envio, você receberá um código de rastreamento por e-mail para acompanhar a entrega em tempo real pelos Correios."
                        },
                        {
                            title: "↩️ Trocas e Devoluções",
                            text: "Aceitamos trocas e devoluções em até 7 dias corridos após o recebimento. O produto deve estar lacrado e sem uso. Entre em contato com nosso suporte para iniciar o processo."
                        }
                    ].map((item, i) => (
                        <div key={i} style={{
                            background: "#fff", borderRadius: 12, padding: "20px 24px",
                            border: "1px solid #e8f5e9"
                        }}>
                            <h3 style={{ color: "#2d5a27", marginBottom: 8, fontSize: "1rem" }}>{item.title}</h3>
                            <p style={{ color: "#555", lineHeight: 1.7, margin: 0 }}>{item.text}</p>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div style={{
                    marginTop: 56, textAlign: "center",
                    background: "linear-gradient(135deg, #2d5a27 0%, #4a7c59 100%)",
                    borderRadius: 16, padding: "40px 32px", color: "#fff"
                }}>
                    <h2 style={{ marginBottom: 12 }}>Dúvidas sobre seu pedido?</h2>
                    <p style={{ opacity: 0.9, marginBottom: 24 }}>Nossa equipe está pronta para te ajudar!</p>
                    <a href="/contato" style={{
                        background: "#fff", color: "#2d5a27",
                        padding: "12px 32px", borderRadius: 8,
                        fontWeight: 700, textDecoration: "none", display: "inline-block"
                    }}>
                        FALAR COM SUPORTE
                    </a>
                </div>
            </div>
            <Footer />
        </main>
    );
}
