"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function ContaPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    const { login, logout, token, user, refreshProfile } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (token) {
            refreshProfile();
        }
    }, [token]);

    useEffect(() => {
        if (user && user.role === 'admin') {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isLogin) {
            try {
                const success = await login(email, password);
                if (success) {
                    // AuthContext already fetched user profile and set state
                    const searchParams = new URLSearchParams(window.location.search);
                    const redirect = searchParams.get('redirect') || "/";
                    router.push(redirect);
                } else {
                    alert("Credenciais inválidas. Verifique seu e-mail e senha.");
                }
            } catch (err) {
                console.error("Login error:", err);
                alert("Erro ao tentar entrar. Tente novamente em instantes.");
            }
        } else {
            try {
                const res = await fetch('/api/auth/register', {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        password,
                        full_name: name
                    })
                });

                if (res.ok) {
                    alert("Conta criada com sucesso! Entrando...");
                    const loginSuccess = await login(email, password);
                    if (loginSuccess) {
                        router.push("/");
                    } else {
                        setIsLogin(true);
                        alert("Conta criada com sucesso, mas o login automático falhou. Por favor, tente entrar manualmente com seu e-mail e senha.");
                    }
                } else {
                    let errorMessage = "Erro ao criar conta.";
                    try {
                        const data = await res.json();
                        errorMessage = data.detail || errorMessage;
                    } catch (e) {
                        errorMessage += ` Status: ${res.status}`;
                    }
                    alert(errorMessage + " Verifique se o e-mail já está em uso.");
                }
            } catch (err) {
                console.error("Registration error:", err);
                alert("Não foi possível conectar ao servidor de cadastro. Verifique sua conexão ou se o sistema está online.");
            }
        }
    };

    const handleLogout = () => {
        logout();
        router.push("/");
    };

    return (
        <main>
            {/* VERSION: 1.0.6 */}
            <Header />
            <div className={`container ${styles.contaContainer}`}>
                <div className={styles.formBox}>
                    {isAdmin && (
                        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #10b981', textAlign: 'center' }}>
                            <p style={{ color: '#065f46', fontWeight: 'bold', marginBottom: '10px' }}>Você está logado como Administrador</p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                <Link href="/admin/dashboard" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>ACESSAR PAINEL ADMIN</Link>
                                <button onClick={handleLogout} className={styles.logoutBtn} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>SAIR</button>
                            </div>
                        </div>
                    )}

                    {!isAdmin && user && user.pode_girar_roleta && (
                        <div className={styles.rouletteCard} onClick={() => window.dispatchEvent(new CustomEvent('open-roulette'))}>
                            <span className={styles.spinIcon}>🎡</span>
                            <h2>VOCÊ TEM UM GIRO GRÁTIS!</h2>
                            <p>Use sua sorte agora para ganhar prêmios exclusivos de autocuidado.</p>
                            <span className={styles.cardBtn}>GIRAR RULETA AGORA</span>
                        </div>
                    )}

                    {!isAdmin && token && (
                        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                            <button onClick={handleLogout} className="btn-primary" style={{ backgroundColor: '#ef4444' }}>SAIR DA CONTA</button>
                        </div>
                    )}

                    {!token && (
                        <>
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
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </main>
    );
}
