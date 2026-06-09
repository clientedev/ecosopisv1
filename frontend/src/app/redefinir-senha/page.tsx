"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "../conta/page.module.css";

function RedefinirSenhaForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [showPass, setShowPass] = useState(false);

    useEffect(() => {
        if (!token) {
            setError("Link inválido. Solicite um novo link de recuperação.");
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password.length < 6) {
            setError("A senha deve ter pelo menos 6 caracteres.");
            return;
        }
        if (password !== confirm) {
            setError("As senhas não coincidem. Tente novamente.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, new_password: password }),
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => router.push("/conta"), 3000);
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.detail || "Token inválido ou expirado. Solicite um novo link.");
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
                    {success ? (
                        <div style={{ textAlign: "center", padding: "30px 10px" }}>
                            <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>✅</div>
                            <h1 style={{ color: "#2d5a27", fontSize: "1.4rem", marginBottom: "12px" }}>
                                Senha redefinida com sucesso!
                            </h1>
                            <p style={{ color: "#4a7c59", lineHeight: "1.6", marginBottom: "24px" }}>
                                Sua senha foi atualizada. Você será redirecionado para o login em instantes...
                            </p>
                            <Link href="/conta" className="btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
                                IR PARA O LOGIN
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div style={{ textAlign: "center", marginBottom: "28px" }}>
                                <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>🔐</div>
                                <h1 style={{ color: "#1a3a16", fontSize: "1.4rem", marginBottom: "8px" }}>
                                    Criar nova senha
                                </h1>
                                <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                                    Escolha uma senha segura para proteger sua conta.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className={styles.form}>
                                <div className={styles.field}>
                                    <label htmlFor="new-password">Nova senha</label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            id="new-password"
                                            type={showPass ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Mínimo 6 caracteres"
                                            required
                                            autoFocus
                                            style={{ paddingRight: "48px", width: "100%", boxSizing: "border-box" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPass(!showPass)}
                                            style={{
                                                position: "absolute", right: "12px", top: "50%",
                                                transform: "translateY(-50%)", background: "none",
                                                border: "none", cursor: "pointer", color: "#94a3b8",
                                                fontSize: "1rem", padding: "0"
                                            }}
                                            aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                                        >
                                            {showPass ? "🙈" : "👁️"}
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="confirm-password">Confirmar nova senha</label>
                                    <input
                                        id="confirm-password"
                                        type={showPass ? "text" : "password"}
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        placeholder="Repita a nova senha"
                                        required
                                    />
                                </div>

                                {/* Password strength indicator */}
                                {password.length > 0 && (
                                    <div style={{ marginBottom: "12px" }}>
                                        <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                                            {[1, 2, 3, 4].map((i) => (
                                                <div key={i} style={{
                                                    flex: 1, height: "4px", borderRadius: "2px",
                                                    backgroundColor: password.length >= i * 3
                                                        ? i <= 1 ? "#ef4444" : i <= 2 ? "#f59e0b" : i <= 3 ? "#3b82f6" : "#10b981"
                                                        : "#e2e8f0"
                                                }} />
                                            ))}
                                        </div>
                                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                            {password.length < 3 ? "Muito fraca" :
                                             password.length < 6 ? "Fraca" :
                                             password.length < 9 ? "Boa" : "Forte"}
                                        </span>
                                    </div>
                                )}

                                {error && (
                                    <div style={{
                                        background: "#fef2f2", border: "1px solid #fecaca",
                                        borderRadius: "8px", padding: "12px 16px",
                                        color: "#dc2626", fontSize: "0.88rem"
                                    }}>
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn-primary"
                                    style={{ width: "100%", marginTop: "4px" }}
                                    disabled={loading || !token}
                                >
                                    {loading ? "SALVANDO..." : "SALVAR NOVA SENHA"}
                                </button>
                            </form>

                            <div className={styles.links} style={{ marginTop: "16px" }}>
                                <Link href="/recuperar-senha">Solicitar novo link</Link>
                                {" · "}
                                <Link href="/conta">Voltar ao login</Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </main>
    );
}

export default function RedefinirSenhaPage() {
    return (
        <Suspense fallback={
            <main>
                <div style={{ textAlign: "center", padding: "80px 20px", color: "#64748b" }}>
                    Carregando...
                </div>
            </main>
        }>
            <RedefinirSenhaForm />
        </Suspense>
    );
}
