"use client";
import { useState, useEffect } from "react";
import styles from "../dashboard.module.css";
import { Rnd } from "react-rnd";

interface ModalProps {
    item?: any;
    onClose: () => void;
    onSave: (item: any) => void;
}

export default function EditCarouselModal({ item, onClose, onSave }: ModalProps) {
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
        elements_config: (typeof item?.elements_config === 'string' ? JSON.parse(item.elements_config) : item?.elements_config) || {
            badge: { x: 50, y: 50, width: 200, height: "auto" },
            title: { x: 50, y: 100, width: 500, height: "auto" },
            description: { x: 50, y: 220, width: 500, height: "auto" },
            buttons: { x: 50, y: 350, width: 400, height: "auto" }
        }
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(item?.image_url || null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (selectedFile) {
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(selectedFile);
        }
    }, [selectedFile]);

    const handleElementChange = (element: string, data: any) => {
        setFormData(prev => ({
            ...prev,
            elements_config: {
                ...prev.elements_config,
                [element]: { ...prev.elements_config[element as keyof typeof prev.elements_config], ...data }
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = item ? `/api/carousel/${item.id}` : `/api/carousel`;
            const method = item ? "PUT" : "POST";
            const data = new FormData();
            
            Object.keys(formData).forEach(key => {
                const value = formData[key as keyof typeof formData];
                if (key === 'elements_config') {
                    data.append(key, JSON.stringify(value));
                } else if (value !== null && value !== undefined && value !== "") {
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

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '1200px', width: '98%', height: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px', flex: 1, overflow: 'hidden' }}>
                    {/* Painel de Edição */}
                    <div style={{ overflowY: 'auto', paddingRight: '10px' }}>
                        <h2>{item ? "Editar Slide" : "Novo Slide"}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr' }}>
                                <div className={styles.formGroup}>
                                    <label>Badge</label>
                                    <input type="text" value={formData.badge} onChange={e => setFormData({...formData, badge: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Título</label>
                                    <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Descrição</label>
                                    <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Imagem de Fundo</label>
                                    <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Ou URL da Imagem</label>
                                    <input type="text" value={formData.image_url} onChange={e => {
                                        setFormData({...formData, image_url: e.target.value});
                                        setPreviewUrl(e.target.value);
                                    }} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Botão 1 (Texto)</label>
                                    <input type="text" value={formData.cta_primary_text} onChange={e => setFormData({...formData, cta_primary_text: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Botão 1 (Link)</label>
                                    <input type="text" value={formData.cta_primary_link} onChange={e => setFormData({...formData, cta_primary_link: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Botão 2 (Texto)</label>
                                    <input type="text" value={formData.cta_secondary_text} onChange={e => setFormData({...formData, cta_secondary_text: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Botão 2 (Link)</label>
                                    <input type="text" value={formData.cta_secondary_link} onChange={e => setFormData({...formData, cta_secondary_link: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Ordem</label>
                                    <input type="number" value={formData.order} onChange={e => setFormData({...formData, order: parseInt(e.target.value) || 0})} />
                                </div>
                            </div>
                            <div className={styles.formActions} style={{ marginTop: '20px', position: 'sticky', bottom: 0, background: 'white', padding: '10px 0' }}>
                                <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
                                    {loading ? "Salvando..." : "Salvar"}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Editor Estilo Canva */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h2 style={{ marginBottom: '10px' }}>Editor Visual (Arraste e Redimensione)</h2>
                        <div id="canva-viewport" style={{ 
                            flex: 1,
                            border: '2px solid #4a7c44', 
                            borderRadius: '8px',
                            position: 'relative',
                            overflow: 'hidden',
                            backgroundColor: '#eee',
                            backgroundImage: previewUrl ? `url(${previewUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}>
                            {formData.badge && (
                                <Rnd
                                    size={{ width: formData.elements_config.badge.width, height: formData.elements_config.badge.height }}
                                    position={{ x: formData.elements_config.badge.x, y: formData.elements_config.badge.y }}
                                    onDragStop={(e, d) => handleElementChange('badge', { x: d.x, y: d.y })}
                                    onResizeStop={(e, direction, ref, delta, position) => handleElementChange('badge', { width: ref.style.width, height: ref.style.height, ...position })}
                                    bounds="parent"
                                >
                                    <div style={{ padding: '5px', cursor: 'move', background: 'rgba(255,255,255,0.6)', border: '1px dashed #666' }}>
                                        <span className="scientific-badge" style={{ margin: 0, fontSize: '12px' }}>{formData.badge}</span>
                                    </div>
                                </Rnd>
                            )}

                            {formData.title && (
                                <Rnd
                                    size={{ width: formData.elements_config.title.width, height: formData.elements_config.title.height }}
                                    position={{ x: formData.elements_config.title.x, y: formData.elements_config.title.y }}
                                    onDragStop={(e, d) => handleElementChange('title', { x: d.x, y: d.y })}
                                    onResizeStop={(e, direction, ref, delta, position) => handleElementChange('title', { width: ref.style.width, height: ref.style.height, ...position })}
                                    bounds="parent"
                                >
                                    <div style={{ padding: '5px', cursor: 'move', background: 'rgba(255,255,255,0.6)', border: '1px dashed #666' }}>
                                        <h3 style={{ margin: 0, fontSize: '24px', color: '#1a1a1a' }}>{formData.title}</h3>
                                    </div>
                                </Rnd>
                            )}

                            {formData.description && (
                                <Rnd
                                    size={{ width: formData.elements_config.description.width, height: formData.elements_config.description.height }}
                                    position={{ x: formData.elements_config.description.x, y: formData.elements_config.description.y }}
                                    onDragStop={(e, d) => handleElementChange('description', { x: d.x, y: d.y })}
                                    onResizeStop={(e, direction, ref, delta, position) => handleElementChange('description', { width: ref.style.width, height: ref.style.height, ...position })}
                                    bounds="parent"
                                >
                                    <div style={{ padding: '5px', cursor: 'move', background: 'rgba(255,255,255,0.6)', border: '1px dashed #666' }}>
                                        <p style={{ margin: 0, fontSize: '14px', color: '#444' }}>{formData.description}</p>
                                    </div>
                                </Rnd>
                            )}

                            {formData.cta_primary_text && (
                                <Rnd
                                    size={{ width: formData.elements_config.buttons.width, height: formData.elements_config.buttons.height }}
                                    position={{ x: formData.elements_config.buttons.x, y: formData.elements_config.buttons.y }}
                                    onDragStop={(e, d) => handleElementChange('buttons', { x: d.x, y: d.y })}
                                    onResizeStop={(e, direction, ref, delta, position) => handleElementChange('buttons', { width: ref.style.width, height: ref.style.height, ...position })}
                                    bounds="parent"
                                >
                                    <div style={{ padding: '5px', cursor: 'move', background: 'rgba(255,255,255,0.6)', border: '1px dashed #666', display: 'flex', gap: '10px' }}>
                                        <button className="btn-primary" style={{ pointerEvents: 'none', padding: '8px 16px', fontSize: '12px' }}>{formData.cta_primary_text}</button>
                                        {formData.cta_secondary_text && (
                                            <button className="btn-outline" style={{ pointerEvents: 'none', padding: '8px 16px', fontSize: '12px' }}>{formData.cta_secondary_text}</button>
                                        )}
                                    </div>
                                </Rnd>
                            )}
                        </div>
                        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                            💡 Arraste os elementos para mudar a posição e use as bordas para mudar o tamanho.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
