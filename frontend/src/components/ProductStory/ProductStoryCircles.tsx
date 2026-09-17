"use client";
import React from "react";
import styles from "./ProductStory.module.css";
import { Play, Sparkles } from "lucide-react";

export interface StoryVideo {
    id?: string;
    title: string;
    video_url: string;
    thumbnail_url?: string;
}

interface ProductStoryCirclesProps {
    storyVideos?: StoryVideo[];
    onSelectStory: (index: number) => void;
    productImage?: string;
}

export default function ProductStoryCircles({
    storyVideos = [],
    onSelectStory,
    productImage = "/logo_final.png"
}: ProductStoryCirclesProps) {
    if (!storyVideos || storyVideos.length === 0) {
        return null;
    }

    const getMediaUrl = (url?: string) => {
        if (!url) return productImage;
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("images/")) return `/api/${url}`;
        if (url.startsWith("/uploads/")) return `/static${url}`;
        if (url.startsWith("uploads/")) return `/static/${url}`;
        return url;
    };

    return (
        <div className={styles.storySectionContainer}>
            <div className={styles.storySectionHeader}>
                <Sparkles size={16} color="#c86d51" />
                <span className={styles.storySectionTitle}>Conheça em detalhes</span>
                <span className={styles.storyBadge}>Stories</span>
            </div>
            <div className={styles.storyRow}>
                {storyVideos.slice(0, 4).map((story, index) => {
                    const thumb = story.thumbnail_url || productImage;
                    return (
                        <button
                            key={story.id || index}
                            className={styles.storyItem}
                            onClick={() => onSelectStory(index)}
                            title={`Ver vídeo: ${story.title || `Vídeo ${index + 1}`}`}
                            type="button"
                        >
                            <div className={styles.storyCircleRing}>
                                <div className={styles.storyCircleInner}>
                                    {story.thumbnail_url ? (
                                        <img
                                            src={getMediaUrl(thumb)}
                                            alt={story.title || "Story"}
                                            className={styles.storyMediaPreview}
                                        />
                                    ) : (
                                        <video
                                            src={getMediaUrl(story.video_url)}
                                            className={styles.storyMediaPreview}
                                            muted
                                            playsInline
                                            preload="metadata"
                                        />
                                    )}
                                    <div className={styles.storyPlayOverlay}>
                                        <Play className={styles.storyPlayIcon} fill="#ffffff" size={16} />
                                    </div>
                                </div>
                            </div>
                            <span className={styles.storyLabel}>
                                {story.title || `Vídeo ${index + 1}`}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
