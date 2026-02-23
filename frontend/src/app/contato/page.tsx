"use client";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { useState } from "react";

export default function Contato() {
    const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
    const [status, setStatus] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");
        // Simulate sending (replace with real API later)
        await new Promise(r => setTimeout(r, 1000));
        setStatus("success");
        setForm({ name: "", email: "", subject: "", message: "" });
    };

    return (
        <main>
            <Header />
            <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 20px 80px" }}>
                <h1 style={{ textAlign: "center", color: "#2d5a27", marginBottom: 8, fontSize: "2rem" }}>
                    Fale Conosco
                </h1>
                <p style={{ textAlign: "center", color: "#666", marginBottom: 56 }}>
                    Estamos aqui para te ajudar com qualquer dúvida sobre nossos produtos.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
                    {/* Info */}
                    <div>
                        {[
                            { icon: "📧", title: "E-mail", value: "contato@ecosopis.com.br" },
                            { icon: "📱", title: "WhatsApp", value: "(11) 99999-9999" },
                            { icon: "🕐", title: "Horário de Atendimento", value: "Seg–Sex: 9h às 18h" },
                            { icon: "📍", title: "Localização", value: "Brasil" }
                        ].map((item, i) => (
                            <div key={i} style={{
                                display: "flex", gap: 16, alignItems: "flex-start",
                                marginBottom: 32, padding: "20px 24px",
                                background: "#fff", borderRadius: 12,
                                border: "1px solid #e8f5e9",
                                boxShadow: "0 2px 8px rgba(45,90,39,0.06)"
                            }}>
                                <span style={{ fontSize: 28 }}>{item.icon}</span>
                                <div>
                                    <strong style={{ color: "#2d5a27", display: "block", marginBottom: 4 }}>{item.title}</strong>
                                    <span style={{ color: "#555" }}>{item.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Form */}
                    <div style={{
                        background: "#fff", borderRadius: 16, padding: "32px",
                        border: "1px solid #e8f5e9", boxShadow: "0 4px 16px rgba(45,90,39,0.08)"
                    }}>
                        <h2 style={{ color: "#2d5a27", marginBottom: 24, fontSize: "1.3rem" }}>Envie sua mensagem</h2>
                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {[
                                { label: "Seu nome", field: "name", type: "text" },
                                { label: "Seu e-mail", field: "email", type: "email" },
                                { label: "Assunto", field: "subject", type: "text" }
                            ].map(({ label, field, type }) => (
                                <div key={field} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <label style={{ color: "#444", fontWeight: 500, fontSize: "0.9rem" }}>{label}</label>
                                    <input
                                        type={type}
                                        required
                                        value={(form as any)[field]}
                                        onChange={e => setForm({ ...form, [field]: e.target.value })}
                                        style={{
                                            padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd",
                                            fontSize: "0.95rem", outline: "none"
                                        }}
                                    />
                                </div>
                            ))}
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <label style={{ color: "#444", fontWeight: 500, fontSize: "0.9rem" }}>Mensagem</label>
                                <textarea
                                    required
                                    rows={5}
                                    value={form.message}
                                    onChange={e => setForm({ ...form, message: e.target.value })}
                                    style={{
                                        padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd",
                                        fontSize: "0.95rem", resize: "vertical", outline: "none"
                                    }}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={status === "loading"}
                                className="btn-primary"
                                style={{ marginTop: 8 }}
                            >
                                {status === "loading" ? "ENVIANDO..." : "ENVIAR MENSAGEM"}
                            </button>
                            {status === "success" && (
                                <p style={{ color: "#2d5a27", textAlign: "center", fontWeight: 600 }}>
                                    ✅ Mensagem enviada! Responderemos em breve.
                                </p>
                            )}
                        </form>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}
