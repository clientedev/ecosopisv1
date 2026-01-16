"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";

export default function ContaPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isLogin) {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}`;
                const formData = new FormData();
                formData.append("username", email);
                formData.append("password", password);

                const res = await fetch(`${apiUrl}/api/auth/login`, {
                    method: "POST",
                    body: formData,
                });

                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem("token", data.access_token);
                    if (data.role === "admin") {
                        router.push("/admin/dashboard");
                    } else {
                        // Redirect normal user to account dashboard if it exists, or home
                        router.push("/");
                    }
                } else {
                    alert("Credenciais inválidas");
                }
            } catch (err) {
                alert("Erro ao conectar com o servidor");
            }
        } else {
            // Cadastro logic
            console.log("Cadastro", { email, password, name });
        }
    };

    return (
        <main>
            <Header />
            <div className={`container ${styles.contaContainer}`}>
                <div className={styles.formBox}>
                    <div className={styles.tabs}>
                        <button
                            className={isLogin ? styles.activeTab : ""}
                            onClick={() => setIsLogin(true)}
                        >
                            ENTRAR
                        </button>
                        <button
                            className={!isLogin ? styles.activeTab : ""}
                            onClick={() => setIsLogin(false)}
                        >
                            CADASTRAR
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        {!isLogin && (
                            <div className={styles.field}>
                                <label>Nome Completo</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        <div className={styles.field}>
                            <label>E-mail</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className={styles.field}>
                            <label>Senha</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                            {isLogin ? "ENTRAR" : "CRIAR CONTA"}
                        </button>
                    </form>

                    {isLogin && (
                        <div className={styles.links}>
                            <a href="#">Esqueci minha senha</a>
                        </div>
                    )}

                    <div className={styles.benefits}>
                        <h3>BENEFÍCIOS DA CONTA ECOSOPIS</h3>
                        <ul>
                            <li>✓ Histórico de pedidos</li>
                            <li>✓ Endereços salvos</li>
                            <li>✓ Recomendações personalizadas</li>
                            <li>✓ Ofertas exclusivas</li>
                        </ul>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}
