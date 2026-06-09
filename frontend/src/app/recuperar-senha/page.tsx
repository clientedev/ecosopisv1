"use client";
import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "../conta/page.module.css";

export default function RecuperarSenhaPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (res.ok) {
                setSent(true);
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.detail || "Erro ao processar solicitação. Tente novamente.");
            }
        } catch {
            setError("Não foi possível conectar ao servidor. Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main>
            <Header />
            <div className={`container ${styles.contaContainer}`}>
                <div className={styles.formBox}>
                    {sent ? (
                        <div style={{ textAlign: "center", padding: "30px 10px" }}>
                            <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>📩</div>
                            <h1 style={{ color: "#2d5a27", fontSize: "1.5rem", marginBottom: "12px" }}>
                                E-mail enviado!
                            </h1>
                            <p style={{ color: "#4a7c59", lineHeight: "1.6", marginBottom: "8px" }}>
                                Se o endereço <strong>{email}</strong> estiver cadastrado,
                                você receberá um link para redefinir sua senha em instantes.
                            </p>
                            <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: "24px" }}>
                                Verifique também a pasta de <strong>spam</strong> ou lixo eletrônico.
                            </p>
                            <Link href="/conta" className="btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
                                VOLTAR PARA O LOGIN
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div style={{ textAlign: "center", marginBottom: "28px" }}>
                                <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>🔑</div>
                                <h1 style={{ color: "#1a3a16", fontSize: "1.4rem", marginBottom: "8px" }}>
                                    Esqueceu sua senha?
                                </h1>
                                <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: "1.5" }}>
                                    Sem problemas! Informe seu e-mail e enviaremos um link para você criar uma nova senha.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className={styles.form}>
                                <div className={styles.field}>
                                    <label htmlFor="email-reset">E-mail cadastrado</label>
                                    <input
                                        id="email-reset"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="seu@email.com"
                                        required
                                        autoFocus
                                    />
                                </div>

                                {error && (
                                    <div style={{
                                        background: "#fef2f2", border: "1px solid #fecaca",
                                        borderRadius: "8px", padding: "12px 16px",
                                        color: "#dc2626", fontSize: "0.88rem", marginBottom: "4px"
                                    }}>
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn-primary"
                                    style={{ width: "100%", marginTop: "4px" }}
                                    disabled={loading}
                                >
                                    {loading ? "ENVIANDO..." : "ENVIAR LINK DE RECUPERAÇÃO"}
                                </button>
                            </form>

                            <div className={styles.links} style={{ marginTop: "20px" }}>
                                <Link href="/conta">← Voltar para o login</Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </main>
    );
}
