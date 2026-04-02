export interface NewsCommentAuthor {
  id: number;
  full_name?: string | null;
  profile_picture?: string | null;
}

export interface NewsComment {
  id: number;
  content: string;
  user: NewsCommentAuthor;
  created_at: string;
}

export interface NewsPostEngagement {
  id: number;
  title: string;
  content?: string;
  media_url?: string;
  media_type?: string;
  created_at?: string;
  user?: {
    id?: number;
    full_name?: string | null;
    profile_picture?: string | null;
  };
  comments: NewsComment[];
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
}
