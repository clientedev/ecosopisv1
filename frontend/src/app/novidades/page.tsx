'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Heart, MessageCircle, Share2, Calendar, User } from 'lucide-react';
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
  const { user } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/news');
      if (response.ok) {
        const data = await response.json();
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Agora mesmo';
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    if (diffInHours < 48) return 'Ontem';
    return formatDate(dateString);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100">
      <Header />
      
      <main className="max-w-3xl mx-auto py-16 px-4">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4">
            Feed de Novidades
          </span>
          <h1 className="text-4xl md:text-5xl font-serif text-stone-900 mb-3">
            Novidades ECOSOPIS
          </h1>
          <p className="text-lg text-stone-600 max-w-xl mx-auto">
            Fique por dentro das últimas atualizações, lançamentos e dicas de beleza natural
          </p>
        </div>

        <div className="space-y-8">
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-6 animate-pulse">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-stone-200 rounded-full"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-stone-200 rounded"></div>
                      <div className="h-3 w-24 bg-stone-100 rounded"></div>
                    </div>
                  </div>
                  <div className="h-6 w-3/4 bg-stone-200 rounded mb-3"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-stone-100 rounded"></div>
                    <div className="h-4 w-5/6 bg-stone-100 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 mx-auto mb-6 bg-stone-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-10 h-10 text-stone-400" />
              </div>
              <h3 className="text-xl font-medium text-stone-700 mb-2">Nenhuma novidade ainda</h3>
              <p className="text-stone-500">Em breve teremos novidades incríveis para você!</p>
            </div>
          ) : (
            posts.map((post, index) => (
              <article 
                key={post.id} 
                className="bg-white rounded-3xl shadow-sm border border-stone-200/60 overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {post.user?.full_name?.charAt(0) || 'E'}
                      </div>
                      <div>
                        <p className="font-semibold text-stone-900">
                          {post.user?.full_name || 'ECOSOPIS'}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-stone-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{getTimeAgo(post.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                      Novidade
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold text-stone-900 mb-3 leading-tight">
                    {post.title}
                  </h2>
                  <p className="text-stone-600 leading-relaxed whitespace-pre-wrap text-base">
                    {post.content}
                  </p>
                </div>

                {post.media_url && (
                  <div className="relative">
                    {post.media_type === 'video' ? (
                      <video
                        src={post.media_url}
                        controls
                        className="w-full aspect-video object-cover"
                        poster=""
                      />
                    ) : (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={post.media_url}
                          alt={post.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="px-6 py-4 border-t border-stone-100 flex items-center gap-6">
                  <button className="flex items-center gap-2 text-stone-500 hover:text-rose-500 transition-colors group">
                    <div className="p-2 rounded-full group-hover:bg-rose-50 transition-colors">
                      <Heart className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">Curtir</span>
                  </button>
                  <button className="flex items-center gap-2 text-stone-500 hover:text-primary transition-colors group">
                    <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">Comentar</span>
                  </button>
                  <button className="flex items-center gap-2 text-stone-500 hover:text-blue-500 transition-colors group ml-auto">
                    <div className="p-2 rounded-full group-hover:bg-blue-50 transition-colors">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">Compartilhar</span>
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        {posts.length > 0 && (
          <div className="text-center mt-12">
            <p className="text-stone-500 text-sm">
              Mostrando {posts.length} {posts.length === 1 ? 'novidade' : 'novidades'}
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
