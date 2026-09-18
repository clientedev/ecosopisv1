"use client";
import React, { useState } from "react";
import styles from "./HomeStory.module.css";
import { isGoogleDriveUrl, getGoogleDriveDirectStreamUrl, getGoogleDriveEmbedUrl } from "@/utils/driveUtils";
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
    const getPreviewMedia = (story: HomeStoryItem): { type: "video" | "iframe" | "img"; src: string } => {
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
                                        {media.type === "video" ? (
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
