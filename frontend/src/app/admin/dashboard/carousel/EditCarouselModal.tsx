"use client";
import { useState, useEffect } from "react";
import styles from "../dashboard.module.css";

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = item ? `/api/carousel/${item.id}` : `/api/carousel`;
            const method = item ? "PUT" : "POST";
            const data = new FormData();
            
            Object.keys(formData).forEach(key => {
                const value = formData[key as keyof typeof formData];
                if (value !== null && value !== undefined && value !== "") {
                    data.append(key, value.toString());
                }
            });
            // Reset elements_config when using alignment mode
            data.append("elements_config", JSON.stringify({}));
            
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
            <div className={styles.modalContent} style={{ maxWidth: '1100px', width: '95%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    {/* Painel de Edição */}
                    <div>
                        <h2>{item ? "Editar Slide" : "Novo Slide"}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Alinhamento do Conteúdo</label>
                                    <select 
                                        value={formData.alignment} 
                                        onChange={e => setFormData({...formData, alignment: e.target.value})}
                                        className={styles.formInput}
                                    >
                                        <option value="left">Esquerda</option>
                                        <option value="center">Centro</option>
                                        <option value="right">Direita</option>
                                    </select>
                                </div>
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
                            <div className={styles.formActions} style={{ marginTop: '20px' }}>
                                <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
                                    {loading ? "Salvando..." : "Salvar"}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Painel de Previsualização */}
                    <div>
                        <h2 style={{ marginBottom: '15px' }}>Previsualização</h2>
                        <div style={{ 
                            width: '100%', 
                            height: '500px', 
                            border: '1px solid #ddd', 
                            borderRadius: '8px',
                            position: 'relative',
                            overflow: 'hidden',
                            backgroundColor: '#f5f5f5',
                            backgroundImage: previewUrl ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${previewUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: formData.alignment === 'center' ? 'center' : formData.alignment === 'right' ? 'flex-end' : 'flex-start',
                            padding: '60px'
                        }}>
                            <div style={{ 
                                maxWidth: '500px', 
                                textAlign: formData.alignment as any,
                                color: 'white',
                                zIndex: 2
                            }}>
                                {formData.badge && <span className="scientific-badge" style={{ marginBottom: '15px', display: 'inline-block' }}>{formData.badge}</span>}
                                {formData.title && <h1 style={{ fontSize: '2.5rem', margin: '0 0 20px 0', color: 'white' }}>{formData.title}</h1>}
                                {formData.description && <p style={{ fontSize: '1.1rem', margin: '0 0 30px 0', opacity: 0.9 }}>{formData.description}</p>}
                                <div style={{ display: 'flex', gap: '15px', justifyContent: formData.alignment === 'center' ? 'center' : formData.alignment === 'right' ? 'flex-end' : 'flex-start' }}>
                                    {formData.cta_primary_text && (
                                        <button className="btn-primary" style={{ pointerEvents: 'none' }}>
                                            {formData.cta_primary_text}
                                        </button>
                                    )}
                                    {formData.cta_secondary_text && (
                                        <button className="btn-outline" style={{ pointerEvents: 'none', color: 'white', borderColor: 'white' }}>
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
