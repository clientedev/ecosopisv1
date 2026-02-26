"use client";
import { useState } from "react";
import styles from "./dashboard.module.css";
import { Download } from "lucide-react";

interface Product {
    id: number;
    name: string;
    slug: string;
    description: string;
    ingredients: string;
    benefits: string;
    price: number;
    stock: number;
    image_url: string;
    category: string;
    mercadolivre_url: string;
    shopee_url: string;
    buy_on_site: boolean;
    is_active: boolean;
    images?: string[];
    tags?: string[];
    details?: ProductDetail;
}

interface ProductDetail {
    id: number;
    product_id: number;
    slug: string;
    curiosidades: string;
    modo_de_uso: string;
    ingredientes: string;
    cuidados: string;
    contraindicacoes: string;
    observacoes: string;
    qr_code_path: string;
    updated_at: string;
}

interface Props {
    product: Product;
    onClose: () => void;
    onSave: (updated: Product) => void;
}

export default function EditProductModal({ product, onClose, onSave }: Props) {
    const [formData, setFormData] = useState<Product>({
        ...product,
        is_active: product.is_active !== false,
        images: (product as any).images || [],
        tags: Array.isArray((product as any).tags) ? (product as any).tags : (typeof (product as any).tags === 'string' ? JSON.parse((product as any).tags || '[]') : [])
    });
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const [showTechnicalInfo, setShowTechnicalInfo] = useState(false);
    const [technicalData, setTechnicalData] = useState<Partial<ProductDetail>>(
        product.details || {
            curiosidades: "",
            modo_de_uso: "",
            ingredientes: "",
            cuidados: "",
            contraindicacoes: "",
            observacoes: ""
        }
    );

    const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const newTag = tagInput.trim().toUpperCase();
            if (newTag && !(formData.tags || []).includes(newTag)) {
                setFormData({ ...formData, tags: [...(formData.tags || []), newTag] });
            }
            setTagInput("");
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setFormData({
            ...formData,
            tags: (formData.tags || []).filter(t => t !== tagToRemove)
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                alert("Sessão expirada. Por favor, faça login novamente.");
                window.location.href = "/admin";
                return;
            }

            const res = await fetch(`/api/products/${product.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(formData),
            });

            if (res.status === 401) {
                alert("Sessão expirada. Por favor, faça login novamente.");
                window.location.href = "/admin";
                return;
            }

            if (res.ok) {
                const data = await res.json();

                // Also update details
                const detailsRes = await fetch(`/api/products/${product.id}/details`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(technicalData),
                });

                if (detailsRes.ok) {
                    const updatedDetails = await detailsRes.json();
                    onSave({ ...data, details: updatedDetails });
                    onClose();
                } else {
                    // Even if details fail, the main product was saved
                    onSave(data);
                    onClose();
                }
            } else {
                const err = await res.json().catch(() => ({}));
                alert(`Erro ao salvar produto: ${err.detail || res.statusText}`);
            }
        } catch (error) {
            console.error("Error updating product:", error);
            alert("Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const files = Array.from(e.target.files);
        const token = localStorage.getItem("token");

        if (!token) {
            alert("Sessão expirada. Por favor, faça login novamente.");
            window.location.href = "/admin";
            return;
        }

        setUploadingImage(true);
        const uploadedUrls: string[] = [];

        for (const file of files) {
            const fd = new FormData();
            fd.append("file", file);
            try {
                const res = await fetch(`/api/images/upload`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}` },
                    body: fd
                });

                if (res.status === 401) {
                    alert("Sessão expirada. Por favor, faça login novamente.");
                    window.location.href = "/admin";
                    return;
                }

                if (res.ok) {
                    const data = await res.json();
                    uploadedUrls.push(data.url);
                } else {
                    console.error("Upload failed for file:", file.name, await res.text());
                }
            } catch (err) {
                console.error("Upload error", err);
            }
        }

        if (uploadedUrls.length > 0) {
            const currentImages = Array.isArray(formData.images) ? formData.images : [];
            const combinedImages = [...currentImages, ...uploadedUrls].filter((url, index, self) =>
                url && self.indexOf(url) === index
            );
            const newImages = combinedImages.slice(0, 5);

            setFormData(prev => ({
                ...prev,
                images: newImages,
                image_url: prev.image_url || newImages[0]
            }));
        }
        setUploadingImage(false);
        // Reset file input
        e.target.value = "";
    };

    const getImageUrl = (url: string) => {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/attached_assets")) return `/static${url}`;
        return url;
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2>Editar Produto</h2>
                <form onSubmit={handleSubmit}>
                    {/* Nome */}
                    <div className={styles.formGroup}>
                        <label>Nome do Produto *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    {/* Descrição - área ampliada */}
                    <div className={styles.formGroup}>
                        <label>Descrição</label>
                        <textarea
                            rows={5}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                fontFamily: 'inherit',
                                resize: 'vertical',
                                lineHeight: '1.5'
                            }}
                            value={formData.description || ""}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Descreva o produto de forma clara e atraente..."
                        />
                        <small style={{ color: '#888', fontSize: '0.75rem' }}>
                            {(formData.description || "").length} caracteres
                        </small>
                    </div>

                    {/* Ingredientes */}
                    <div className={styles.formGroup}>
                        <label>Ingredientes</label>
                        <textarea
                            rows={3}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                fontFamily: 'inherit',
                                resize: 'vertical',
                                lineHeight: '1.5'
                            }}
                            value={formData.ingredients || ""}
                            onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                            placeholder="Lista de ingredientes separados por vírgula..."
                        />
                    </div>

                    {/* Benefícios */}
                    <div className={styles.formGroup}>
                        <label>Benefícios</label>
                        <textarea
                            rows={3}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                fontFamily: 'inherit',
                                resize: 'vertical',
                                lineHeight: '1.5'
                            }}
                            value={formData.benefits || ""}
                            onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                            placeholder="Principais benefícios do produto..."
                        />
                    </div>

                    {/* Tags */}
                    <div className={styles.formGroup}>
                        <label>Tags Populares (Tecle <b>Enter</b> para adicionar)</label>
                        <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleAddTag}
                            placeholder="SABONETE, SKIN:OILY, ACNE..."
                        />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                            {(formData.tags || []).map((tag, index) => (
                                <span key={index} style={{
                                    backgroundColor: '#e5e7eb',
                                    color: '#374151',
                                    padding: '4px 8px',
                                    borderRadius: '16px',
                                    fontSize: '0.8rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTag(tag)}
                                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px' }}
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Preço e Estoque */}
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label>Preço (R$) *</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Estoque *</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.stock}
                                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                                required
                            />
                        </div>
                    </div>

                    {/* Upload de Imagens */}
                    <div className={styles.formGroup}>
                        <label>Imagens do Produto (Máx 5)</label>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleUpload}
                            disabled={uploadingImage}
                        />
                        {uploadingImage && (
                            <p style={{ color: '#4a7c59', fontSize: '0.85rem', marginTop: '4px' }}>
                                ⏳ Enviando imagem(ns)...
                            </p>
                        )}
                        {(formData as any).images && (formData as any).images.length > 0 && (
                            <div className={styles.imagePreviewGrid}>
                                {(formData as any).images.map((url: string, index: number) => (
                                    <div key={index} className={`${styles.imagePreviewItem} ${formData.image_url === url ? styles.mainImage : ''}`}>
                                        <img
                                            src={getImageUrl(url)}
                                            alt={`Imagem ${index + 1}`}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/logo_final.png';
                                            }}
                                        />
                                        {formData.image_url === url && (
                                            <span style={{
                                                position: 'absolute', top: '4px', left: '4px',
                                                background: '#4a7c59', color: 'white',
                                                fontSize: '0.6rem', padding: '2px 5px', borderRadius: '4px'
                                            }}>PRINCIPAL</span>
                                        )}
                                        <div className={styles.imageActions}>
                                            <button type="button" onClick={() => setFormData({ ...formData, image_url: url })}>
                                                Definir Principal
                                            </button>
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
                        )}
                        {(!formData.images || (formData as any).images.length === 0) && (
                            <p style={{ color: '#aaa', fontSize: '0.82rem', marginTop: '6px' }}>
                                📷 Nenhuma imagem cadastrada. Faça upload acima.
                            </p>
                        )}
                    </div>

                    {/* Links externos */}
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label>Link Mercado Livre</label>
                            <input
                                type="text"
                                value={formData.mercadolivre_url || ""}
                                onChange={(e) => setFormData({ ...formData, mercadolivre_url: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Link Shopee</label>
                            <input
                                type="text"
                                value={formData.shopee_url || ""}
                                onChange={(e) => setFormData({ ...formData, shopee_url: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    {/* Toggles */}
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        <div className={styles.formGroup}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.buy_on_site}
                                    onChange={(e) => setFormData({ ...formData, buy_on_site: e.target.checked })}
                                />
                                Vender diretamente no site
                            </label>
                        </div>
                        <div className={styles.formGroup}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.is_active !== false}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <span style={{ color: formData.is_active !== false ? '#4a7c59' : '#ef4444', fontWeight: 600 }}>
                                    {formData.is_active !== false ? '✓ Produto ativo (visível no site)' : '✗ Produto inativo (oculto no site)'}
                                </span>
                            </label>
                        </div>
                    </div>

                    <hr style={{ margin: '30px 0', border: '0', borderTop: '1px solid #eee' }} />

                    <div className={styles.formGroup}>
                        <h3 style={{ marginBottom: '15px', color: '#1a3a16', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>📄</span> Página de Detalhes do Produto
                        </h3>

                        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        type="button"
                                        className={styles.editBtn}
                                        onClick={() => setShowTechnicalInfo(!showTechnicalInfo)}
                                        style={{ backgroundColor: '#2d5a27', color: 'white' }}
                                    >
                                        {showTechnicalInfo ? "Ocultar Edição" : "Gerenciar Informações Técnicas"}
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                                    <div style={{ background: '#eee', padding: '10px', borderRadius: '8px', fontSize: '0.8rem', color: '#555', display: 'flex', alignItems: 'center' }}>
                                        <strong>URL Fixa:</strong>&nbsp;{typeof window !== 'undefined' ? `${window.location.origin}/produto/${product.slug}/info` : `/produto/${product.slug}/info`}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                const response = await fetch(`/api/static/qrcodes/${product.slug}.png`);
                                                const blob = await response.blob();
                                                const url = window.URL.createObjectURL(blob);
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.download = `qrcode-${product.slug}.png`;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                            } catch (err) {
                                                console.error("Erro ao baixar", err);
                                                alert("Houve um erro ao baixar o QR Code.");
                                            }
                                        }}
                                        className={styles.editBtn}
                                        style={{ backgroundColor: '#b8860b', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, height: 'auto' }}
                                        title="Baixar QR Code da Ficha Técnica"
                                    >
                                        <Download size={16} /> QR Code
                                    </button>
                                </div>

                                {product.details?.qr_code_path && (
                                    <div style={{ textAlign: 'center' }}>
                                        <img
                                            src={getImageUrl(product.details.qr_code_path)}
                                            alt="QR Code"
                                            style={{ width: '60px', height: '60px', border: '1px solid #ddd', borderRadius: '4px' }}
                                        />
                                        <div style={{ fontSize: '0.6rem', color: '#666', marginTop: '2px' }}>QR ATIVO</div>
                                    </div>
                                )}
                            </div>

                            {showTechnicalInfo && (
                                <div className={styles.formTechnicalArea} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div className={styles.formGroup}>
                                        <label>Curiosidades</label>
                                        <textarea
                                            rows={2}
                                            value={technicalData.curiosidades || ""}
                                            onChange={(e) => setTechnicalData({ ...technicalData, curiosidades: e.target.value })}
                                            placeholder="Fatos interessantes sobre o produto..."
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Modo de Uso</label>
                                        <textarea
                                            rows={2}
                                            value={technicalData.modo_de_uso || ""}
                                            onChange={(e) => setTechnicalData({ ...technicalData, modo_de_uso: e.target.value })}
                                            placeholder="Como aplicar ou consumir..."
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Ingredientes Técnicos</label>
                                        <textarea
                                            rows={2}
                                            value={technicalData.ingredientes || ""}
                                            onChange={(e) => setTechnicalData({ ...technicalData, ingredientes: e.target.value })}
                                            placeholder="Composição detalhada..."
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Cuidados</label>
                                        <textarea
                                            rows={2}
                                            value={technicalData.cuidados || ""}
                                            onChange={(e) => setTechnicalData({ ...technicalData, cuidados: e.target.value })}
                                            placeholder="Armazenamento e manuseio..."
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Contraindicações</label>
                                        <textarea
                                            rows={2}
                                            value={technicalData.contraindicacoes || ""}
                                            onChange={(e) => setTechnicalData({ ...technicalData, contraindicacoes: e.target.value })}
                                            placeholder="Quem não deve usar..."
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Observações Adicionais</label>
                                        <textarea
                                            rows={2}
                                            value={technicalData.observacoes || ""}
                                            onChange={(e) => setTechnicalData({ ...technicalData, observacoes: e.target.value })}
                                            placeholder="Outras informações pertinentes..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.formActions}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading || uploadingImage}>
                            {loading ? "Salvando..." : "Salvar Alterações"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
