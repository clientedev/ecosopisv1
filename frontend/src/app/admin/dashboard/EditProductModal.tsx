"use client";
import { useState } from "react";
import styles from "./dashboard.module.css";
import { Download, RefreshCw, Star, Zap } from "lucide-react";
import { getStaticProductData } from "@/lib/productData";

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
    is_wholesale: boolean;
    is_active: boolean;
    is_on_sale?: boolean;
    sale_price?: number | null;
    order?: number;
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
    beneficios: string;
    composicao?: string;
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
    const staticData = getStaticProductData(product.slug);
    const [formData, setFormData] = useState<Product>({
        ...product,
        order: product.order ?? 0,
        ingredients: product.ingredients || staticData?.ativos || "",
        benefits: product.benefits || staticData?.beneficios || "",
        is_wholesale: product.is_wholesale === true,
        is_active: product.is_active !== false,
        is_on_sale: (product as any).is_on_sale ?? false,
        sale_price: (product as any).sale_price ?? null,
        images: (product as any).images || [],
        tags: Array.isArray((product as any).tags) ? (product as any).tags : (typeof (product as any).tags === 'string' ? JSON.parse((product as any).tags || '[]') : []),
        story_videos: Array.isArray((product as any).story_videos) ? (product as any).story_videos : []
    } as any);
    const [loading, setLoading] = useState(false);
    const [regeneratingQR, setRegeneratingQR] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingStoryIndex, setUploadingStoryIndex] = useState<number | null>(null);
    const [tagInput, setTagInput] = useState("");
    const [showTechnicalInfo, setShowTechnicalInfo] = useState(true);
    // Shopee Clone state
    const [shopeeCustomText, setShopeeCustomText] = useState("");
    const [shopeeAutoPublish, setShopeeAutoPublish] = useState(true);
    const [shopeeCloning, setShopeeCloning] = useState(false);
    const [shopeeResult, setShopeeResult] = useState<{ count: number; message: string } | null>(null);
    const [shopeeError, setShopeeError] = useState("");
    const [technicalData, setTechnicalData] = useState<Partial<ProductDetail>>({
        curiosidades: product.details?.curiosidades || staticData?.curiosidades || "",
        modo_de_uso: product.details?.modo_de_uso || staticData?.modo_de_uso || "",
        ingredientes: product.details?.ingredientes || staticData?.ativos || "",
        beneficios: (product.details as any)?.beneficios || staticData?.beneficios || "",
        composicao: product.details?.composicao || staticData?.composicao || "",
        cuidados: product.details?.cuidados || "",
        contraindicacoes: product.details?.contraindicacoes || "",
        observacoes: product.details?.observacoes || "",
        ...(product.details ? {
            id: product.details.id,
            product_id: product.details.product_id,
            slug: product.details.slug,
            qr_code_path: product.details.qr_code_path,
            updated_at: product.details.updated_at
        } : {})
    });
    const [priceInput, setPriceInput] = useState<string>(() => {
        if (product.price === undefined || product.price === null || product.price === 0) return "";
        return product.price.toString().replace(".", ",");
    });
    const [salePriceInput, setSalePriceInput] = useState<string>(() => {
        const sp = (product as any).sale_price;
        if (sp === undefined || sp === null) return "";
        return sp.toString().replace(".", ",");
    });

    const parsePriceInput = (value: string): number => {
        if (!value || value.trim() === "") return 0;
        const normalized = value.replace(",", ".").trim();
        const parsed = parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const parseSalePriceInput = (value: string): number | null => {
        if (!value || value.trim() === "") return null;
        const normalized = value.replace(",", ".").trim();
        const parsed = parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const toNumberOrZero = (value: string) => {
        if (!value || value.trim() === "") return 0;
        const normalized = value.replace(",", ".").trim();
        const parsed = parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    };

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

            // Strip id and details from payload to prevent backend validation (Err 400)
            const { id, details, ...payload } = formData;

            const res = await fetch(`/api/products/${product.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload),
            });

            if (res.status === 401) {
                alert("Sessão expirada. Por favor, faça login novamente.");
                window.location.href = "/admin";
                return;
            }

            if (res.ok) {
                const data = await res.json();

                // Clean technicalData for submission (strip id, product_id, qr_code_path, etc)
                const { id: _id, product_id: _pid, slug: _s, qr_code_path: _qr, updated_at: _ua, ...technicalPayload } = technicalData as any;

                const detailsRes = await fetch(`/api/products/${product.id}/details`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(technicalPayload),
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

    const handleRegenerateQR = async () => {
        if (!confirm("Isso irá regenerar o QR Code apontando para a ficha técnica oficial do produto. Deseja continuar?")) return;

        setRegeneratingQR(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/products/${product.slug}/regenerate-qr`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ origin: window.location.origin })
            });

            if (!res.ok) throw new Error("Falha ao regenerar QR");
            const data = await res.json();

            alert("QR Code regenerado com sucesso!");
            // Update local state to show new QR (if we were displaying it)
            if (formData.details) {
                setFormData({
                    ...formData,
                    details: {
                        ...formData.details,
                        qr_code_path: data.path
                    }
                });
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao regenerar QR Code");
        } finally {
            setRegeneratingQR(false);
        }
    };

    const handleExportZpl = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                alert("Sessão expirada. Por favor, faça login novamente.");
                window.location.href = "/admin";
                return;
            }

            const res = await fetch(`/api/products/${product.id}/label.zpl`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error("Falha ao exportar etiqueta ZPL");
            }

            const zplText = await res.text();
            const blob = new Blob([zplText], { type: "application/zpl" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `label-${product.slug}.zpl`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert("Erro ao exportar etiqueta ZPL");
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

    const handleUploadStoryVideo = async (index: number, file: File) => {
        const token = localStorage.getItem("token");
        if (!token) return;
        setUploadingStoryIndex(index);
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch(`/api/images/upload`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: fd
            });
            if (res.ok) {
                const data = await res.json();
                const stories = [...(((formData as any).story_videos) || [])];
                stories[index] = { ...(stories[index] || {}), video_url: data.url };
                setFormData(prev => ({ ...prev, story_videos: stories } as any));
            } else {
                alert("Erro ao enviar arquivo de vídeo");
            }
        } catch (err) {
            console.error("Error uploading story video", err);
            alert("Erro de conexão ao enviar vídeo");
        } finally {
            setUploadingStoryIndex(null);
        }
    };

    const handleUploadStoryThumb = async (index: number, file: File) => {
        const token = localStorage.getItem("token");
        if (!token) return;
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch(`/api/images/upload`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: fd
            });
            if (res.ok) {
                const data = await res.json();
                const stories = [...(((formData as any).story_videos) || [])];
                stories[index] = { ...(stories[index] || {}), thumbnail_url: data.url };
                setFormData(prev => ({ ...prev, story_videos: stories } as any));
            }
        } catch (err) {
            console.error("Error uploading story thumbnail", err);
        }
    };

    const handleAddStory = () => {
        const current = ((formData as any).story_videos) || [];
        if (current.length >= 4) return;
        const titles = ["Textura", "Como Usar", "Resultados", "Detalhes"];
        const newStory = {
            id: `story_${Date.now()}`,
            title: titles[current.length] || `Vídeo ${current.length + 1}`,
            video_url: "",
            thumbnail_url: ""
        };
        setFormData(prev => ({ ...prev, story_videos: [...current, newStory] } as any));
    };

    const handleRemoveStory = (index: number) => {
        const current = ((formData as any).story_videos) || [];
        const updated = current.filter((_: any, i: number) => i !== index);
        setFormData(prev => ({ ...prev, story_videos: updated } as any));
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
        if (url.startsWith("/uploads/")) return `/static${url}`;
        if (url.startsWith("uploads/")) return `/static/${url}`;
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

                    {/* Categoria */}
                    <div className={styles.formGroup}>
                        <label>Categoria</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '0.9rem'
                            }}
                            required
                        >
                            <option value="sabonete">Sabonete</option>
                            <option value="kit">Kit</option>
                            <option value="creme">Creme</option>
                            <option value="oleo">Óleo</option>
                            <option value="argila">Argila</option>
                            <option value="outros">Outros</option>
                        </select>
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
                                type="text"
                                inputMode="decimal"
                                value={priceInput}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setPriceInput(val);
                                    setFormData({ ...formData, price: parsePriceInput(val) });
                                }}
                                placeholder="Ex: 29,90 ou 29.90"
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Estoque *</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.stock}
                                onChange={(e) => setFormData({ ...formData, stock: Math.max(0, Math.trunc(toNumberOrZero(e.target.value))) })}
                                required
                            />
                        </div>
                    </div>

                    {/* Ordem de Exibição */}
                    <div className={styles.formGroup}>
                        <label>Ordem de Exibição (menor número aparece primeiro)</label>
                        <input
                            type="number"
                            value={formData.order ?? 0}
                            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                        />
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
                                    checked={formData.is_wholesale}
                                    onChange={(e) => setFormData({ ...formData, is_wholesale: e.target.checked })}
                                />
                                Disponível para Atacado
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

                    {/* Promoção */}
                    <div style={{
                        background: (formData as any).is_on_sale ? 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)' : '#f8fafc',
                        border: (formData as any).is_on_sale ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        marginBottom: '20px',
                        transition: 'all 0.3s ease'
                    }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: (formData as any).is_on_sale ? '16px' : 0 }}>
                            <input
                                type="checkbox"
                                checked={(formData as any).is_on_sale ?? false}
                                onChange={(e) => setFormData({ ...formData, is_on_sale: e.target.checked } as any)}
                                style={{ width: '18px', height: '18px', accentColor: '#f59e0b' }}
                            />
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: (formData as any).is_on_sale ? '#92400e' : '#374151' }}>
                                🏷️ Habilitar Promoção
                            </span>
                            {(formData as any).is_on_sale && (
                                <span style={{
                                    background: '#f59e0b',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: '20px',
                                    letterSpacing: '0.05em',
                                    animation: 'pulse 2s infinite'
                                }}>EM PROMOÇÃO</span>
                            )}
                        </label>
                        {(formData as any).is_on_sale && (
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400e', display: 'block', marginBottom: '6px' }}>
                                    Preço Promocional (R$)
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={salePriceInput}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSalePriceInput(val);
                                            setFormData({ ...formData, sale_price: parseSalePriceInput(val) });
                                        }}
                                        placeholder="Ex: 25,90 ou 25.90"
                                        style={{
                                            padding: '10px 14px',
                                            border: '2px solid #f59e0b',
                                            borderRadius: '8px',
                                            fontSize: '1.1rem',
                                            fontWeight: 700,
                                            color: '#92400e',
                                            width: '160px',
                                            background: 'white'
                                        }}
                                    />
                                    {(formData as any).sale_price && formData.price && (
                                        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                            Desconto: <strong style={{ color: '#16a34a' }}>
                                                {Math.round((1 - (formData as any).sale_price / formData.price) * 100)}% OFF
                                            </strong>
                                            {' '}(de{' '}
                                            <s style={{ color: '#9ca3af' }}>R$ {formData.price.toFixed(2).replace('.', ',')}</s>
                                            {' '}por{' '}
                                            <strong style={{ color: '#f59e0b' }}>R$ {((formData as any).sale_price).toFixed(2).replace('.', ',')}</strong>)
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '8px', opacity: 0.8 }}>
                                    💡 O preço original ficará riscado e o preço promocional aparecerá em destaque no card do produto e na home.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Vídeos de Demonstração (Stories - Estilo Rituária) */}
                    <div style={{
                        background: '#fcf8f6',
                        border: '1px solid #f3d5ca',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '20px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                                <h4 style={{ margin: 0, color: '#c86d51', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>🎬</span> Vídeos de Demonstração (Stories - até 4)
                                </h4>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#666' }}>
                                    Estes vídeos aparecem em círculos estilo Stories logo abaixo do botão comprar no site.
                                </p>
                            </div>
                            {(!((formData as any).story_videos) || ((formData as any).story_videos).length < 4) && (
                                <button
                                    type="button"
                                    onClick={handleAddStory}
                                    style={{
                                        background: '#c86d51',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '6px 14px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    + Adicionar Vídeo ({((formData as any).story_videos || []).length}/4)
                                </button>
                            )}
                        </div>

                        {((formData as any).story_videos || []).length === 0 ? (
                            <p style={{ fontSize: '0.82rem', color: '#999', fontStyle: 'italic', margin: 0 }}>
                                Nenhum vídeo de story adicionado. Clique no botão acima para incluir vídeos curtos do produto.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {((formData as any).story_videos || []).map((story: any, index: number) => (
                                    <div key={story.id || index} style={{
                                        background: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '10px',
                                        padding: '14px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#333' }}>
                                                Vídeo {index + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveStory(index)}
                                                style={{
                                                    background: '#fee2e2',
                                                    color: '#ef4444',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '4px 10px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Remover
                                            </button>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                                            <div>
                                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '4px' }}>
                                                    Rótulo do Círculo *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={story.title || ""}
                                                    onChange={(e) => {
                                                        const stories = [...(((formData as any).story_videos) || [])];
                                                        stories[index] = { ...stories[index], title: e.target.value };
                                                        setFormData(prev => ({ ...prev, story_videos: stories } as any));
                                                    }}
                                                    placeholder="Ex: Textura, Como Usar"
                                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.85rem' }}
                                                />
                                            </div>

                                            <div>
                                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '4px' }}>
                                                    URL do Vídeo (Google Drive, MP4) ou Upload *
                                                </label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input
                                                        type="text"
                                                        value={story.video_url || ""}
                                                        onChange={(e) => {
                                                            const stories = [...(((formData as any).story_videos) || [])];
                                                            stories[index] = { ...stories[index], video_url: e.target.value };
                                                            setFormData(prev => ({ ...prev, story_videos: stories } as any));
                                                        }}
                                                        placeholder="drive.google.com/file/d/... ou https://..."
                                                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.85rem' }}
                                                    />
                                                    <label style={{
                                                        background: '#4a7c59',
                                                        color: 'white',
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {uploadingStoryIndex === index ? '⏳ Enviando...' : '📁 Upload Vídeo'}
                                                        <input
                                                            type="file"
                                                            accept="video/*"
                                                            style={{ display: 'none' }}
                                                            onChange={(e) => {
                                                                if (e.target.files && e.target.files[0]) {
                                                                    handleUploadStoryVideo(index, e.target.files[0]);
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <hr style={{ margin: '30px 0', border: '0', borderTop: '1px solid #eee' }} />

                    <div className={styles.formGroup}>
                        <h3 style={{ marginBottom: '15px', color: '#1a3a16', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>📄</span> Página de Detalhes do Produto
                        </h3>

                        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                            <div className={styles.detailsHeader}>
                                <div className={styles.detailsMainActions}>
                                    <button
                                        type="button"
                                        className={styles.editBtn}
                                        onClick={() => setShowTechnicalInfo(!showTechnicalInfo)}
                                        style={{ backgroundColor: '#2d5a27', color: 'white' }}
                                    >
                                        {showTechnicalInfo ? "Ocultar Edição" : "Gerenciar Informações Técnicas"}
                                    </button>
                                </div>

                                <div className={styles.detailsTools}>
                                    <div className={styles.fixedUrlBox}>
                                        <strong>URL Fixa:</strong>{" "}
                                        {typeof window !== 'undefined' ? `${window.location.origin}/produto/${product.slug}/info` : `/produto/${product.slug}/info`}
                                    </div>
                                    <div className={styles.actionRowWrap}>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const response = await fetch(`/static/qrcodes/${product.slug}.png`);
                                                    if (!response.ok) throw new Error(`Status ${response.status}`);
                                                    const rawBlob = await response.blob();
                                                    const blob = new Blob([rawBlob], { type: 'image/png' });
                                                    const url = window.URL.createObjectURL(blob);
                                                    const link = document.createElement('a');
                                                    link.href = url;
                                                    link.download = `qrcode-${product.slug}.png`;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                    window.URL.revokeObjectURL(url);
                                                } catch (err) {
                                                    console.error("Erro ao baixar", err);
                                                    alert("Houve um erro ao baixar o QR Code. Verifique se o QR foi gerado.");
                                                }
                                            }}
                                            className={styles.editBtn}
                                            style={{ backgroundColor: '#b8860b', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, height: 'auto' }}
                                            title="Baixar QR Code da Ficha Técnica"
                                        >
                                            <Download size={16} /> QR Code
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRegenerateQR}
                                            disabled={regeneratingQR}
                                            className={styles.editBtn}
                                            style={{ backgroundColor: '#1a3a16', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, height: 'auto' }}
                                            title="Atualizar link do QR Code"
                                        >
                                            <RefreshCw size={16} className={regeneratingQR ? "spin-animation" : ""} />
                                            {regeneratingQR ? "Atualizando..." : "Regenerar QR"}
                                        </button>
                                    </div>
                                </div>

                                {formData.details?.qr_code_path && (
                                    <div className={styles.qrPreviewMini}>
                                        <img
                                            src={getImageUrl(formData.details.qr_code_path)}
                                            alt="QR Code"
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
                                        <label>Ingredientes Técnicos (Ficha)</label>
                                        <textarea
                                            rows={3}
                                            value={technicalData.ingredientes || ""}
                                            onChange={(e) => setTechnicalData({ ...technicalData, ingredientes: e.target.value })}
                                            placeholder="Composição detalhada..."
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Benefícios (Ficha Técnica)</label>
                                        <textarea
                                            rows={3}
                                            value={(technicalData as any).beneficios || ""}
                                            onChange={(e) => setTechnicalData({ ...technicalData, beneficios: e.target.value } as any)}
                                            placeholder="Benefícios que aparecem na ficha técnica..."
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Composição (Ficha Técnica)</label>
                                        <textarea
                                            rows={3}
                                            value={technicalData.composicao || ""}
                                            onChange={(e) => setTechnicalData({ ...technicalData, composicao: e.target.value })}
                                            placeholder="Fórmula / Composição química completa..."
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

                    {/* ── CLONE DE AVALIAÇÕES SHOPEE ── */}
                    <div style={{
                        background: 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)',
                        border: '2px solid #f59e0b',
                        borderRadius: '14px',
                        padding: '20px 22px',
                        marginBottom: '24px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                            <div style={{
                                width: '36px', height: '36px',
                                background: '#f59e0b',
                                borderRadius: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <Star size={18} color="white" fill="white" />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#92400e' }}>Clone de Avaliações Shopee</h4>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#a16207' }}>
                                    Cole os textos copiados da Shopee ou clique para gerar automaticamente avaliações de alta conversão.
                                </p>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e' }}>
                                Link Shopee do produto (opcional — usa o salvo se deixar em branco)
                            </label>
                            <input
                                type="text"
                                value={formData.shopee_url || ""}
                                onChange={(e) => setFormData({ ...formData, shopee_url: e.target.value })}
                                placeholder="https://shopee.com.br/produto..."
                                style={{ borderColor: '#f59e0b' }}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e' }}>
                                Avaliações reais da Shopee (cole aqui o texto dos comentários) *
                            </label>
                            <textarea
                                rows={6}
                                value={shopeeCustomText}
                                onChange={(e) => setShopeeCustomText(e.target.value)}
                                placeholder={`Cole aqui o texto real das avaliações dos clientes da Shopee. Exemplo:\n\nm***a\nAmei demais! O sabonete é maravilhoso e chegou super rápido...\n\nj***4\nProduto original e de ótima qualidade! Recomendo muito!`}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #f59e0b',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    lineHeight: '1.5',
                                    background: 'white'
                                }}
                            />
                            <small style={{ color: '#a16207', fontSize: '0.72rem' }}>
                                🛡️ Apenas comentários autênticos de clientes da Shopee serão importados. Nenhuma avaliação falsa é gerada.
                            </small>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: '#92400e' }}>
                                <input
                                    type="checkbox"
                                    checked={shopeeAutoPublish}
                                    onChange={(e) => setShopeeAutoPublish(e.target.checked)}
                                    style={{ accentColor: '#f59e0b', width: '16px', height: '16px' }}
                                />
                                Publicar automaticamente (aprovadas na hora)
                            </label>
                        </div>

                        {shopeeResult && (
                            <div style={{
                                background: '#f0fdf4',
                                border: '1px solid #86efac',
                                borderRadius: '8px',
                                padding: '10px 14px',
                                marginBottom: '12px',
                                color: '#166534',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span>✅</span>
                                {shopeeResult.message} ({shopeeResult.count} avaliações)
                            </div>
                        )}

                        {shopeeError && (
                            <div style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '8px',
                                padding: '10px 14px',
                                marginBottom: '12px',
                                color: '#991b1b',
                                fontSize: '0.85rem'
                            }}>
                                ⚠️ {shopeeError}
                            </div>
                        )}

                        <button
                            type="button"
                            disabled={shopeeCloning}
                            onClick={async () => {
                                setShopeeCloning(true);
                                setShopeeResult(null);
                                setShopeeError("");
                                try {
                                    const token = localStorage.getItem("token");
                                    const res = await fetch('/api/reviews/clone-shopee', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`
                                        },
                                        body: JSON.stringify({
                                            product_id: product.id,
                                            shopee_url: formData.shopee_url || undefined,
                                            custom_text: shopeeCustomText || undefined,
                                            auto_publish: shopeeAutoPublish
                                        })
                                    });
                                    if (res.ok) {
                                        const data = await res.json();
                                        setShopeeResult({ count: data.count, message: data.message });
                                        setShopeeCustomText("");
                                    } else {
                                        const err = await res.json().catch(() => ({}));
                                        setShopeeError(err.detail || 'Erro ao clonar avaliações.');
                                    }
                                } catch (e) {
                                    setShopeeError('Erro de conexão. Verifique se o backend está rodando.');
                                } finally {
                                    setShopeeCloning(false);
                                }
                            }}
                            style={{
                                background: shopeeCloning ? '#e5e7eb' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: shopeeCloning ? '#9ca3af' : 'white',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '12px 24px',
                                fontSize: '0.9rem',
                                fontWeight: 800,
                                cursor: shopeeCloning ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                letterSpacing: '0.3px',
                                boxShadow: shopeeCloning ? 'none' : '0 4px 14px rgba(245, 158, 11, 0.3)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <Zap size={16} />
                            {shopeeCloning ? 'Clonando avaliações...' : '⚡ Clonar Avaliações Agora'}
                        </button>
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
