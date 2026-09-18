"use client";
import React, { useState } from "react";
import { X, Upload, Video, Sparkles, Play } from "lucide-react";
import { isGoogleDriveUrl, getGoogleDriveDirectStreamUrl, getGoogleDriveEmbedUrl } from "@/utils/driveUtils";
import { normalizeVideoUrl, isInstagramContent } from "@/utils/instagramUtils";

interface HomeStoryItem {
    id?: number;
    title: string;
    video_url: string;
    thumbnail_url?: string;
    order?: number;
    is_active?: boolean;
}

interface EditStoryModalProps {
    story: HomeStoryItem | null;
    onClose: () => void;
    onSave: () => void;
}

export default function EditStoryModal({ story, onClose, onSave }: EditStoryModalProps) {
    const isEditing = Boolean(story && story.id);
    const [title, setTitle] = useState(story?.title || "");
    // Normaliza na inicialização caso já esteja salvo como embed code
    const [videoUrl, setVideoUrl] = useState(normalizeVideoUrl(story?.video_url || ""));
    const [thumbnailUrl, setThumbnailUrl] = useState(story?.thumbnail_url || "");
    const [isActive, setIsActive] = useState(story?.is_active ?? true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState("");

    const handleUploadVideo = async (file: File) => {
        setIsUploading(true);
        setError("");
        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/images/upload", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) {
                throw new Error("Erro ao fazer upload do vídeo.");
            }

            const data = await res.json();
            if (data.url) {
                setVideoUrl(data.url);
            }
        } catch (err: any) {
            setError(err.message || "Erro no upload do vídeo.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleUploadThumbnail = async (file: File) => {
        setError("");
        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/images/upload", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) {
                throw new Error("Erro ao fazer upload da imagem.");
            }

            const data = await res.json();
            if (data.url) {
                setThumbnailUrl(data.url);
            }
        } catch (err: any) {
            setError(err.message || "Erro no upload da thumbnail.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError("O título / rótulo da bolinha é obrigatório.");
            return;
        }
        if (!videoUrl.trim()) {
            setError("A URL do vídeo ou upload é obrigatória.");
            return;
        }

        setIsSaving(true);
        setError("");

        try {
            const token = localStorage.getItem("token");
            const payload = {
                title: title.trim(),
                video_url: videoUrl.trim(),
                thumbnail_url: thumbnailUrl.trim() || null,
                is_active: isActive
            };

            const url = isEditing
                ? `/api/carousel/stories/${story!.id}`
                : "/api/carousel/stories";
            const method = isEditing ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || "Erro ao salvar story.");
            }

            onSave();
        } catch (err: any) {
            setError(err.message || "Erro de conexão.");
        } finally {
            setIsSaving(false);
        }
    };

    // Helper para preview da mídia
    const isDrive = videoUrl ? isGoogleDriveUrl(videoUrl) : false;
    const isInstagram = videoUrl ? isInstagramContent(videoUrl) : false;
    const directDrive = isDrive ? getGoogleDriveDirectStreamUrl(videoUrl) : null;
    const driveEmbed = isDrive ? getGoogleDriveEmbedUrl(videoUrl, true) : null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '560px',
                maxHeight: '92vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: '#f0fdf4',
                            color: '#16a34a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Video size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>
                                {isEditing ? "Editar Story da Home" : "Novo Story da Home"}
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                Bolinha com vídeo estilo Stories exibida abaixo do banner principal
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: '6px'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {error && (
                        <div style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '12px',
                            color: '#dc2626',
                            fontSize: '0.85rem'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Preview da Bolinha */}
                    <div style={{
                        background: '#f8fafc',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: '10px'
                    }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Pré-visualização do Círculo na Home
                        </span>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                                width: '92px',
                                height: '92px',
                                borderRadius: '50%',
                                padding: '3.5px',
                                background: 'linear-gradient(135deg, #d4a373 0%, #2d5a27 50%, #cca43b 100%)',
                                boxShadow: '0 6px 16px rgba(45, 90, 39, 0.22)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    background: '#111111',
                                    border: '2.5px solid #ffffff',
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {isInstagram ? (
                                        // Preview com gradiente Instagram
                                        <div style={{
                                            width: '100%', height: '100%',
                                            background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <svg width="36" height="36" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                                            </svg>
                                        </div>
                                    ) : directDrive || (videoUrl && !isDrive) ? (
                                        <video
                                            src={directDrive || videoUrl}
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : driveEmbed ? (
                                        <iframe
                                            src={driveEmbed}
                                            style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
                                        />
                                    ) : thumbnailUrl ? (
                                        <img
                                            src={thumbnailUrl}
                                            alt="Preview"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <Play size={24} color="white" />
                                    )}
                                </div>
                            </div>
                            <span style={{
                                marginTop: '8px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                color: '#2b3a2a',
                                textAlign: 'center',
                                maxWidth: '96px'
                            }}>
                                {title || "Título"}
                            </span>
                        </div>
                    </div>

                    {/* Título / Rótulo */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                            Rótulo / Nome da Bolinha *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Como Usar, Argila Branca, Resultados, Bastidores"
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.9rem'
                            }}
                            required
                        />
                        <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                            Texto curto exibido logo abaixo do círculo (recomendado 1 a 2 palavras).
                        </small>
                    </div>

                    {/* Vídeo (URL ou Upload) */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                            Vídeo do Story (Instagram Reel, Google Drive, Link MP4 ou Upload) *
                        </label>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <textarea
                                value={videoUrl}
                                onChange={(e) => {
                                    const normalized = normalizeVideoUrl(e.target.value);
                                    setVideoUrl(normalized);
                                }}
                                placeholder={"Cole aqui o link do Instagram Reel, c\u00f3digo embed (<blockquote...>), link do Google Drive ou URL de v\u00eddeo MP4..."}
                                rows={2}
                                style={{
                                    flex: 1,
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: isInstagram ? '2px solid #e1306c' : '1px solid #cbd5e1',
                                    fontSize: '0.82rem',
                                    resize: 'vertical',
                                    fontFamily: 'monospace'
                                }}
                            />
                            <label style={{
                                background: '#2d5a27',
                                color: 'white',
                                padding: '10px 16px',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap'
                            }}>
                                <Upload size={16} />
                                {isUploading ? "Enviando..." : "Upload MP4"}
                                <input
                                    type="file"
                                    accept="video/*"
                                    style={{ display: 'none' }}
                                    disabled={isUploading}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            handleUploadVideo(e.target.files[0]);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                        <small style={{ color: '#64748b', fontSize: '0.75rem', lineHeight: '1.4', display: 'block' }}>
                            {isInstagram
                                ? <span style={{ color: '#e1306c', fontWeight: 600 }}>✅ Instagram Reel detectado! A URL embed foi extraída automaticamente.</span>
                                : <>💡 Suporta <strong>Instagram Reel</strong> (cole o link ou o código embed completo), link do <strong>Google Drive</strong> (arquivo público) ou upload direto MP4/WebM.</>}
                        </small>
                    </div>

                    {/* Thumbnail opcional */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                            Capa / Miniatura da Bolinha (Opcional)
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={thumbnailUrl}
                                onChange={(e) => setThumbnailUrl(e.target.value)}
                                placeholder="URL da imagem (se deixar em branco usa o próprio vídeo)..."
                                style={{
                                    flex: 1,
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.85rem'
                                }}
                            />
                            <label style={{
                                background: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap'
                            }}>
                                <Upload size={16} />
                                Upload Imagem
                                <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            handleUploadThumbnail(e.target.files[0]);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Ativo / Inativo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                style={{ width: '18px', height: '18px', accentColor: '#2d5a27' }}
                            />
                            Story ativo (visível no site)
                        </label>
                    </div>

                    {/* Botões de Ação */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        paddingTop: '16px',
                        borderTop: '1px solid #f1f5f9'
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '10px 18px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: 'white',
                                color: '#64748b',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || isUploading}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '8px',
                                border: 'none',
                                background: isSaving || isUploading ? '#94a3b8' : '#2d5a27',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: isSaving || isUploading ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isSaving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Story"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
