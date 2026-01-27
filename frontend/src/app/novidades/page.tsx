'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Camera, Video, Send, Trash2, Heart, MessageCircle } from 'lucide-react';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';

interface NewsPost {
  id: number;
  title: string;
  content: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  created_at: string;
  user_id: number;
  user?: {
    full_name: string;
    email: string;
  };
}

export default function NewsPage() {
  const { user, token } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/news');
      if (response.ok) {
        const data = await response.get();
        setPosts(data);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          content,
          media_url: mediaUrl,
          media_type: mediaType
        })
      });

      if (response.ok) {
        setTitle('');
        setContent('');
        setMediaUrl('');
        fetchPosts();
      }
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (postId: number) => {
    if (!token) return;
    if (!confirm('Deseja excluir este post?')) return;

    try {
      const response = await fetch(`/api/news/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        fetchPosts();
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      
      <main className="max-w-2xl mx-auto py-12 px-4">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-serif text-primary mb-2">Novidades</h1>
          <p className="text-stone-600">Acompanhe as últimas atualizações da ECOSOPIS</p>
        </div>

        {user && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-8">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Compartilhar novidade
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Título"
                className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <textarea
                placeholder="O que há de novo?"
                className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="URL da Imagem ou Vídeo"
                  className="flex-1 px-4 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                />
                <select
                  className="px-4 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as 'image' | 'video')}
                >
                  <option value="image">Imagem</option>
                  <option value="video">Vídeo</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Publicando...' : 'Publicar'}
              </button>
            </form>
          </div>
        )}

        <div className="space-y-8">
          {loading ? (
            <div className="text-center py-10">Carregando...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-10 text-stone-500 bg-white rounded-2xl border border-stone-200">
              Nenhuma novidade ainda.
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-stone-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {post.user?.full_name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="font-medium text-stone-900">{post.user?.full_name || 'Usuário'}</p>
                      <p className="text-xs text-stone-500">
                        {new Date(post.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  {(user?.id === post.user_id || user?.role === 'admin') && (
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold mb-3 text-stone-900">{post.title}</h3>
                  <p className="text-stone-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                </div>

                {post.media_url && (
                  <div className="aspect-video bg-stone-100 relative">
                    {post.media_type === 'video' ? (
                      <video
                        src={post.media_url}
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={post.media_url}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                )}

                <div className="p-4 flex items-center gap-6 border-t border-stone-50 text-stone-500">
                  <button className="flex items-center gap-2 hover:text-primary transition-colors">
                    <Heart className="w-5 h-5" />
                    <span className="text-sm font-medium">Curtir</span>
                  </button>
                  <button className="flex items-center gap-2 hover:text-primary transition-colors">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Comentar</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
