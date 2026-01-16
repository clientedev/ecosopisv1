"use client";
import { useState } from "react";
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
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = item ? `/api/carousel/${item.id}` : `/api/carousel/`;
            const method = item ? "PUT" : "POST";
            
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                if (formData[key as key_of_typeof_formData] !== null && formData[key as key_of_typeof_formData] !== undefined) {
                    data.append(key, formData[key as key_of_typeof_formData].toString());
                }
            });
            if (selectedFile) {
                data.append("file", selectedFile);
            }
            
            const res = await fetch(url, {
                method,
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: data,
            });

            if (res.ok) {
                const updatedItem = await res.json();
                onSave(updatedItem);
                onClose();
            }
        } catch (error) {
            console.error("Error saving carousel item:", error);
        } finally {
            setLoading(false);
        }
    };

    type key_of_typeof_formData = keyof typeof formData;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <h2>{item ? "Editar Slide" : "Novo Slide"}</h2>
                <form onSubmit={handleSubmit}>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label>Badge (Texto pequeno no topo)</label>
                            <input type="text" value={formData.badge} onChange={e => setFormData({...formData, badge: e.target.value})} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Título Principal</label>
                            <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Descrição</label>
                            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Anexar Imagem de Fundo</label>
                            <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                            {item?.image_url && <p className={styles.smallInfo}>Imagem atual: {item.image_url}</p>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>Ou URL da Imagem</label>
                            <input type="text" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} placeholder="https://..." />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Texto Botão Primário</label>
                            <input type="text" value={formData.cta_primary_text} onChange={e => setFormData({...formData, cta_primary_text: e.target.value})} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Link Botão Primário</label>
                            <input type="text" value={formData.cta_primary_link} onChange={e => setFormData({...formData, cta_primary_link: e.target.value})} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Texto Botão Secundário</label>
                            <input type="text" value={formData.cta_secondary_text} onChange={e => setFormData({...formData, cta_secondary_text: e.target.value})} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Link Botão Secundário</label>
                            <input type="text" value={formData.cta_secondary_link} onChange={e => setFormData({...formData, cta_secondary_link: e.target.value})} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Ordem</label>
                            <input type="number" value={formData.order} onChange={e => setFormData({...formData, order: parseInt(e.target.value)})} />
                        </div>
                    </div>
                    <div className={styles.formActions}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
                            {loading ? "Salvando..." : "Salvar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
