"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import styles from "../dashboard.module.css";
import { Plus, Trash2, Image, Video, Calendar, Eye } from "lucide-react";

interface NewsPost {
    id: number;
    title: string;
    content: string;
    media_url?: string;
    media_type?: 'image' | 'video';
    created_at: string;
    user_id: number;
}

export default function NovidadesAdmin() {
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }
        fetchPosts();
    }, [router]);

    const fetchPosts = async () => {
        try {
            const res = await fetch('/api/news/', { 
                cache: 'no-store'
            });
            if (res.ok) {
                const data = await res.json();
                setPosts(data);
            }
        } catch (error) {
            console.error("Error fetching news:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem("token");
        if (!token) return;

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('content', content);
            if (mediaUrl) formData.append('media_url', mediaUrl);
            formData.append('media_type', mediaType);
            if (file) formData.append('file', file);

            const response = await fetch('/api/news/', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                setTitle('');
                setContent('');
                setMediaUrl('');
                setFile(null);
                setPreviewUrl('');
                setShowModal(false);
                fetchPosts();
            } else {
                const errData = await response.json();
                alert(`Erro ao criar postagem: ${errData.detail || 'Erro desconhecido'}`);
            }
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Erro ao criar postagem');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (postId: number) => {
        if (!confirm('Tem certeza que deseja excluir esta postagem?')) return;
        
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            const response = await fetch(`/api/news/${postId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                fetchPosts();
            } else {
                alert('Erro ao excluir postagem');
            }
        } catch (error) {
            console.error('Error deleting post:', error);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className={styles.dashboard}>
            <AdminSidebar activePath="/admin/dashboard/novidades" />
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Gerenciar Novidades</h1>
                    <button 
                        className="btn-primary"
                        onClick={() => setShowModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#4a7c59',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        <Plus size={20} />
                        Nova Postagem
                    </button>
                </header>

                <div className={styles.stats}>
                    <div className={styles.statCard}>
                        <h3>Total de Postagens</h3>
                        <p>{posts.length}</p>
                    </div>
                    <div className={styles.statCard}>
                        <h3>Com Mídia</h3>
                        <p>{posts.filter(p => p.media_url).length}</p>
                    </div>
                </div>

                <div className={styles.productTable}>
                    <table>
                        <thead>
                            <tr>
                                <th>Mídia</th>
                                <th>Título</th>
                                <th>Conteúdo</th>
                                <th>Data</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                                        Carregando...
                                    </td>
                                </tr>
                            ) : posts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                                        Nenhuma postagem ainda. Clique em "Nova Postagem" para criar.
                                    </td>
                                </tr>
                            ) : (
                                posts.map((post) => (
                                    <tr key={post.id}>
                                        <td>
                                            {post.media_url ? (
                                                post.media_type === 'video' ? (
                                                    <div style={{
                                                        width: '60px',
                                                        height: '60px',
                                                        backgroundColor: '#f1f5f9',
                                                        borderRadius: '0.5rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <Video size={24} color="#64748b" />
                                                    </div>
                                                ) : (
                                                    <img 
                                                        src={post.media_url} 
                                                        alt={post.title}
                                                        style={{
                                                            width: '60px',
                                                            height: '60px',
                                                            objectFit: 'cover',
                                                            borderRadius: '0.5rem',
                                                            border: '1px solid #e2e8f0'
                                                        }}
                                                    />
                                                )
                                            ) : (
                                                <div style={{
                                                    width: '60px',
                                                    height: '60px',
                                                    backgroundColor: '#f8fafc',
                                                    borderRadius: '0.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '1px dashed #cbd5e1'
                                                }}>
                                                    <Image size={20} color="#94a3b8" />
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <strong style={{ color: '#1e293b' }}>{post.title}</strong>
                                        </td>
                                        <td>
                                            <span style={{ 
                                                color: '#64748b',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                maxWidth: '300px'
                                            }}>
                                                {post.content}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                                                <Calendar size={14} />
                                                {formatDate(post.created_at)}
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.actions}>
                                                <a 
                                                    href="/novidades" 
                                                    target="_blank"
                                                    className={styles.editBtn}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
                                                >
                                                    <Eye size={14} />
                                                    Ver
                                                </a>
                                                <button 
                                                    className={styles.deleteBtn}
                                                    onClick={() => handleDelete(post.id)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                >
                                                    <Trash2 size={14} />
                                                    Excluir
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {showModal && (
                    <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1e293b' }}>
                                Nova Postagem
                            </h2>
                            <form onSubmit={handleSubmit}>
                                <div className={styles.formGroup}>
                                    <label>Título *</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Digite o título da postagem"
                                        required
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Conteúdo *</label>
                                    <textarea
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="Escreva o conteúdo da postagem..."
                                        required
                                        style={{ minHeight: '150px', resize: 'vertical' }}
                                    />
                                </div>

                                <div className={styles.formGrid}>
                                    <div className={styles.formGroup}>
                                        <label>Anexar Mídia (Imagem ou Vídeo)</label>
                                        <input
                                            type="file"
                                            accept="image/*,video/*"
                                            onChange={(e) => {
                                                const selectedFile = e.target.files?.[0];
                                                if (selectedFile) {
                                                    setFile(selectedFile);
                                                    setPreviewUrl(URL.createObjectURL(selectedFile));
                                                    if (selectedFile.type.startsWith('video/')) {
                                                        setMediaType('video');
                                                    } else {
                                                        setMediaType('image');
                                                    }
                                                }
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.875rem'
                                            }}
                                        />
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Ou URL da Mídia</label>
                                        <input
                                            type="text"
                                            value={mediaUrl}
                                            onChange={(e) => {
                                                setMediaUrl(e.target.value);
                                                setPreviewUrl(e.target.value);
                                            }}
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>

                                {(previewUrl || mediaUrl) && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '0.5rem' }}>
                                            Pré-visualização
                                        </label>
                                        {mediaType === 'video' ? (
                                            <video 
                                                src={previewUrl || mediaUrl} 
                                                controls 
                                                style={{ 
                                                    width: '100%', 
                                                    maxHeight: '200px', 
                                                    borderRadius: '0.5rem',
                                                    backgroundColor: '#f1f5f9'
                                                }} 
                                            />
                                        ) : (
                                            <img 
                                                src={previewUrl || mediaUrl} 
                                                alt="Preview" 
                                                style={{ 
                                                    maxWidth: '100%', 
                                                    maxHeight: '200px', 
                                                    borderRadius: '0.5rem',
                                                    objectFit: 'cover'
                                                }} 
                                            />
                                        )}
                                    </div>
                                )}

                                <div className={styles.formActions}>
                                    <button 
                                        type="button" 
                                        className={styles.cancelBtn}
                                        onClick={() => setShowModal(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            backgroundColor: '#4a7c59',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.5rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            opacity: isSubmitting ? 0.7 : 1
                                        }}
                                    >
                                        {isSubmitting ? 'Publicando...' : 'Publicar Novidade'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
