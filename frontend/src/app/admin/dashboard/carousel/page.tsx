"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import EditCarouselModal from "./EditCarouselModal";
import EditStoryModal from "./EditStoryModal";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import { GripVertical, Video, Play, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { isGoogleDriveUrl, getGoogleDriveDirectStreamUrl, getGoogleDriveEmbedUrl } from "@/utils/driveUtils";

export default function CarouselAdmin() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [isSavingOrder, setIsSavingOrder] = useState(false);

    // Stories state
    const [stories, setStories] = useState<any[]>([]);
    const [loadingStories, setLoadingStories] = useState(true);
    const [editingStory, setEditingStory] = useState<any>(null);
    const [isCreateStoryModalOpen, setIsCreateStoryModalOpen] = useState(false);

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

    const fetchStories = async () => {
        setLoadingStories(true);
        try {
            const res = await fetch('/api/carousel/stories/all', {
                cache: 'no-store',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem("token")}`
                }
            });
            if (!res.ok) return;
            const data = await res.json();
            setStories(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching stories:", error);
        } finally {
            setLoadingStories(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }
        fetchItems();
        fetchStories();
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

    const updateCarouselItem = async (item: any, updates: Record<string, any>) => {
        try {
            const updatedItem = { ...item, ...updates };
            const data = new FormData();
            
            Object.entries(updatedItem).forEach(([key, value]) => {
                if (key === "id" || key === "file" || key === "mobile_file" || key === "created_at" || key === "slide_duration_ms") return;
                if (value === null || value === undefined) return;
                if (typeof value === "boolean") {
                    data.append(key, value ? "true" : "false");
                } else if (typeof value === "number") {
                    data.append(key, String(value));
                } else {
                    data.append(key, String(value));
                }
            });

            const res = await fetch(`/api/carousel/${item.id}`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
                body: data,
            });
            return res.ok;
        } catch (error) {
            console.error("Error updating carousel item:", error);
            return false;
        }
    };

    const toggleActive = async (item: any) => {
        const success = await updateCarouselItem(item, { is_active: !item.is_active });
        if (success) fetchItems();
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const reorderedItems = [...items];
        const [draggedItem] = reorderedItems.splice(draggedIndex, 1);
        reorderedItems.splice(index, 0, draggedItem);
        
        setDraggedIndex(index);
        setItems(reorderedItems);
    };

    const handleDragEnd = async () => {
        if (draggedIndex === null) return;
        setDraggedIndex(null);
        
        setIsSavingOrder(true);
        try {
            const promises = items.map((item, idx) => {
                if (item.order === idx) return Promise.resolve(true);
                return updateCarouselItem(item, { order: idx });
            });
            await Promise.all(promises);
        } catch (error) {
            console.error("Error saving new order:", error);
        } finally {
            setIsSavingOrder(false);
            fetchItems();
        }
    };

    const handleDeleteStory = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este story da home?")) return;
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/carousel/stories/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                setStories(prev => prev.filter(s => s.id !== id));
            }
        } catch (error) {
            console.error("Error deleting story:", error);
        }
    };

    const toggleActiveStory = async (story: any) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/carousel/stories/${story.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ is_active: !story.is_active })
            });
            if (res.ok) {
                fetchStories();
            }
        } catch (error) {
            console.error("Error updating story active state:", error);
        }
    };

    const handleMoveStory = async (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= stories.length) return;

        const newStories = [...stories];
        const [moved] = newStories.splice(index, 1);
        newStories.splice(targetIndex, 0, moved);

        const orders = newStories.map((s, idx) => ({ id: s.id, order: idx }));
        setStories(newStories);

        try {
            const token = localStorage.getItem("token");
            await fetch('/api/carousel/stories/reorder', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(orders)
            });
        } catch (err) {
            console.error("Error reordering stories:", err);
            fetchStories();
        }
    };

    return (
        <div className={styles.dashboard} style={{ height: '100vh', overflow: 'hidden', display: 'flex' }}>
            <AdminSidebar activePath="/admin/dashboard/carousel" />
            <main className={styles.mainContent} style={{ flex: 1, overflowY: 'auto' }}>
                <header className={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h1>Gerenciar Banners</h1>
                        {isSavingOrder && (
                            <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ⏳ Salvando nova ordem...
                            </span>
                        )}
                    </div>
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
                            {items.map((item: any, index: number) => (
                                <div key={item.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragEnd={handleDragEnd}
                                    style={{
                                        background: 'white',
                                        border: draggedIndex === index ? '1px dashed #10b981' : '1px solid #e5e7eb',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                        opacity: draggedIndex === index ? 0.4 : (item.is_active === false ? 0.65 : 1),
                                        transition: 'opacity 0.2s, border-color 0.2s',
                                        cursor: 'grab',
                                    }}
                                >
                                    {/* Drag Handle */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0 12px',
                                        color: '#94a3b8',
                                        borderRight: '1px solid #f1f5f9',
                                        background: '#fafafa',
                                        userSelect: 'none',
                                    }}>
                                        <GripVertical size={20} />
                                    </div>
                                    {/* Image Thumbnail */}
                                    <div style={{ width: '160px', minWidth: '160px', height: '90px', position: 'relative', overflow: 'hidden', background: '#f3f4f6' }}>
                                        {(item.image_url || item.mobile_image_url) ? (
                                            <img
                                                src={item.image_url || item.mobile_image_url}
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

                {/* ───────────────────────────────────────────────────────────── */}
                {/* SEÇÃO DE STORIES DA HOME (LOGO ABAIXO DO BANNER)              */}
                {/* ───────────────────────────────────────────────────────────── */}
                <div style={{ padding: '24px 16px 40px', marginTop: '16px', borderTop: '2px dashed #e2e8f0' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '18px',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: '#f0fdf4',
                                    color: '#2d5a27',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Video size={18} />
                                </div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                                    Stories em Destaque (Abaixo do Banner)
                                </h2>
                                <span style={{
                                    background: 'linear-gradient(135deg, #d4a373 0%, #2d5a27 100%)',
                                    color: 'white',
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    padding: '3px 8px',
                                    borderRadius: '20px',
                                    letterSpacing: '0.04em'
                                }}>
                                    HOME
                                </span>
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                                Bolinhas de Story que aparecem logo abaixo do carrossel no site, com vídeos em autoplay contínuo e visualizador imersivo.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingStory(null);
                                setIsCreateStoryModalOpen(true);
                            }}
                            style={{
                                background: '#2d5a27',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '10px 18px',
                                fontSize: '0.88rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(45, 90, 39, 0.25)'
                            }}
                        >
                            <Plus size={18} />
                            Novo Story
                        </button>
                    </div>

                    {loadingStories ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#666' }}>Carregando stories...</div>
                    ) : stories.length === 0 ? (
                        <div style={{
                            background: '#fafaf9',
                            border: '1px dashed #d6d3d1',
                            borderRadius: '16px',
                            padding: '40px 24px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✨</div>
                            <h3 style={{ fontSize: '1.05rem', color: '#292524', margin: '0 0 6px' }}>
                                Nenhum Story da Home configurado ainda
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: '#78716c', maxWidth: '480px', margin: '0 auto 16px' }}>
                                Adicione pequenos vídeos curtos (Google Drive ou MP4) mostrando seus produtos, bastidores ou como usar para engajar os clientes logo abaixo do banner!
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingStory(null);
                                    setIsCreateStoryModalOpen(true);
                                }}
                                style={{
                                    background: '#2d5a27',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '8px 16px',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                + Adicionar Primeiro Story
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {stories.map((story: any, index: number) => {
                                const isDrive = isGoogleDriveUrl(story.video_url);
                                const directDrive = isDrive ? getGoogleDriveDirectStreamUrl(story.video_url) : null;
                                return (
                                    <div
                                        key={story.id || index}
                                        style={{
                                            background: 'white',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '12px',
                                            padding: '12px 16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '16px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                            opacity: story.is_active === false ? 0.6 : 1
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            {/* Bolinha Preview */}
                                            <div style={{
                                                width: '56px',
                                                height: '56px',
                                                borderRadius: '50%',
                                                padding: '2.5px',
                                                background: 'linear-gradient(135deg, #d4a373 0%, #2d5a27 50%, #cca43b 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <div style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    borderRadius: '50%',
                                                    overflow: 'hidden',
                                                    background: '#111',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {directDrive || (!isDrive && story.video_url) ? (
                                                        <video
                                                            src={directDrive || story.video_url}
                                                            muted
                                                            playsInline
                                                            loop
                                                            autoPlay
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    ) : story.thumbnail_url ? (
                                                        <img
                                                            src={story.thumbnail_url}
                                                            alt={story.title}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <Play size={16} color="white" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Detalhes */}
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                                    <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                                                        {story.title}
                                                    </strong>
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 700,
                                                        color: story.is_active === false ? '#ef4444' : '#10b981'
                                                    }}>
                                                        {story.is_active === false ? '● Inativo' : '● Ativo'}
                                                    </span>
                                                    {isDrive && (
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            background: '#eff6ff',
                                                            color: '#2563eb',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            fontWeight: 600
                                                        }}>
                                                            Google Drive
                                                        </span>
                                                    )}
                                                </div>
                                                <p style={{
                                                    margin: 0,
                                                    fontSize: '0.78rem',
                                                    color: '#64748b',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '420px'
                                                }}>
                                                    {story.video_url}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Botões */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {/* Reordenação */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <button
                                                    type="button"
                                                    disabled={index === 0}
                                                    onClick={() => handleMoveStory(index, 'up')}
                                                    style={{
                                                        background: '#f1f5f9',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '3px 6px',
                                                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                                                        opacity: index === 0 ? 0.3 : 1
                                                    }}
                                                    title="Mover para cima"
                                                >
                                                    <ArrowUp size={14} color="#475569" />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={index === stories.length - 1}
                                                    onClick={() => handleMoveStory(index, 'down')}
                                                    style={{
                                                        background: '#f1f5f9',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '3px 6px',
                                                        cursor: index === stories.length - 1 ? 'not-allowed' : 'pointer',
                                                        opacity: index === stories.length - 1 ? 0.3 : 1
                                                    }}
                                                    title="Mover para baixo"
                                                >
                                                    <ArrowDown size={14} color="#475569" />
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => toggleActiveStory(story)}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #e5e7eb',
                                                    background: story.is_active === false ? '#f0fdf4' : '#fff5f5',
                                                    color: story.is_active === false ? '#10b981' : '#ef4444',
                                                    fontWeight: 600,
                                                    fontSize: '0.78rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {story.is_active === false ? 'Ativar' : 'Desativar'}
                                            </button>

                                            <button
                                                type="button"
                                                className={styles.editBtn}
                                                onClick={() => {
                                                    setEditingStory(story);
                                                    setIsCreateStoryModalOpen(false);
                                                }}
                                            >
                                                Editar
                                            </button>

                                            <button
                                                type="button"
                                                className={styles.deleteBtn}
                                                onClick={() => handleDeleteStory(story.id)}
                                            >
                                                Excluir
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Modal de Banner */}
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

                {/* Modal de Story */}
                {(editingStory || isCreateStoryModalOpen) && (
                    <EditStoryModal
                        story={editingStory}
                        onClose={() => {
                            setEditingStory(null);
                            setIsCreateStoryModalOpen(false);
                        }}
                        onSave={() => {
                            setEditingStory(null);
                            setIsCreateStoryModalOpen(false);
                            fetchStories();
                        }}
                    />
                )}
            </main>
        </div>
    );
}
