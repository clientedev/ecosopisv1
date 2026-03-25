"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Package, CheckCircle, Truck, Clock, ShoppingBag, ChevronRight, XCircle } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Pendente", color: "#f59e0b", icon: Clock },
    paid: { label: "Pago", color: "#10b981", icon: CheckCircle },
    shipped: { label: "Enviado", color: "#3b82f6", icon: Truck },
    delivered: { label: "Entregue", color: "#2d5a27", icon: Package },
    cancelled: { label: "Cancelado", color: "#ef4444", icon: XCircle },
    payment_error: { label: "Erro", color: "#ef4444", icon: XCircle },
};

export default function ContaPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const { login, logout, token, user, refreshProfile } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (token) {
            refreshProfile();
            fetchOrders();
        }
    }, [token]);

    useEffect(() => {
        if (user && user.role === 'admin') {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
    }, [user]);

    const fetchOrders = async () => {
        const t = localStorage.getItem("token");
        if (!t) return;
        setLoadingOrders(true);
        try {
            const res = await fetch("/api/orders/", {
                headers: { Authorization: `Bearer ${t}` },
            });
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            }
        } catch (e) {
            console.error("Error fetching orders:", e);
        } finally {
            setLoadingOrders(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isLogin) {
            try {
                const success = await login(email, password);
                if (success) {
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
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password, full_name: name })
                });

                if (res.ok) {
                    alert("Conta criada com sucesso! Entrando...");
                    const loginSuccess = await login(email, password);
                    if (loginSuccess) { router.push("/"); }
                    else { setIsLogin(true); alert("Conta criada, mas login automático falhou. Tente entrar manualmente."); }
                } else {
                    let errorMessage = "Erro ao criar conta.";
                    try { const data = await res.json(); errorMessage = data.detail || errorMessage; } catch { }
                    alert(errorMessage + " Verifique se o e-mail já está em uso.");
                }
            } catch (err) {
                console.error("Registration error:", err);
                alert("Não foi possível conectar ao servidor.");
            }
        }
    };

    const handleLogout = () => {
        logout();
        router.push("/");
    };

    return (
        <main>
            <Header />
            <div className={`container ${styles.contaContainer}`}>
                <div className={styles.formBox}>
                    {isAdmin && (
                        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #10b981', textAlign: 'center' }}>
                            <p style={{ color: '#065f46', fontWeight: 'bold', marginBottom: '10px' }}>Você está logado como Administrador</p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                <Link href="/admin/dashboard" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>ACESSAR PAINEL ADMIN</Link>
                                <button onClick={handleLogout} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>SAIR</button>
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

                    {/* ── Logged in user: show profile + orders ── */}
                    {!isAdmin && token && user && (
                        <>
                            {/* Profile Card */}
                            <div style={{
                                background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
                                borderRadius: "16px", padding: "24px", marginBottom: "28px",
                                border: "1px solid #d1fae5"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
                                    <div style={{
                                        width: 52, height: 52, borderRadius: "50%",
                                        background: "#2d5a27", display: "flex", alignItems: "center",
                                        justifyContent: "center", color: "white", fontSize: "1.3rem", fontWeight: 700
                                    }}>
                                        {(user.full_name || user.email || "U")[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#1a3a16" }}>
                                            {user.full_name || "Usuário"}
                                        </h2>
                                        <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                                            {user.email}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={handleLogout} style={{
                                    width: "100%", padding: "10px", backgroundColor: "#ef4444",
                                    color: "white", border: "none", borderRadius: "8px",
                                    cursor: "pointer", fontWeight: 700, fontSize: "0.9rem"
                                }}>
                                    SAIR DA CONTA
                                </button>
                            </div>

                            {/* ── Order History ── */}
                            <div style={{ marginBottom: "20px" }}>
                                <h3 style={{
                                    fontSize: "1.1rem", fontWeight: 700, color: "#1a3a16",
                                    marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px"
                                }}>
                                    <ShoppingBag size={20} /> Meus Pedidos
                                </h3>

                                {loadingOrders ? (
                                    <p style={{ textAlign: "center", color: "#94a3b8", padding: "24px" }}>
                                        Carregando pedidos...
                                    </p>
                                ) : orders.length === 0 ? (
                                    <div style={{
                                        textAlign: "center", padding: "40px 20px",
                                        background: "#f8fafc", borderRadius: "12px", border: "1px dashed #d1d5db"
                                    }}>
                                        <ShoppingBag size={40} style={{ color: "#d1d5db", marginBottom: "12px" }} />
                                        <p style={{ color: "#94a3b8", marginBottom: "16px" }}>
                                            Você ainda não fez nenhum pedido.
                                        </p>
                                        <Link href="/produtos" style={{
                                            display: "inline-block", padding: "10px 24px",
                                            background: "#2d5a27", color: "white", borderRadius: "8px",
                                            textDecoration: "none", fontWeight: 700, fontSize: "0.9rem"
                                        }}>
                                            VER PRODUTOS
                                        </Link>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                        {orders.map((order: any) => {
                                            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                                            const Icon = cfg.icon;
                                            return (
                                                <Link
                                                    key={order.id}
                                                    href={`/pedido/${order.id}`}
                                                    style={{ textDecoration: "none", color: "inherit" }}
                                                >
                                                    <div style={{
                                                        background: "white", borderRadius: "14px",
                                                        padding: "16px 20px",
                                                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                                                        border: "1px solid #f1f5f9",
                                                        display: "flex", alignItems: "center", gap: "14px",
                                                        transition: "box-shadow 0.2s",
                                                        cursor: "pointer"
                                                    }}>
                                                        <div style={{
                                                            minWidth: 40, height: 40, borderRadius: "10px",
                                                            background: cfg.color + "15",
                                                            display: "flex", alignItems: "center", justifyContent: "center"
                                                        }}>
                                                            <Icon size={18} color={cfg.color} />
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111" }}>
                                                                    Pedido #{order.id}
                                                                </span>
                                                                <span style={{
                                                                    fontSize: "0.78rem", fontWeight: 600,
                                                                    color: cfg.color, background: cfg.color + "15",
                                                                    padding: "3px 10px", borderRadius: "12px"
                                                                }}>
                                                                    {cfg.label}
                                                                </span>
                                                            </div>
                                                            <div style={{
                                                                display: "flex", justifyContent: "space-between",
                                                                marginTop: "4px", fontSize: "0.82rem", color: "#64748b"
                                                            }}>
                                                                <span>
                                                                    {(order.items || []).length} item(s)
                                                                </span>
                                                                <span style={{ fontWeight: 600, color: "#2d5a27" }}>
                                                                    R$ {Number(order.total || 0).toFixed(2).replace(".", ",")}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                                                                {order.created_at ? new Date(order.created_at).toLocaleDateString("pt-BR") : "—"}
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={18} color="#cbd5e1" />
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── Login / Register Form ── */}
                    {!token && (
                        <>
                            <div className={styles.tabs}>
                                <button className={isLogin ? styles.activeTab : ""} onClick={() => setIsLogin(true)}>ENTRAR</button>
                                <button className={!isLogin ? styles.activeTab : ""} onClick={() => setIsLogin(false)}>CADASTRAR</button>
                            </div>

                            <form onSubmit={handleSubmit} className={styles.form}>
                                {!isLogin && (
                                    <div className={styles.field}>
                                        <label>Nome Completo</label>
                                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                                    </div>
                                )}
                                <div className={styles.field}>
                                    <label>E-mail</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                </div>
                                <div className={styles.field}>
                                    <label>Senha</label>
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                                </div>
                                <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                                    {isLogin ? "ENTRAR" : "CRIAR CONTA"}
                                </button>
                            </form>

                            {isLogin && (
                                <div className={styles.links}><a href="#">Esqueci minha senha</a></div>
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
