"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Link from "next/link";

export default function ContaPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("token");
        console.log("Token check:", token ? "Exists" : "None");
        if (token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));

                const payload = JSON.parse(jsonPayload);
                console.log("Token payload:", payload);
                if (payload.role === 'admin') {
                    setIsAdmin(true);
                }
            } catch (e) {
                console.error("Error decoding token:", e);
            }
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isLogin) {
            try {
                const formData = new FormData();
                formData.append("username", email);
                formData.append("password", password);

                const res = await fetch('/api/auth/login', {
                    method: "POST",
                    body: formData,
                });

                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem("token", data.access_token);
                    if (data.role === "admin") {
                        router.push("/admin/dashboard");
                    } else {
                        router.push("/");
                    }
                } else {
                    alert("Credenciais inválidas");
                }
            } catch (err) {
                alert("Erro ao conectar com o servidor");
            }
        } else {
            console.log("Cadastro", { email, password, name });
        }
    };

    return (
        <main>
            <Header />
            <div className={`container ${styles.contaContainer}`}>
                <div className={styles.formBox}>
                    {isAdmin && (
                        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #10b981', textAlign: 'center' }}>
                            <p style={{ color: '#065f46', fontWeight: 'bold', marginBottom: '10px' }}>Você está logado como Administrador</p>
                            <Link href="/admin/dashboard" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>ACESSAR PAINEL ADMIN</Link>
                        </div>
                    )}
                    
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
