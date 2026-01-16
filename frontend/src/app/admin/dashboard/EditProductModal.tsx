"use client";
import { useState } from "react";
import styles from "./dashboard.module.css";

interface Product {
    id: number;
    name: string;
    slug: string;
    description: string;
    price: number;
    stock: number;
    image_url: string;
    category: string;
}

interface Props {
    product: Product;
    onClose: () => void;
    onSave: (updated: Product) => void;
}

export default function EditProductModal({ product, onClose, onSave }: Props) {
    const [formData, setFormData] = useState<Product>({
        ...product,
        images: (product as any).images || []
    });
    const [loading, setLoading] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files).slice(0, 5);
            const uploadedUrls = [];
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
            const token = localStorage.getItem("token");

            for (const file of files) {
                const formData = new FormData();
                formData.append("file", file);
                try {
                    const res = await fetch(`${apiUrl}/products/upload`, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${token}` },
                        body: formData
                    });
                    if (res.ok) {
                        const data = await res.json();
                        uploadedUrls.push(data.url);
                    }
                } catch (err) {
                    console.error("Upload error", err);
                }
            }
            
            if (uploadedUrls.length > 0) {
                const newImages = [...(formData as any).images, ...uploadedUrls].slice(0, 5);
                setFormData({ 
                    ...formData, 
                    images: newImages,
                    image_url: formData.image_url || newImages[0]
                });
            }
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
                <h2>Editar Produto</h2>
                <form onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <label>Nome</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label>Preço</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Estoque</label>
                            <input
                                type="number"
                                value={formData.stock}
                                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Imagens (Máx 5)</label>
                        <input type="file" accept="image/*" multiple onChange={handleUpload} />
                        <div className={styles.imagePreviewGrid}>
                            {(formData as any).images?.map((url: string, index: number) => (
                                <div key={index} className={`${styles.imagePreviewItem} ${formData.image_url === url ? styles.mainImage : ''}`}>
                                    <img src={url} alt={`Preview ${index}`} />
                                    <div className={styles.imageActions}>
                                        <button type="button" onClick={() => setFormData({ ...formData, image_url: url })}>Padrão</button>
                                        <button type="button" onClick={() => {
                                            const newImages = (formData as any).images.filter((_: any, i: number) => i !== index);
                                            setFormData({ 
                                                ...formData, 
                                                images: newImages,
                                                image_url: formData.image_url === url ? (newImages[0] || '') : formData.image_url
                                            });
                                        }}>Remover</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.formActions}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? "Salvando..." : "Salvar Alterações"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
