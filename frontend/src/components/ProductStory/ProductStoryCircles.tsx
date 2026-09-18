"use client";
import React from "react";
import styles from "./ProductStory.module.css";
import { isGoogleDriveUrl, getGoogleDriveDirectStreamUrl, getGoogleDriveEmbedUrl } from "@/utils/driveUtils";
import { isInstagramContent, getInstagramEmbedUrl } from "@/utils/instagramUtils";

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

    /**
     * Determina o tipo e a URL da mídia para a bolinha de preview.
     * O vídeo DEVE rodar em autoplay contínuo dentro da bolinha sem imagem estática de capa.
     */
    const getPreviewMedia = (story: StoryVideo): { type: "video" | "iframe" | "img"; src: string } => {
        // Se for Instagram Reel
        if (story.video_url && isInstagramContent(story.video_url)) {
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
            <div className={styles.storyRow}>
                {storyVideos.slice(0, 4).map((story, index) => {
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
        </div>
    );
}
