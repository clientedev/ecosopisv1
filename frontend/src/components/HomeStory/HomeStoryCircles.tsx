"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import styles from "./HomeStory.module.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isGoogleDriveUrl, getGoogleDriveDirectStreamUrl, getGoogleDriveEmbedUrl } from "@/utils/driveUtils";
import { isInstagramContent, getInstagramEmbedUrl, getInstagramDirectStreamUrl } from "@/utils/instagramUtils";
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
    const rowRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const activeStories = stories.filter(s => s.is_active !== false);

    const checkScroll = useCallback(() => {
        if (!rowRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
        setCanScrollLeft(scrollLeft > 6);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
    }, []);

    useEffect(() => {
        checkScroll();
        const row = rowRef.current;
        if (!row) return;

        row.addEventListener("scroll", checkScroll, { passive: true });
        window.addEventListener("resize", checkScroll);
        const timer = setTimeout(checkScroll, 300);

        return () => {
            clearTimeout(timer);
            row.removeEventListener("scroll", checkScroll);
            window.removeEventListener("resize", checkScroll);
        };
    }, [activeStories, checkScroll]);

    const handleScroll = (direction: "left" | "right") => {
        if (!rowRef.current) return;
        const offset = direction === "left" ? -300 : 300;
        rowRef.current.scrollBy({ left: offset, behavior: "smooth" });
    };

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
    const getPreviewMedia = (story: HomeStoryItem): { type: "video" | "iframe" | "img"; src: string } => {
        // Instagram Reel -> stream direto do vídeo MP4 nativo para autoplay sem travar
        if (story.video_url && isInstagramContent(story.video_url)) {
            const direct = getInstagramDirectStreamUrl(story.video_url);
            if (direct) {
                return { type: "video", src: direct };
            }
            const embedUrl = getInstagramEmbedUrl(story.video_url);
            if (embedUrl) {
                return { type: "iframe", src: embedUrl };
            }
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
                <div className={styles.storyRowWrapper}>
                    {canScrollLeft && (
                        <button
                            type="button"
                            className={`${styles.rowNavBtn} ${styles.rowNavBtnLeft}`}
                            onClick={() => handleScroll("left")}
                            aria-label="Rolar stories para a esquerda"
                            title="Anterior"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}

                    <div ref={rowRef} className={styles.storyRow}>
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
                                            {media.type === "video" ? (
                                                <video
                                                    src={media.src}
                                                    className={styles.storyMediaPreview}
                                                    autoPlay
                                                    loop
                                                    muted
                                                    playsInline
                                                    preload="metadata"
                                                    disablePictureInPicture
                                                    onLoadedMetadata={(e) => {
                                                        const target = e.currentTarget;
                                                        target.muted = true;
                                                        target.play().catch(() => {});
                                                    }}
                                                    onCanPlay={(e) => {
                                                        const target = e.currentTarget;
                                                        target.muted = true;
                                                        target.play().catch(() => {});
                                                    }}
                                                />
                                            ) : media.type === "iframe" ? (
                                                <iframe
                                                    src={media.src}
                                                    className={styles.storyMediaPreview}
                                                    allow="autoplay; encrypted-media"
                                                    title={story.title || "Story"}
                                                    style={{ border: "none", pointerEvents: "none", width: "100%", height: "100%", objectFit: "cover" }}
                                                />
                                            ) : (
                                                <img
                                                    src={media.src}
                                                    alt={story.title || "Story"}
                                                    className={styles.storyMediaPreview}
                                                    loading="lazy"
                                                    decoding="async"
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

                    {canScrollRight && (
                        <button
                            type="button"
                            className={`${styles.rowNavBtn} ${styles.rowNavBtnRight}`}
                            onClick={() => handleScroll("right")}
                            aria-label="Rolar stories para a direita"
                            title="Próximo"
                        >
                            <ChevronRight size={20} />
                        </button>
                    )}
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
