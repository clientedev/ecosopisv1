"use client";
import React, { useState } from "react";
import styles from "./HomeStory.module.css";
import { isGoogleDriveUrl, getGoogleDriveDirectStreamUrl, getGoogleDriveEmbedUrl } from "@/utils/driveUtils";
import { isInstagramContent, getInstagramEmbedUrl } from "@/utils/instagramUtils";
import HomeStoryModal from "./HomeStoryModal";

export interface HomeStoryItem {
    id: number | string;
    title: string;
    video_url: string;
    thumbnail_url?: string;
    order?: number;
    is_active?: boolean;
}

interface HomeStoryCirclesProps {
    stories: HomeStoryItem[];
}

export default function HomeStoryCircles({ stories = [] }: HomeStoryCirclesProps) {
    const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);

    const activeStories = stories.filter(s => s.is_active !== false);

    if (!activeStories || activeStories.length === 0) {
        return null;
    }

    const getMediaUrl = (url?: string) => {
        if (!url) return "/logo_final.png";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/api/")) return url;
        if (url.startsWith("/static/")) return url;
        if (url.startsWith("/images/")) return `/api${url}`;
        if (url.startsWith("images/")) return `/api/${url}`;
        if (url.startsWith("/uploads/")) return `/static${url}`;
        if (url.startsWith("uploads/")) return `/static/${url}`;
        return url;
    };

    /**
     * Determina a mídia para a bolinha de story em autoplay
     */
    const getPreviewMedia = (story: HomeStoryItem): { type: "video" | "iframe" | "img" | "instagram"; src: string } => {
        // Instagram Reel
        if (story.video_url && isInstagramContent(story.video_url)) {
            const embedUrl = getInstagramEmbedUrl(story.video_url);
            // Para o círculo usamos thumbnail se existir, senão mostramos logo Instagram
            return { type: "instagram", src: story.thumbnail_url || embedUrl || "" };
        }

        if (story.video_url && isGoogleDriveUrl(story.video_url)) {
            const direct = getGoogleDriveDirectStreamUrl(story.video_url);
            if (direct) {
                return { type: "video", src: direct };
            }
            const embed = getGoogleDriveEmbedUrl(story.video_url, true);
            if (embed) {
                return { type: "iframe", src: embed };
            }
        }

        if (story.video_url) {
            return { type: "video", src: getMediaUrl(story.video_url) };
        }

        if (story.thumbnail_url) {
            return { type: "img", src: getMediaUrl(story.thumbnail_url) };
        }

        return { type: "img", src: "/logo_final.png" };
    };

    return (
        <section className={styles.homeStorySection} aria-label="Stories em Destaque">
            <div className={styles.homeStoryContainer}>
                <div className={styles.storyRow}>
                    {activeStories.map((story, index) => {
                        const media = getPreviewMedia(story);
                        return (
                            <button
                                key={story.id || index}
                                className={styles.storyItem}
                                onClick={() => setSelectedStoryIndex(index)}
                                title={`Ver story: ${story.title}`}
                                type="button"
                            >
                                <div className={styles.storyCircleRing}>
                                    <div className={styles.storyCircleInner}>
                                        {media.type === "instagram" ? (
                                            // Bolinha com gradiente do Instagram
                                            <div style={{
                                                width: '100%', height: '100%', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center',
                                                background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
                                            }}>
                                                {media.src && media.src.startsWith('http') && !media.src.includes('instagram.com/reel') ? (
                                                    <img src={media.src} alt={story.title} className={styles.storyMediaPreview} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                ) : (
                                                    // Ícone Instagram SVG responsivo
                                                    <svg className={styles.storyInstaIcon} viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                                                    </svg>
                                                )}
                                            </div>
                                        ) : media.type === "video" ? (
                                            <video
                                                src={media.src}
                                                className={styles.storyMediaPreview}
                                                autoPlay
                                                loop
                                                muted
                                                playsInline
                                                disablePictureInPicture
                                                onError={(e) => {
                                                    const target = e.currentTarget;
                                                    target.style.display = "none";
                                                    const fallback = target.parentElement?.querySelector(".story-fallback-img");
                                                    if (fallback) (fallback as HTMLElement).style.display = "block";
                                                }}
                                            />
                                        ) : media.type === "iframe" ? (
                                            <iframe
                                                src={media.src}
                                                className={styles.storyMediaPreview}
                                                allow="autoplay; encrypted-media"
                                                title={story.title || "Story"}
                                                style={{ border: "none", pointerEvents: "none" }}
                                            />
                                        ) : (
                                            <img
                                                src={media.src}
                                                alt={story.title || "Story"}
                                                className={styles.storyMediaPreview}
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = "/logo_final.png";
                                                }}
                                            />
                                        )}
                                        {/* Fallback image */}
                                        <img
                                            src="/logo_final.png"
                                            alt="Ecosopis"
                                            className={`${styles.storyMediaPreview} story-fallback-img`}
                                            style={{ display: "none" }}
                                        />
                                    </div>
                                </div>
                                <span className={styles.storyLabel}>{story.title}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedStoryIndex !== null && (
                <HomeStoryModal
                    stories={activeStories}
                    initialIndex={selectedStoryIndex}
                    onClose={() => setSelectedStoryIndex(null)}
                />
            )}
        </section>
    );
}
