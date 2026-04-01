"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { useAuth } from "@/context/AuthContext";
import styles from "./perfil.module.css";
import { 
    User, Package, MapPin, LogOut, FileText, 
    CheckCircle, Truck, Clock, XCircle, Map, Filter, Pencil, Save, X, Camera
} from "lucide-react";

export default function UserProfile() {
    const { user, isLoading: authLoading, logout, refreshProfile } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");
    const [statusFilter, setStatusFilter] = useState("all");
    const [isPaying, setIsPaying] = useState<number | null>(null);
    const router = useRouter();

    // Edit Profile State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editPhoto, setEditPhoto] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/auth/me/profile-picture", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (res.ok) {
                const updatedUser = await res.json();
                setProfile((prev: any) => ({ ...prev, profile_picture: updatedUser.profile_picture }));
                setEditPhoto(updatedUser.profile_picture);
                refreshProfile();
            } else {
                alert("Erro ao fazer upload da imagem.");
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Erro de conexão.");
        } finally {
            setIsUploading(false);
        }
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const tab = params.get("tab");
            if (tab) {
                setActiveTab(tab);
            }
        }
    }, []);

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
                return dateB - dateA; // Descending
            })
        : [];

    const handleResumePayment = async (order: any) => {
        setIsPaying(order.id);
        try {
            const token = localStorage.getItem("token");
            
            // Fix: Use order_items from the database properly mapped by the new backend schema
            const finalItems = (order.order_items && order.order_items.length > 0) ? order.order_items : order.items;
            
            const res = await fetch("/api/payment/create-preference", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    order_id: order.id,
                    items: finalItems?.map((i: any) => ({
                        product_id: i.product_id || 0,
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

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/auth/me/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    full_name: editName,
                    profile_picture: editPhoto
                })
            });

            if (res.ok) {
                const updatedUser = await res.json();
                setProfile({ ...profile, full_name: updatedUser.full_name, profile_picture: updatedUser.profile_picture });
                setIsEditing(false);
                refreshProfile(); // update AuthContext state
            } else {
                alert("Erro ao salvar dados.");
            }
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            alert("Erro de comunicação.");
        } finally {
            setIsSaving(false);
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
                    setEditName(data.full_name || "");
                    setEditPhoto(data.profile_picture || "");
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
                                <div className={styles.sectionHeader} style={{ justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <User />
                                        <h2>Meus Dados</h2>
                                    </div>
                                    {!isEditing && (
                                        <button className={styles.editBtn} onClick={() => {
                                            setIsEditing(true);
                                            setEditName(profile.full_name || "");
                                            setEditPhoto(profile.profile_picture || "");
                                        }}>
                                            <Pencil size={18} /> Editar Perfil
                                        </button>
                                    )}
                                </div>

                                {isEditing ? (
                                    <div className={styles.editForm}>
                                        <div className={styles.avatarEditContainer}>
                                            <div className={styles.avatarWrapper} onClick={() => document.getElementById('profilePictureInput')?.click()}>
                                                {editPhoto ? (
                                                    <img src={editPhoto} alt="Foto de perfil" className={styles.avatarPreview} />
                                                ) : (
                                                    <div className={styles.avatarPlaceholder}>
                                                        <User size={40} color="#94a3b8" />
                                                    </div>
                                                )}
                                                <div className={styles.avatarOverlay}>
                                                    <Camera size={24} color="#ffffff" />
                                                </div>
                                            </div>
                                            {isUploading ? (
                                                <span style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>Enviando imagem...</span>
                                            ) : (
                                                <span style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>Clique para alterar a foto</span>
                                            )}
                                            <input 
                                                id="profilePictureInput"
                                                type="file" 
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                onChange={handleImageUpload}
                                                disabled={isUploading}
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Nome Completo</label>
                                            <input 
                                                type="text" 
                                                className={styles.inputField} 
                                                value={editName} 
                                                onChange={(e) => setEditName(e.target.value)} 
                                            />
                                        </div>
                                        <div className={styles.formActions}>
                                            <button 
                                                className={styles.cancelBtn} 
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    setEditName(profile.full_name || "");
                                                    setEditPhoto(profile.profile_picture || "");
                                                }}
                                            >
                                                <X size={18} /> Cancelar
                                            </button>
                                            <button 
                                                className={styles.saveBtn} 
                                                onClick={handleSaveProfile}
                                                disabled={isSaving}
                                            >
                                                <Save size={18} /> {isSaving ? "Salvando..." : "Salvar Dados"}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.dataGrid}>
                                        <div className={styles.profileAvatarCard} style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                            {profile.profile_picture ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={profile.profile_picture} alt={profile.full_name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
                                            ) : (
                                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e2e8f0' }}>
                                                    <User size={32} color="#94a3b8" />
                                                </div>
                                            )}
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>{profile.full_name || "Membro Ecosopis"}</h3>
                                                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{profile.email}</span>
                                            </div>
                                        </div>

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
                                )}
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
                                            const isPaidOrBeyond = ['paid', 'shipped', 'delivered'].includes((order.status || "").toLowerCase());
                                            const finalItems = (order.order_items && order.order_items.length > 0) ? order.order_items : order.items;

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
                                                            {isPaidOrBeyond && (
                                                                <button
                                                                    onClick={() => router.push(`/pedido/${order.id}`)}
                                                                    className={styles.detailsBtn}
                                                                >
                                                                    Acompanhar Pedido
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
                                                            {Array.isArray(finalItems) && finalItems.length > 0 ? (
                                                                finalItems.map((item: any, idx: number) => (
                                                                    <div key={idx} className={styles.orderItem}>
                                                                        <div className={styles.itemName}>
                                                                            <span className={styles.itemQty}>{item.quantity}x</span> 
                                                                            {item.product_name || "Produto Ecológico"}
                                                                        </div>
                                                                        <div className={styles.itemPrice}>
                                                                            {((item.price || 0) * (item.quantity || 1)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className={styles.orderItem}>
                                                                    <div className={styles.itemName}>Itens na nuvem / Processando...</div>
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
