import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";

export default function FAQ() {
    const faqs = [
        {
            q: "Os produtos são realmente 100% naturais?",
            a: "Sim! Todos os nossos cosméticos são formulados com ingredientes de origem natural e vegetal, sem parabenos, sulfatos, silicones ou ingredientes de origem animal."
        },
        {
            q: "Os produtos são veganos e cruelty-free?",
            a: "Absolutamente. A ECOSOPIS é 100% vegana e cruelty-free. Nenhum dos nossos produtos é testado em animais, e não utilizamos nenhum ingrediente de origem animal."
        },
        {
            q: "Qual é o prazo de validade dos produtos?",
            a: "Nossos produtos têm validade média de 24 meses a partir da data de fabricação, indicada na embalagem. Uma vez abertos, recomendamos o uso em até 12 meses."
        },
        {
            q: "Como faço para saber qual produto é ideal para mim?",
            a: "Temos um Quizz de Pele personalizado! Em menos de 1 minuto, nossa IA analisa seu perfil e recomenda a rotina ideal para você. Acesse em /quizz."
        },
        {
            q: "Os produtos causam alergias?",
            a: "Nossos produtos são formulados para serem suaves, mas em caso de pele muito sensível, recomendamos testar uma pequena área antes do uso completo. Em caso de reação, interrompa o uso imediatamente."
        },
        {
            q: "Como devo armazenar os produtos?",
            a: "Armazene em local fresco e seco, longe de luz solar direta e calor excessivo. Sempre feche bem a embalagem após o uso."
        },
        {
            q: "Posso usar vários produtos ao mesmo tempo?",
            a: "Sim! Nossa linha foi criada para ser complementar. Use o Quizz para montar sua rotina personalizada com os produtos que se potencializam mutuamente."
        }
    ];

    return (
        <main>
            <Header />
            <div style={{ maxWidth: 860, margin: "0 auto", padding: "60px 20px 80px" }}>
                <h1 style={{ textAlign: "center", color: "#2d5a27", marginBottom: 8, fontSize: "2rem" }}>
                    Perguntas Frequentes
                </h1>
                <p style={{ textAlign: "center", color: "#666", marginBottom: 48 }}>
                    Tire suas dúvidas sobre nossos produtos e serviços.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {faqs.map((faq, i) => (
                        <div
                            key={i}
                            style={{
                                background: "#fff",
                                border: "1px solid #e8f5e9",
                                borderRadius: 12,
                                padding: "24px 28px",
                                boxShadow: "0 2px 8px rgba(45,90,39,0.06)"
                            }}
                        >
                            <h3 style={{ color: "#2d5a27", marginBottom: 10, fontSize: "1.05rem", fontWeight: 600 }}>
                                {faq.q}
                            </h3>
                            <p style={{ color: "#555", lineHeight: 1.7, margin: 0 }}>{faq.a}</p>
                        </div>
                    ))}
                </div>

                <div style={{
                    marginTop: 56,
                    textAlign: "center",
                    background: "linear-gradient(135deg, #2d5a27 0%, #4a7c59 100%)",
                    borderRadius: 16,
                    padding: "40px 32px",
                    color: "#fff"
                }}>
                    <h2 style={{ marginBottom: 12 }}>Ainda tem dúvidas?</h2>
                    <p style={{ opacity: 0.9, marginBottom: 24 }}>Nossa equipe está pronta para te ajudar!</p>
                    <a href="/contato" style={{
                        background: "#fff",
                        color: "#2d5a27",
                        padding: "12px 32px",
                        borderRadius: 8,
                        fontWeight: 700,
                        textDecoration: "none",
                        display: "inline-block"
                    }}>
                        ENTRAR EM CONTATO
                    </a>
                </div>
            </div>
            <Footer />
        </main>
    );
}
