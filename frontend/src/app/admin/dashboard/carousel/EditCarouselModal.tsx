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
    const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

    const [formData, setFormData] = useState({
        badge: item?.badge || "",
        title: item?.title || "",
        description: item?.description || "",
        image_url: item?.image_url || "",
        mobile_image_url: item?.mobile_image_url || "",
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
        offset_x: item?.offset_x || "0%",
        offset_y: item?.offset_y || "0%",
        title_color: item?.title_color || "#ffffff",
        description_color: item?.description_color || "#ffffff",
        badge_color: item?.badge_color || "#ffffff",
        badge_bg_color: item?.badge_bg_color || "#4a7c59",
        overlay_color: item?.overlay_color || "#000000",
        overlay_opacity: item?.overlay_opacity ?? 0.3,
        carousel_height: item?.carousel_height || "700px",
        mobile_carousel_height: item?.mobile_carousel_height || "400px",
        image_fit: item?.image_fit || "cover",
    });

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedMobileFile, setSelectedMobileFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(item?.image_url || null);
    const [mobilePreviewUrl, setMobilePreviewUrl] = useState<string | null>(item?.mobile_image_url || null);
    const [loading, setLoading] = useState(false);

    const getImageUrl = (url?: string) => {
        if (!url) return null;
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        return url;
    };

    useEffect(() => {
        if (selectedFile) {
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(selectedFile);
        }
    }, [selectedFile]);

    useEffect(() => {
        if (selectedMobileFile) {
            const reader = new FileReader();
            reader.onloadend = () => setMobilePreviewUrl(reader.result as string);
            reader.readAsDataURL(selectedMobileFile);
        }
    }, [selectedMobileFile]);

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
            if (selectedMobileFile) data.append("mobile_file", selectedMobileFile);

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

    const coordinateMap: Record<string, number> = {
        left: 10, center: 50, right: 90, top: 10, bottom: 90
    };

    const currentPreviewUrl = previewDevice === "mobile"
        ? (mobilePreviewUrl || previewUrl)
        : previewUrl;

    const currentHeight = previewDevice === "mobile"
        ? formData.mobile_carousel_height
        : formData.carousel_height;

    const hexToRgba = (hex: string, opacity: number) => {
        try {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        } catch {
            return `rgba(0,0,0,${opacity})`;
        }
    };

    const tabs = [
        { id: 'content', label: '📝 Conteúdo' },
        { id: 'mobile', label: '📱 Mobile' },
        { id: 'design', label: '🎨 Design' },
        { id: 'actions', label: '🔗 Botões' },
    ];

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{
                maxWidth: '1280px',
                width: '96%',
                maxHeight: '95vh',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden',
                backgroundColor: 'white'
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(420px, 1fr) 1.3fr',
                    height: '100%',
                    minHeight: 0,
                    overflow: 'hidden'
                }}>
                    {/* ── Edit Panel ── */}
                    <div style={{ padding: '28px', borderRight: '1px solid #eee', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>{item ? "Editar Banner" : "Criar Banner"}</h2>
                            <p style={{ margin: '4px 0 0 0', opacity: 0.55, fontSize: '0.88rem' }}>Configure o visual e o conteúdo do slide.</p>
                        </div>

                        {/* Tab Nav */}
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '22px', background: '#f5f5f5', padding: '4px', borderRadius: '10px' }}>
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        flex: 1,
                                        padding: '9px 6px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: activeTab === tab.id ? 'white' : 'transparent',
                                        boxShadow: activeTab === tab.id ? '0 2px 5px rgba(0,0,0,0.1)' : 'none',
                                        fontWeight: 600,
                                        fontSize: '0.78rem',
                                        color: activeTab === tab.id ? '#10b981' : '#666',
                                        transition: 'all 0.2s',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit} style={{ flex: 1 }}>

                            {/* ── CONTENT TAB ── */}
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
                                        <label>🖥️ Imagem Desktop</label>
                                        <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                                        <p className={styles.helpText}>Recomendado: 1920×600px — exibida em telas &gt; 768px</p>
                                        {previewUrl && (
                                            <img src={previewUrl} alt="Preview desktop" style={{ marginTop: 8, width: '100%', maxHeight: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
                                        )}
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Ordem de Exibição</label>
                                        <input type="number" value={formData.order} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} />
                                    </div>
                                </div>
                            )}

                            {/* ── MOBILE TAB ── */}
                            {activeTab === 'mobile' && (
                                <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr' }}>
                                    <div style={{ padding: '14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', fontSize: '0.84rem', color: '#166534', lineHeight: 1.6 }}>
                                        📱 Configure aqui a <strong>imagem específica para celular</strong> e a altura do carousel em cada dispositivo. Se não enviar uma imagem mobile, será usada a imagem desktop.
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>📱 Imagem Mobile</label>
                                        <input type="file" accept="image/*" onChange={e => setSelectedMobileFile(e.target.files?.[0] || null)} />
                                        <p className={styles.helpText}>Recomendado: 768×500px — exibida em telas ≤ 768px</p>
                                        {(mobilePreviewUrl || item?.mobile_image_url) && (
                                            <img
                                                src={mobilePreviewUrl || getImageUrl(item?.mobile_image_url) || ''}
                                                alt="Preview mobile"
                                                style={{ marginTop: 8, width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8, border: '2px solid #10b981' }}
                                            />
                                        )}
                                        {!mobilePreviewUrl && !item?.mobile_image_url && (
                                            <div style={{ marginTop: 8, padding: '20px', textAlign: 'center', background: '#f5f5f5', borderRadius: 8, color: '#999', fontSize: '0.82rem' }}>
                                                Nenhuma imagem mobile — usará a imagem desktop
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div className={styles.formGroup}>
                                            <label>Altura Desktop</label>
                                            <input
                                                type="text"
                                                value={formData.carousel_height}
                                                onChange={e => setFormData({ ...formData, carousel_height: e.target.value })}
                                                placeholder="Ex: 600px ou 70vh"
                                            />
                                            <p className={styles.helpText}>Altura do carousel no desktop</p>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Altura Mobile</label>
                                            <input
                                                type="text"
                                                value={formData.mobile_carousel_height}
                                                onChange={e => setFormData({ ...formData, mobile_carousel_height: e.target.value })}
                                                placeholder="Ex: 400px ou 50vh"
                                            />
                                            <p className={styles.helpText}>Altura do carousel no celular</p>
                                        </div>
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Ajuste da Imagem (Proporção)</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '8px' }}>
                                            {[
                                                { value: 'cover', label: '🔲 Cobrir', desc: 'Preenche tudo (pode cortar)' },
                                                { value: 'contain', label: '⬜ Conter', desc: 'Imagem inteira visível' },
                                                { value: '100% 100%', label: '↔️ Esticar', desc: 'Estica para preencher' },
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, image_fit: opt.value })}
                                                    style={{
                                                        padding: '12px 8px',
                                                        border: '2px solid',
                                                        borderColor: formData.image_fit === opt.value ? '#10b981' : '#e5e7eb',
                                                        borderRadius: '10px',
                                                        background: formData.image_fit === opt.value ? '#f0fdf4' : '#fff',
                                                        cursor: 'pointer',
                                                        textAlign: 'center',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{opt.label.split(' ')[0]}</div>
                                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: formData.image_fit === opt.value ? '#10b981' : '#374151' }}>{opt.label.split(' ').slice(1).join(' ')}</div>
                                                    <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '2px' }}>{opt.desc}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── DESIGN TAB ── */}
                            {activeTab === 'design' && (
                                <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr' }}>
                                    <div className={styles.formGroup}>
                                        <label>Posicionamento do Conteúdo</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '150px', margin: '10px 0' }}>
                                            {['top', 'center', 'bottom'].map(v =>
                                                ['left', 'center', 'right'].map(h => (
                                                    <button
                                                        key={`${v}-${h}`}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, alignment: h, vertical_alignment: v })}
                                                        style={{
                                                            width: '45px', height: '45px', borderRadius: '6px', border: '2px solid',
                                                            borderColor: (formData.alignment === h && formData.vertical_alignment === v) ? '#10b981' : '#ddd',
                                                            background: (formData.alignment === h && formData.vertical_alignment === v) ? '#dcfce7' : '#fff',
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                                        }}
                                                        title={`${v} ${h}`}
                                                    >
                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: (formData.alignment === h && formData.vertical_alignment === v) ? '#10b981' : '#ccc' }} />
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <div className={styles.formGroup}>
                                            <label>Glassmorphism</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                                                <input type="checkbox" checked={formData.glassmorphism} onChange={e => setFormData({ ...formData, glassmorphism: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                                                <span>Ativar fundo desfocado</span>
                                            </div>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Largura Máxima Texto</label>
                                            <input type="text" value={formData.content_max_width} onChange={e => setFormData({ ...formData, content_max_width: e.target.value })} placeholder="500px ou 60%" />
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
                                        <input type="range" min="0" max="1" step="0.05" value={formData.overlay_opacity} onChange={e => setFormData({ ...formData, overlay_opacity: parseFloat(e.target.value) })} />
                                    </div>

                                    <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                        <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.025em', display: 'block', marginBottom: '12px' }}>
                                            🎯 Ajuste Fino de Posição
                                        </label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                            <div className={styles.formGroup}>
                                                <label style={{ fontSize: '0.8rem' }}>Deslocamento X</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="range" min="-100" max="100" value={parseInt(formData.offset_x) || 0} onChange={e => setFormData({ ...formData, offset_x: `${e.target.value}%` })} style={{ flex: 1 }} />
                                                    <span style={{ minWidth: '40px', fontSize: '0.8rem', fontWeight: 600, color: '#10b981' }}>{formData.offset_x}</span>
                                                </div>
                                            </div>
                                            <div className={styles.formGroup}>
                                                <label style={{ fontSize: '0.8rem' }}>Deslocamento Y</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="range" min="-100" max="100" value={parseInt(formData.offset_y) || 0} onChange={e => setFormData({ ...formData, offset_y: `${e.target.value}%` })} style={{ flex: 1 }} />
                                                    <span style={{ minWidth: '40px', fontSize: '0.8rem', fontWeight: 600, color: '#10b981' }}>{formData.offset_y}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── ACTIONS TAB ── */}
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

                            <div className={styles.formActions} style={{ margin: '24px -28px -28px -28px', padding: '18px 28px', background: '#f8fafc', borderTop: '1px solid #eee' }}>
                                <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2 }}>
                                    {loading ? "Processando..." : (item ? "Atualizar Banner" : "Criar Banner")}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* ── LIVE PREVIEW ── */}
                    <div style={{ background: '#f0f2f5', padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0 }}>Visualização</h2>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    onClick={() => setPreviewDevice('desktop')}
                                    style={{
                                        padding: '6px 14px', borderRadius: '20px', border: '2px solid',
                                        borderColor: previewDevice === 'desktop' ? '#10b981' : '#ddd',
                                        background: previewDevice === 'desktop' ? '#f0fdf4' : '#fff',
                                        fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                                        color: previewDevice === 'desktop' ? '#10b981' : '#666'
                                    }}
                                >
                                    🖥️ Desktop
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewDevice('mobile')}
                                    style={{
                                        padding: '6px 14px', borderRadius: '20px', border: '2px solid',
                                        borderColor: previewDevice === 'mobile' ? '#10b981' : '#ddd',
                                        background: previewDevice === 'mobile' ? '#f0fdf4' : '#fff',
                                        fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                                        color: previewDevice === 'mobile' ? '#10b981' : '#666'
                                    }}
                                >
                                    📱 Mobile
                                </button>
                                <span style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '4px 10px', borderRadius: '15px', fontWeight: 600 }}>LIVE PREVIEW</span>
                            </div>
                        </div>

                        {/* Height indicator */}
                        <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '16px' }}>
                            <span>📐 Altura: <strong style={{ color: '#10b981' }}>{currentHeight}</strong></span>
                            <span>🖼️ Ajuste: <strong style={{ color: '#10b981' }}>{formData.image_fit}</strong></span>
                            {previewDevice === 'mobile' && !mobilePreviewUrl && !item?.mobile_image_url && (
                                <span style={{ color: '#f59e0b' }}>⚠️ Sem imagem mobile — usando desktop</span>
                            )}
                        </div>

                        {/* Preview box */}
                        <div style={{
                            width: previewDevice === 'mobile' ? '320px' : '100%',
                            margin: previewDevice === 'mobile' ? '0 auto' : '0',
                            border: '2px solid #ddd',
                            borderRadius: '12px',
                            position: 'relative',
                            overflow: 'hidden',
                            backgroundColor: '#1a1a1a',
                            backgroundImage: currentPreviewUrl
                                ? `${hexToRgba(formData.overlay_color, formData.overlay_opacity) !== 'rgba(0,0,0,0)' ? `linear-gradient(${hexToRgba(formData.overlay_color, formData.overlay_opacity)}, ${hexToRgba(formData.overlay_color, formData.overlay_opacity)}), ` : ''}url(${currentPreviewUrl})`
                                : 'none',
                            backgroundSize: formData.image_fit,
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            display: 'block',
                            height: previewDevice === 'mobile' ? formData.mobile_carousel_height : formData.carousel_height,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                            transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                            flexShrink: 0
                        }}>
                            {!currentPreviewUrl && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexDirection: 'column', gap: '8px' }}>
                                    <span style={{ fontSize: '2.5rem' }}>🖼️</span>
                                    <span style={{ fontSize: '0.85rem' }}>Adicione uma imagem para ver a prévia</span>
                                </div>
                            )}
                            <div style={{
                                maxWidth: formData.content_max_width || '500px',
                                zIndex: 2,
                                padding: '32px',
                                transition: 'all 0.3s ease',
                                borderRadius: '20px',
                                background: formData.glassmorphism ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                backdropFilter: formData.glassmorphism ? 'blur(10px)' : 'none',
                                WebkitBackdropFilter: formData.glassmorphism ? 'blur(10px)' : 'none',
                                border: formData.glassmorphism ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                                position: 'absolute',
                                left: previewDevice === 'mobile' ? '50%' : `${coordinateMap[formData.alignment] + (parseInt(formData.offset_x) || 0)}%`,
                                top: previewDevice === 'mobile' ? '50%' : `${coordinateMap[formData.vertical_alignment] + (parseInt(formData.offset_y) || 0)}%`,
                                transform: 'translate(-50%, -50%)',
                                textAlign: (previewDevice === 'mobile' ? 'center' : formData.alignment === 'center' ? 'center' : formData.alignment === 'right' ? 'right' : 'left') as any,
                                width: previewDevice === 'mobile' ? '90%' : 'fit-content',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                {formData.badge && (
                                    <span className="scientific-badge" style={{ marginBottom: '12px', display: 'inline-block', backgroundColor: formData.badge_bg_color, color: formData.badge_color, alignSelf: previewDevice === 'mobile' ? 'center' : (formData.alignment === 'right' ? 'flex-end' : formData.alignment === 'center' ? 'center' : 'flex-start') }}>
                                        {formData.badge}
                                    </span>
                                )}
                                {formData.title ? (
                                    <h1 style={{ fontSize: previewDevice === 'mobile' ? '1.5rem' : '2.2rem', lineHeight: 1.1, margin: '0 0 12px 0', color: formData.title_color, fontWeight: 800 }}>
                                        {formData.title}
                                    </h1>
                                ) : (
                                    <h1 style={{ color: '#aaa', fontStyle: 'italic', fontSize: '1.4rem' }}>Título do Banner...</h1>
                                )}
                                {formData.description && (
                                    <p style={{ fontSize: '0.9rem', margin: '0 0 20px 0', color: formData.description_color, opacity: 0.95, lineHeight: 1.5 }}>
                                        {formData.description}
                                    </p>
                                )}
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: previewDevice === 'mobile' ? 'center' : (formData.alignment === 'right' ? 'flex-end' : formData.alignment === 'center' ? 'center' : 'flex-start') }}>
                                    {formData.cta_primary_text && (
                                        <button className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.82rem' }}>{formData.cta_primary_text}</button>
                                    )}
                                    {formData.cta_secondary_text && (
                                        <button className="btn-outline" style={{ padding: '8px 18px', fontSize: '0.82rem', color: 'white', borderColor: 'white', background: 'rgba(255,255,255,0.1)' }}>{formData.cta_secondary_text}</button>
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
