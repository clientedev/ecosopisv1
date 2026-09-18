"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import styles from "./ProductStory.module.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isGoogleDriveUrl, getGoogleDriveDirectStreamUrl, getGoogleDriveEmbedUrl } from "@/utils/driveUtils";
import { isInstagramContent, getInstagramEmbedUrl, getInstagramDirectStreamUrl } from "@/utils/instagramUtils";

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
    const rowRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

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
    }, [storyVideos, checkScroll]);

    const handleScroll = (direction: "left" | "right") => {
        if (!rowRef.current) return;
        const offset = direction === "left" ? -260 : 260;
        rowRef.current.scrollBy({ left: offset, behavior: "smooth" });
    };

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

    /**
     * Determina o tipo e a URL da mídia para a bolinha de preview.
     * O vídeo DEVE rodar em autoplay contínuo dentro da bolinha sem imagem estática de capa.
     */
    const getPreviewMedia = (story: StoryVideo): { type: "video" | "iframe" | "img"; src: string } => {
        // Se for Instagram Reel
        if (story.video_url && isInstagramContent(story.video_url)) {
            const direct = getInstagramDirectStreamUrl(story.video_url);
            if (direct) {
                return { type: "video", src: direct };
            }
            const embed = getInstagramEmbedUrl(story.video_url);
            if (embed) {
                return { type: "iframe", src: embed };
            }
        }

        // Se for URL do Google Drive
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

        // Vídeo comum (MP4, WebM, etc) -> toca em autoplay contínuo dentro da bolinha
        if (story.video_url) {
            return { type: "video", src: getMediaUrl(story.video_url) };
        }

        // Fallback apenas se não houver vídeo
        if (story.thumbnail_url) {
            return { type: "img", src: getMediaUrl(story.thumbnail_url) };
        }

        return { type: "img", src: productImage };
    };

    return (
        <div className={styles.storySectionContainer}>
            <div className={styles.storyRowWrapper}>
                {canScrollLeft && (
                    <button
                        type="button"
                        className={`${styles.rowNavBtn} ${styles.rowNavBtnLeft}`}
                        onClick={() => handleScroll("left")}
                        aria-label="Rolar stories para a esquerda"
                        title="Anterior"
                    >
                        <ChevronLeft size={18} />
                    </button>
                )}

                <div ref={rowRef} className={styles.storyRow}>
                    {storyVideos.map((story, index) => {
                        const media = getPreviewMedia(story);
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
                                        {media.type === "video" ? (
                                            <video
                                                src={media.src}
                                                className={styles.storyMediaPreview}
                                                autoPlay
                                                loop
                                                muted
                                                playsInline
                                                preload="auto"
                                                disablePictureInPicture
                                                onLoadedMetadata={(e) => {
                                                    const v = e.currentTarget;
                                                    v.muted = true;
                                                    v.play().catch(() => {});
                                                }}
                                                onCanPlay={(e) => {
                                                    const v = e.currentTarget;
                                                    v.muted = true;
                                                    v.play().catch(() => {});
                                                }}
                                            />
                                        ) : media.type === "iframe" ? (
                                            <iframe
                                                src={media.src}
                                                className={styles.storyMediaPreview}
                                                allow="autoplay; encrypted-media"
                                                title={story.title || "Story preview"}
                                                style={{ border: "none", pointerEvents: "none", width: "100%", height: "100%", objectFit: "cover" }}
                                            />
                                        ) : (
                                            <img
                                                src={media.src}
                                                alt={story.title || "Story"}
                                                className={styles.storyMediaPreview}
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = productImage;
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
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
                        <ChevronRight size={18} />
                    </button>
                )}
            </div>
        </div>
    );
}
