"use client";
import { useState, useEffect } from "react";
import styles from "../dashboard.module.css";

interface ModalProps {
    item?: any;
    onClose: () => void;
    onSave: (item: any) => void;
}

export default function EditCarouselModal({ item, onClose, onSave }: ModalProps) {
    const [activeTab, setActiveTab] = useState("content");
    const [formData, setFormData] = useState({
        badge: item?.badge || "",
        title: item?.title || "",
        description: item?.description || "",
        image_url: item?.image_url || "",
        cta_primary_text: item?.cta_primary_text || "",
        cta_primary_link: item?.cta_primary_link || "",
        cta_secondary_text: item?.cta_secondary_text || "",
        cta_secondary_link: item?.cta_secondary_link || "",
        order: item?.order || 0,
        is_active: item?.is_active ?? true,
        alignment: item?.alignment || "left",
        vertical_alignment: item?.vertical_alignment || "center",
        content_max_width: item?.content_max_width || "500px",
        glassmorphism: item?.glassmorphism ?? false,
        title_color: item?.title_color || "#ffffff",
        description_color: item?.description_color || "#ffffff",
        badge_color: item?.badge_color || "#ffffff",
        badge_bg_color: item?.badge_bg_color || "#4a7c59",
        overlay_color: item?.overlay_color || "#000000",
        overlay_opacity: item?.overlay_opacity ?? 0.3,
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(item?.image_url || null);
    const [loading, setLoading] = useState(false);

    const getImageUrl = (url?: string) => {
        if (!url) return "/logo_final.png";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("images/")) return `/api/${url}`;
        if (url.startsWith("/attached_assets/")) return `/static${url}`;
        if (url.startsWith("attached_assets/")) return `/static/${url}`;
        return url;
    };

    useEffect(() => {
        if (selectedFile) {
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(selectedFile);
        }
    }, [selectedFile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = item ? `/api/carousel/${item.id}` : `/api/carousel`;
            const method = item ? "PUT" : "POST";
            const data = new FormData();

            Object.keys(formData).forEach(key => {
                const value = formData[key as keyof typeof formData];
                if (value !== null && value !== undefined) {
                    data.append(key, value.toString());
                }
            });

            if (selectedFile) data.append("file", selectedFile);

            const res = await fetch(url, {
                method,
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
                body: data,
            });

            const responseData = await res.json();
            if (res.ok) {
                onClose();
                setTimeout(() => onSave(responseData), 100);
            } else {
                alert(`Erro ao salvar: ${JSON.stringify(responseData.detail || responseData)}`);
            }
        } catch (error) {
            alert("Erro de conexão ao salvar.");
        } finally {
            setLoading(false);
        }
    };

    const flexAlignmentMap: Record<string, string> = {
        left: 'flex-start',
        center: 'center',
        right: 'flex-end',
        top: 'flex-start',
        bottom: 'flex-end'
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '1200px', width: '95%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 1.2fr', height: '100%' }}>
                    {/* Painel de Edição */}
                    <div style={{ padding: '30px', borderRight: '1px solid #eee', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: '25px' }}>
                            <h2 style={{ margin: 0 }}>{item ? "Editar Banner" : "Criar Banner"}</h2>
                            <p style={{ margin: '5px 0 0 0', opacity: 0.6, fontSize: '0.9rem' }}>Configure o visual e o conteúdo do seu slide.</p>
                        </div>

                        {/* Tabs Navigation */}
                        <div style={{ display: 'flex', gap: '5px', marginBottom: '25px', background: '#f5f5f5', padding: '5px', borderRadius: '10px' }}>
                            {['content', 'design', 'actions'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: activeTab === tab ? 'white' : 'transparent',
                                        boxShadow: activeTab === tab ? '0 2px 5px rgba(0,0,0,0.1)' : 'none',
                                        fontWeight: 600,
                                        color: activeTab === tab ? '#10b981' : '#666',
                                        transition: 'all 0.2s',
                                        textTransform: 'capitalize',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {tab === 'content' ? '📝 Conteúdo' : tab === 'design' ? '🎨 Design' : '🔗 Botões'}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit} style={{ flex: 1 }}>
                            {activeTab === 'content' && (
                                <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr' }}>
                                    <div className={styles.formGroup}>
                                        <label>Título do Banner</label>
                                        <input type="text" placeholder="Ex: Transformação com a Natureza" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Subtítulo / Descrição</label>
                                        <textarea style={{ height: '80px' }} placeholder="Texto de apoio para o banner..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Selo (Badge)</label>
                                        <input type="text" placeholder="Ex: NOVIDADE ✨" value={formData.badge} onChange={e => setFormData({ ...formData, badge: e.target.value })} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Imagem de Fundo</label>
                                        <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                                        <p className={styles.helpText}>Recomendado: 1920x600px</p>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Ordem de Exibição</label>
                                        <input type="number" value={formData.order} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'design' && (
                                <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr' }}>
                                    <div className={styles.formGroup}>
                                        <label>Posicionamento do Conteúdo (Clique no Quadrado)</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '150px', margin: '10px 0' }}>
                                            {['top', 'center', 'bottom'].map(v =>
                                                ['left', 'center', 'right'].map(h => (
                                                    <button
                                                        key={`${v}-${h}`}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, alignment: h, vertical_alignment: v })}
                                                        style={{
                                                            width: '45px',
                                                            height: '45px',
                                                            borderRadius: '6px',
                                                            border: '2px solid',
                                                            borderColor: (formData.alignment === h && formData.vertical_alignment === v) ? '#10b981' : '#ddd',
                                                            background: (formData.alignment === h && formData.vertical_alignment === v) ? '#dcfce7' : '#fff',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        title={`${v} ${h}`}
                                                    >
                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: (formData.alignment === h && formData.vertical_alignment === v) ? '#10b981' : '#ccc' }}></div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <div className={styles.formGroup}>
                                            <label>Efeito Caixa Vidro (Glassmorphism)</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.glassmorphism}
                                                    onChange={e => setFormData({ ...formData, glassmorphism: e.target.checked })}
                                                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                                />
                                                <span>Ativar fundo desfocado</span>
                                            </div>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Largura Máxima Texto</label>
                                            <input type="text" value={formData.content_max_width} onChange={e => setFormData({ ...formData, content_max_width: e.target.value })} placeholder="Ex: 500px ou 60%" />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                        <div className={styles.formGroup}>
                                            <label>Cor Título</label>
                                            <input type="color" value={formData.title_color} onChange={e => setFormData({ ...formData, title_color: e.target.value })} style={{ height: '40px', padding: '2px' }} />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Cor Texto</label>
                                            <input type="color" value={formData.description_color} onChange={e => setFormData({ ...formData, description_color: e.target.value })} style={{ height: '40px', padding: '2px' }} />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Sobreposição</label>
                                            <input type="color" value={formData.overlay_color} onChange={e => setFormData({ ...formData, overlay_color: e.target.value })} style={{ height: '40px', padding: '2px' }} />
                                        </div>
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Opacidade da Sobreposição ({Math.round(formData.overlay_opacity * 100)}%)</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={formData.overlay_opacity}
                                            onChange={e => setFormData({ ...formData, overlay_opacity: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'actions' && (
                                <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <div className={styles.formGroup}>
                                            <label>Botão 1 (Texto)</label>
                                            <input type="text" value={formData.cta_primary_text} onChange={e => setFormData({ ...formData, cta_primary_text: e.target.value })} />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Botão 1 (Link)</label>
                                            <input type="text" value={formData.cta_primary_link} onChange={e => setFormData({ ...formData, cta_primary_link: e.target.value })} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <div className={styles.formGroup}>
                                            <label>Botão 2 (Texto)</label>
                                            <input type="text" value={formData.cta_secondary_text} onChange={e => setFormData({ ...formData, cta_secondary_text: e.target.value })} />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Botão 2 (Link)</label>
                                            <input type="text" value={formData.cta_secondary_link} onChange={e => setFormData({ ...formData, cta_secondary_link: e.target.value })} />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '10px' }}>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '10px' }}>Cores do Selo (Badge)</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                            <div className={styles.formGroup}>
                                                <label>Texto Selo</label>
                                                <input type="color" value={formData.badge_color} onChange={e => setFormData({ ...formData, badge_color: e.target.value })} style={{ height: '40px', padding: '2px' }} />
                                            </div>
                                            <div className={styles.formGroup}>
                                                <label>Fundo Selo</label>
                                                <input type="color" value={formData.badge_bg_color} onChange={e => setFormData({ ...formData, badge_bg_color: e.target.value })} style={{ height: '40px', padding: '2px' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className={styles.formActions} style={{ margin: '30px -30px -30px -30px', padding: '20px 30px', background: '#f8fafc', borderTop: '1px solid #eee' }}>
                                <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2 }}>
                                    {loading ? "Processando..." : (item ? "Atualizar Banner" : "Criar Banner")}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Previsualização Live */}
                    <div style={{ background: '#f0f2f5', padding: '30px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ margin: 0 }}>Visualização</h2>
                            <span style={{ fontSize: '0.8rem', background: '#e2e8f0', padding: '4px 10px', borderRadius: '15px', fontWeight: 600 }}>LIVE PREVIEW</span>
                        </div>

                        <div style={{
                            flex: 1,
                            width: '100%',
                            border: '1px solid #ddd',
                            borderRadius: '12px',
                            position: 'relative',
                            overflow: 'hidden',
                            backgroundColor: '#fff',
                            backgroundImage: previewUrl ? `linear-gradient(rgba(${parseInt(formData.overlay_color.slice(1, 3), 16)}, ${parseInt(formData.overlay_color.slice(3, 5), 16)}, ${parseInt(formData.overlay_color.slice(5, 7), 16)}, ${formData.overlay_opacity}), rgba(${parseInt(formData.overlay_color.slice(1, 3), 16)}, ${parseInt(formData.overlay_color.slice(3, 5), 16)}, ${parseInt(formData.overlay_color.slice(5, 7), 16)}, ${formData.overlay_opacity})), url(${previewUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            display: 'flex',
                            alignItems: flexAlignmentMap[formData.vertical_alignment] || 'center',
                            justifyContent: flexAlignmentMap[formData.alignment] || 'center',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                            <div style={{
                                maxWidth: formData.content_max_width || '500px',
                                textAlign: formData.alignment as any,
                                zIndex: 2,
                                padding: '40px',
                                transition: 'all 0.3s ease',
                                margin: '20px',
                                borderRadius: '20px',
                                background: formData.glassmorphism ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                backdropFilter: formData.glassmorphism ? 'blur(10px)' : 'none',
                                WebkitBackdropFilter: formData.glassmorphism ? 'blur(10px)' : 'none',
                                border: formData.glassmorphism ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                                boxShadow: formData.glassmorphism ? '0 8px 32px 0 rgba(0, 0, 0, 0.2)' : 'none'
                            }}>
                                {formData.badge && (
                                    <span
                                        className="scientific-badge"
                                        style={{
                                            marginBottom: '15px',
                                            display: 'inline-block',
                                            backgroundColor: formData.badge_bg_color,
                                            color: formData.badge_color,
                                            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        {formData.badge}
                                    </span>
                                )}
                                {formData.title ? (
                                    <h1 style={{
                                        fontSize: '2.2rem',
                                        lineHeight: 1.1,
                                        margin: '0 0 15px 0',
                                        color: formData.title_color,
                                        fontWeight: 800,
                                        letterSpacing: '-1px',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}>
                                        {formData.title}
                                    </h1>
                                ) : (
                                    <h1 style={{ color: '#ccc', fontStyle: 'italic' }}>Título do Banner...</h1>
                                )}
                                {formData.description && (
                                    <p style={{
                                        fontSize: '1rem',
                                        margin: '0 0 25px 0',
                                        color: formData.description_color,
                                        opacity: 0.95,
                                        lineHeight: 1.5
                                    }}>
                                        {formData.description}
                                    </p>
                                )}
                                <div style={{ display: 'flex', gap: '10px', justifyContent: flexAlignmentMap[formData.alignment] === 'flex-end' ? 'flex-end' : flexAlignmentMap[formData.alignment] === 'center' ? 'center' : 'flex-start' }}>
                                    {formData.cta_primary_text && (
                                        <button className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>
                                            {formData.cta_primary_text}
                                        </button>
                                    )}
                                    {formData.cta_secondary_text && (
                                        <button
                                            className="btn-outline"
                                            style={{
                                                padding: '10px 20px',
                                                fontSize: '0.85rem',
                                                color: 'white',
                                                borderColor: 'white',
                                                background: 'rgba(255,255,255,0.1)'
                                            }}
                                        >
                                            {formData.cta_secondary_text}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
