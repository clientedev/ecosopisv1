"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import EditCarouselModal from "./EditCarouselModal";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";

export default function CarouselAdmin() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const router = useRouter();

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/carousel', {
                cache: 'no-store',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem("token")}`
                }
            });
            if (!res.ok) return;
            const data = await res.json();
            setItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching carousel items:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }
        fetchItems();
    }, [router]);

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este banner?")) return;
        try {
            await fetch(`/api/carousel/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (error) {
            console.error("Error deleting item:", error);
        }
    };

    const toggleActive = async (item: any) => {
        try {
            const data = new FormData();
            data.append("is_active", (!item.is_active).toString());
            data.append("order", String(item.order ?? 0));
            const res = await fetch(`/api/carousel/${item.id}`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
                body: data,
            });
            if (res.ok) fetchItems();
        } catch (error) {
            console.error("Error toggling active:", error);
        }
    };

    return (
        <div className={styles.dashboard} style={{ height: '100vh', overflow: 'hidden', display: 'flex' }}>
            <AdminSidebar activePath="/admin/dashboard/carousel" />
            <main className={styles.mainContent} style={{ flex: 1, overflowY: 'auto' }}>
                <header className={styles.header}>
                    <h1>Gerenciar Banners</h1>
                    <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>+ Novo Banner</button>
                </header>

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Carregando banners...</div>
                ) : items.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🖼️</div>
                        <p style={{ color: '#888', fontSize: '1rem' }}>Nenhum banner criado ainda.</p>
                        <button className="btn-primary" style={{ marginTop: '16px' }} onClick={() => setIsCreateModalOpen(true)}>
                            Criar Primeiro Banner
                        </button>
                    </div>
                ) : (
                    <div style={{ padding: '0 16px 24px' }}>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {items.map((item: any) => (
                                <div key={item.id} style={{
                                    background: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'stretch',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                    opacity: item.is_active === false ? 0.65 : 1,
                                    transition: 'opacity 0.2s',
                                }}>
                                    {/* Image Thumbnail */}
                                    <div style={{ width: '160px', minWidth: '160px', height: '90px', position: 'relative', overflow: 'hidden', background: '#f3f4f6' }}>
                                        {item.image_url ? (
                                            <img
                                                src={item.image_url}
                                                alt={item.title || 'Banner'}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    const parent = target.parentElement;
                                                    if (parent && !parent.querySelector('.no-img-fallback')) {
                                                        const fallback = document.createElement('div');
                                                        fallback.className = 'no-img-fallback';
                                                        fallback.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#cbd5e1;';
                                                        fallback.textContent = '🖼️';
                                                        parent.appendChild(fallback);
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#cbd5e1' }}>🖼️</div>
                                        )}
                                        {/* Mobile badge */}
                                        {item.mobile_image_url && (
                                            <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: '#10b981', color: 'white', fontSize: '0.6rem', fontWeight: 700, padding: '2px 5px', borderRadius: '4px' }}>
                                                📱
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            {item.badge && (
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, background: item.badge_bg_color || '#4a7c59', color: item.badge_color || '#fff', padding: '2px 8px', borderRadius: '20px' }}>
                                                    {item.badge}
                                                </span>
                                            )}
                                            <span style={{ fontSize: '0.72rem', color: item.is_active === false ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                                                {item.is_active === false ? '● Inativo' : '● Ativo'}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Ordem: {item.order}</span>
                                        </div>
                                        <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{item.title || <em style={{ color: '#94a3b8', fontWeight: 400 }}>Sem título</em>}</strong>
                                        {item.description && (
                                            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '500px' }}>
                                                {item.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderLeft: '1px solid #f1f5f9' }}>
                                        <button
                                            onClick={() => toggleActive(item)}
                                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: item.is_active === false ? '#f0fdf4' : '#fff5f5', color: item.is_active === false ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                                        >
                                            {item.is_active === false ? 'Ativar' : 'Desativar'}
                                        </button>
                                        <button
                                            className={styles.editBtn}
                                            onClick={() => setEditingItem(item)}
                                        >
                                            Editar
                                        </button>
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={() => handleDelete(item.id)}
                                        >
                                            Excluir
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(editingItem || isCreateModalOpen) && (
                    <EditCarouselModal
                        item={editingItem}
                        onClose={() => {
                            setEditingItem(null);
                            setIsCreateModalOpen(false);
                        }}
                        onSave={() => {
                            setEditingItem(null);
                            setIsCreateModalOpen(false);
                            fetchItems();
                        }}
                    />
                )}
            </main>
        </div>
    );
}
