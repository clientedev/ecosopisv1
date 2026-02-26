"use client";
import { useState } from "react";
import styles from "./dashboard.module.css";

interface Product {
    name: string;
    slug: string;
    description: string;
    price: number;
    stock: number;
    image_url: string;
    category: string;
    mercadolivre_url: string;
    shopee_url: string;
    buy_on_site: boolean;
    images?: string[];
    tags?: string[];
    details?: Partial<ProductDetail>;
}

interface ProductDetail {
    curiosidades: string;
    modo_de_uso: string;
    ingredientes: string;
    cuidados: string;
    contraindicacoes: string;
    observacoes: string;
}

interface Props {
    onClose: () => void;
    onSave: (newProduct: any) => void;
}

export default function NewProductModal({ onClose, onSave }: Props) {
    const [formData, setFormData] = useState<Product>({
        name: "",
        slug: "",
        description: "",
        price: 0,
        stock: 0,
        image_url: "",
        category: "sabonete",
        mercadolivre_url: "",
        shopee_url: "",
        buy_on_site: true,
        images: [],
        tags: [],
        details: {
            curiosidades: "",
            modo_de_uso: "",
            ingredientes: "",
            cuidados: "",
            contraindicacoes: "",
            observacoes: ""
        }
    });
    const [loading, setLoading] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const [showTechnicalInfo, setShowTechnicalInfo] = useState(false);

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

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/--+/g, "-")
            .trim();
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        setFormData({
            ...formData,
            name,
            slug: generateSlug(name)
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

            const res = await fetch(`/api/products`, {
                method: "POST",
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
                onSave(data);
                onClose();
            } else {
                alert("Erro ao criar produto");
            }
        } catch (error) {
            console.error("Error creating product:", error);
            alert("Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const token = localStorage.getItem("token");

            if (!token) {
                alert("Sessão expirada. Por favor, faça login novamente.");
                window.location.href = "/admin";
                return;
            }

            const uploadedUrls = [];
            for (const file of files) {
                const uploadFormData = new FormData();
                uploadFormData.append("file", file);
                try {
                    const res = await fetch(`/api/images/upload`, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${token}` },
                        body: uploadFormData
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
                const currentImages = Array.isArray(formData.images) ? formData.images : [];
                const combinedImages = [...currentImages, ...uploadedUrls].filter((url, index, self) =>
                    url && self.indexOf(url) === index
                );
                const newImages = combinedImages.slice(0, 5);

                setFormData({
                    ...formData,
                    images: newImages,
                    image_url: formData.image_url || newImages[0]
                });
            }
        }
    };

    const getImageUrl = (url: string) => {
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

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
                <h2>Novo Produto</h2>
                <form onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <label>Nome</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={handleNameChange}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label>URL amigável (Slug)</label>
                        <input
                            type="text"
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
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
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Descreva o produto de forma clara e atraente..."
                            required
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

                    <div className={styles.formGroup}>
                        <label>Imagens (Máx 5)</label>
                        <input type="file" accept="image/*" multiple onChange={handleUpload} />
                        <div className={styles.imagePreviewGrid}>
                            {formData.images?.map((url: string, index: number) => (
                                <div key={index} className={`${styles.imagePreviewItem} ${formData.image_url === url ? styles.mainImage : ''}`}>
                                    <img src={getImageUrl(url)} alt={`Preview ${index}`} />
                                    <div className={styles.imageActions}>
                                        <button type="button" onClick={() => setFormData({ ...formData, image_url: url })}>Padrão</button>
                                        <button type="button" onClick={() => {
                                            const newImages = formData.images?.filter((_, i) => i !== index);
                                            setFormData({
                                                ...formData,
                                                images: newImages,
                                                image_url: formData.image_url === url ? (newImages?.[0] || '') : formData.image_url
                                            });
                                        }}>Remover</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label>Link Mercado Livre</label>
                            <input
                                type="text"
                                value={formData.mercadolivre_url}
                                onChange={(e) => setFormData({ ...formData, mercadolivre_url: e.target.value })}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Link Shopee</label>
                            <input
                                type="text"
                                value={formData.shopee_url}
                                onChange={(e) => setFormData({ ...formData, shopee_url: e.target.value })}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.buy_on_site}
                                    onChange={(e) => setFormData({ ...formData, buy_on_site: e.target.checked })}
                                />
                                Vender diretamente no site
                            </label>
                        </div>
                    </div>

                    <hr style={{ margin: '30px 0', border: '0', borderTop: '1px solid #eee' }} />

                    <div className={styles.formGroup}>
                        <h3 style={{ marginBottom: '15px', color: '#1a3a16', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>📄</span> Detalhes da Página Técnica
                        </h3>

                        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '15px' }}>
                                Estas informações aparecerão na página exclusiva do produto (acessada via QR Code).
                                <b> O QR Code será gerado automaticamente após a criação.</b>
                            </p>

                            <button
                                type="button"
                                className={styles.editBtn}
                                onClick={() => setShowTechnicalInfo(!showTechnicalInfo)}
                                style={{ backgroundColor: '#2d5a27', color: 'white', marginBottom: showTechnicalInfo ? '20px' : '0' }}
                            >
                                {showTechnicalInfo ? "Ocultar Campos" : "Adicionar Informações Técnicas (Opcional)"}
                            </button>

                            {showTechnicalInfo && (
                                <div className={styles.formTechnicalArea} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div className={styles.formGroup}>
                                        <label>Curiosidades</label>
                                        <textarea
                                            rows={2}
                                            value={formData.details?.curiosidades || ""}
                                            onChange={(e) => setFormData({ ...formData, details: { ...formData.details, curiosidades: e.target.value } })}
                                            placeholder="Fatos interessantes sobre o produto..."
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Modo de Uso</label>
                                        <textarea
                                            rows={2}
                                            value={formData.details?.modo_de_uso || ""}
                                            onChange={(e) => setFormData({ ...formData, details: { ...formData.details, modo_de_uso: e.target.value } })}
                                            placeholder="Como aplicar ou consumir..."
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Ingredientes Técnicos</label>
                                        <textarea
                                            rows={2}
                                            value={formData.details?.ingredientes || ""}
                                            onChange={(e) => setFormData({ ...formData, details: { ...formData.details, ingredientes: e.target.value } })}
                                            placeholder="Composição detalhada..."
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Cuidados</label>
                                        <textarea
                                            rows={2}
                                            value={formData.details?.cuidados || ""}
                                            onChange={(e) => setFormData({ ...formData, details: { ...formData.details, cuidados: e.target.value } })}
                                            placeholder="Armazenamento e manuseio..."
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Contraindicações</label>
                                        <textarea
                                            rows={2}
                                            value={formData.details?.contraindicacoes || ""}
                                            onChange={(e) => setFormData({ ...formData, details: { ...formData.details, contraindicacoes: e.target.value } })}
                                            placeholder="Quem não deve usar..."
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Observações Adicionais</label>
                                        <textarea
                                            rows={2}
                                            value={formData.details?.observacoes || ""}
                                            onChange={(e) => setFormData({ ...formData, details: { ...formData.details, observacoes: e.target.value } })}
                                            placeholder="Outras informações pertinentes..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.formActions}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? "Criando..." : "Criar Produto"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
