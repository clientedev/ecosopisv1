"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { useAuth } from "@/context/AuthContext";
import styles from "./perfil.module.css";
import { 
    User, Package, MapPin, LogOut, FileText, 
    CheckCircle, Truck, Clock, XCircle, Map, Filter
} from "lucide-react";

export default function UserProfile() {
    const { user, loading: authLoading, logout } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");
    const [statusFilter, setStatusFilter] = useState("all");
    const [isPaying, setIsPaying] = useState<number | null>(null);
    const router = useRouter();

    const filteredAndSortedOrders = profile?.orders
        ? profile.orders
            .filter((order: any) => {
                if (statusFilter === "all") return true;
                const status = order.status || "pending";
                if (statusFilter === "pending") return status === "pending";
                if (statusFilter === "paid") return status === "paid";
                if (statusFilter === "shipped") return status === "shipped";
                if (statusFilter === "delivered") return status === "delivered";
                if (statusFilter === "cancelled") return status === "cancelled" || status === "payment_error";
                return true;
            })
            .sort((a: any, b: any) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA; // Descending (Newest first)
            })
        : [];

    const handleResumePayment = async (order: any) => {
        setIsPaying(order.id);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/payment/create-preference", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    order_id: order.id,
                    items: order.items?.map((i: any) => ({
                        product_id: 0,
                        product_name: i.product_name || "Produto",
                        quantity: i.quantity || 1,
                        price: i.price || 0
                    })) || [],
                    total: order.total || 0,
                    address: order.address || {},
                    shipping_method: order.shipping_method || "fixo",
                    shipping_price: order.shipping_price || 0,
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.checkout_url) {
                    window.location.href = data.checkout_url;
                } else {
                    alert("Erro ao recuperar link de pagamento.");
                }
            } else {
                const err = await res.json();
                alert(`Erro ao gerar pagamento: ${err.detail || 'Tente novamente.'}`);
            }
        } catch (error) {
            console.error("Erro ao retomar pagamento:", error);
            alert("Erro de comunicação com o servidor.");
        } finally {
            setIsPaying(null);
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) {
                    router.push("/conta");
                    return;
                }
                const res = await fetch(`/api/auth/me`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setProfile(data);
                } else {
                    if (res.status === 401 || res.status === 403) {
                         logout();
                         router.push("/conta");
                    }
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [router, logout]);

    if (loading || authLoading) {
        return (
            <main>
                <Header />
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                    <p>Carregando seu portal exclusivo...</p>
                </div>
                <Footer />
            </main>
        );
    }

    if (!profile) return null;

    const handleLogout = () => {
        logout();
        router.push("/conta");
    };

    const getStatusInfo = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending':
                return { label: 'Aguardando Pagamento', icon: <Clock size={16}/>, className: styles.statusPending };
            case 'paid':
                return { label: 'Pagamento Confirmado', icon: <CheckCircle size={16}/>, className: styles.statusPaid };
            case 'shipped':
                return { label: 'Enviado', icon: <Truck size={16}/>, className: styles.statusShipped };
            case 'delivered':
                return { label: 'Entregue', icon: <Package size={16}/>, className: styles.statusDelivered };
            case 'payment_error':
            case 'cancelled':
                return { label: 'Cancelado/Erro', icon: <XCircle size={16}/>, className: styles.statusCancelled };
            default:
                return { label: status, icon: <FileText size={16}/>, className: styles.statusPending };
        }
    };

    return (
        <main>
            <Header />
            <div className={`container ${styles.profileContainer}`}>
                <h1 className={styles.profileTitle}>Minha Conta</h1>
                
                <div className={styles.profileLayout}>
                    {/* Sidebar Navigation */}
                    <aside className={styles.sidebar}>
                        <div className={styles.sidebarTitle}>Menu</div>
                        <button 
                            className={`${styles.navItem} ${activeTab === 'overview' ? styles.active : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <User />
                            Visão Geral
                        </button>
                        <button 
                            className={`${styles.navItem} ${activeTab === 'orders' ? styles.active : ''}`}
                            onClick={() => setActiveTab('orders')}
                        >
                            <Package />
                            Meus Pedidos
                        </button>
                        <button 
                            className={`${styles.navItem} ${activeTab === 'addresses' ? styles.active : ''}`}
                            onClick={() => setActiveTab('addresses')}
                        >
                            <MapPin />
                            Meus Endereços
                        </button>
                        <button 
                            className={`${styles.navItem} ${styles.logout}`}
                            onClick={handleLogout}
                        >
                            <LogOut />
                            Sair da Conta
                        </button>
                    </aside>

                    {/* Main Content Areas */}
                    <div className={styles.mainContent}>
                        {activeTab === 'overview' && (
                            <section>
                                <div className={styles.sectionHeader}>
                                    <User />
                                    <h2>Meus Dados</h2>
                                </div>
                                <div className={styles.dataGrid}>
                                    <div className={styles.dataCard}>
                                        <div className={styles.dataLabel}>Nome Completo</div>
                                        <div className={styles.dataValue}>{profile.full_name}</div>
                                    </div>
                                    <div className={styles.dataCard}>
                                        <div className={styles.dataLabel}>Email</div>
                                        <div className={styles.dataValue}>{profile.email}</div>
                                    </div>
                                    <div className={styles.dataCard}>
                                        <div className={styles.dataLabel}>Membro Desde</div>
                                        <div className={styles.dataValue}>
                                            {profile.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : 'Não informado'}
                                        </div>
                                    </div>
                                    <div className={styles.dataCard}>
                                        <div className={styles.dataLabel}>Total de Compras</div>
                                        <div className={styles.dataValue}>{profile.total_compras || 0}</div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeTab === 'orders' && (
                            <section>
                                <div className={styles.sectionHeader}>
                                    <Package />
                                    <h2>Meus Pedidos</h2>
                                </div>

                                <div className={styles.filterBar}>
                                    <Filter size={18} color="#64748b" />
                                    <select 
                                        className={styles.filterSelect}
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                    >
                                        <option value="all">Todos os Pedidos</option>
                                        <option value="pending">Aguardando Pagamento</option>
                                        <option value="paid">Pagamento Confirmado</option>
                                        <option value="shipped">Enviados</option>
                                        <option value="delivered">Entregues</option>
                                        <option value="cancelled">Cancelados / Erro</option>
                                    </select>
                                </div>
                                
                                <div className={styles.ordersList}>
                                    {filteredAndSortedOrders && filteredAndSortedOrders.length > 0 ? (
                                        filteredAndSortedOrders.map((order: any) => {
                                            const statusInfo = getStatusInfo(order.status || 'pending');
                                            return (
                                                <div key={order.id} className={styles.orderCard}>
                                                    <div className={styles.orderHeader}>
                                                        <div className={styles.orderIdGroup}>
                                                            <span className={styles.orderId}>Pedido #{order.id}</span>
                                                            <span className={styles.orderDate}>
                                                                {order.created_at ? new Date(order.created_at).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                                            </span>
                                                        </div>
                                                        <div className={styles.orderActions}>
                                                            <div className={`${styles.statusBadge} ${statusInfo.className}`}>
                                                                {statusInfo.icon}
                                                                {statusInfo.label}
                                                            </div>
                                                            {order.status === 'pending' && (
                                                                <button 
                                                                    onClick={() => handleResumePayment(order)}
                                                                    disabled={isPaying === order.id}
                                                                    className={styles.checkoutBtn}
                                                                >
                                                                    {isPaying === order.id ? 'Aguarde...' : 'Pagar Agora'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className={styles.orderBody}>
                                                        {order.codigo_rastreio && (
                                                            <div className={styles.trackingInfo}>
                                                                <Truck size={20} />
                                                                <span>Código de Rastreio: <span className={styles.trackingCode}>{order.codigo_rastreio}</span></span>
                                                            </div>
                                                        )}
                                                        
                                                        <div className={styles.orderItems}>
                                                            {Array.isArray(order.items) && order.items.length > 0 ? (
                                                                order.items.map((item: any, idx: number) => (
                                                                    <div key={idx} className={styles.orderItem}>
                                                                        <div className={styles.itemName}>
                                                                            <span className={styles.itemQty}>{item.quantity}x</span> 
                                                                            {item.product_name}
                                                                        </div>
                                                                        <div className={styles.itemPrice}>
                                                                            {((item.price || 0) * (item.quantity || 1)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className={styles.orderItem}>
                                                                    <div className={styles.itemName}>Itens não detalhados</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className={styles.orderFooter}>
                                                            <span className={styles.orderTotalLabel}>Total do Pedido:</span>
                                                            <span className={styles.orderTotalValue}>
                                                                {(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className={styles.noOrders}>
                                            <Package size={48} style={{ opacity: 0.2, marginBottom: '1rem', display: 'block', margin: '0 auto' }} />
                                            <p>Nenhum pedido encontrado com este filtro.</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                        
                        {activeTab === 'addresses' && (
                            <section>
                                <div className={styles.sectionHeader}>
                                    <MapPin />
                                    <h2>Meus Endereços</h2>
                                </div>
                                <div className={styles.dataGrid}>
                                    {profile.addresses && profile.addresses.length > 0 ? (
                                         profile.addresses.map((address: any) => (
                                            <div key={address.id} className={styles.dataCard}>
                                                <div className={styles.dataLabel}>{address.name}</div>
                                                <div className={styles.dataValue} style={{ fontSize: '1rem', lineHeight: '1.5' }}>
                                                    {address.street}, {address.number}
                                                    {address.complement ? ` - ${address.complement}` : ''}<br />
                                                    {address.neighborhood} - {address.city}/{address.state}<br />
                                                    CEP: {address.postal_code}
                                                </div>
                                            </div>
                                         ))
                                    ) : (
                                        <div style={{ gridColumn: '1 / -1' }} className={styles.noOrders}>
                                            <Map size={48} style={{ opacity: 0.2, marginBottom: '1rem', display: 'block', margin: '0 auto' }} />
                                            <p>Você não tem endereços salvos.</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}
