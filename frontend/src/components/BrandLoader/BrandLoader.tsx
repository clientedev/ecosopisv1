"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./BrandLoader.module.css";

export interface BrandLoaderProps {
    fullScreen?: boolean;
    fadeOut?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
    /**
     * true  = animated tree splash (used only on site entry, by LoadingProvider)
     * false = discreet spinner (route changes, page sections, checkout processing)
     */
    splash?: boolean;
}

function Spinner({ fullScreen, fadeOut, className }: { fullScreen: boolean; fadeOut: boolean; className: string }) {
    if (fullScreen) {
        return (
            <aside
                aria-label="Carregando"
                role="status"
                aria-live="polite"
                className={`${styles.spinnerOverlay} ${fadeOut ? styles.fadeOut : ""} ${className}`}
            >
                <span className={styles.spinner} />
            </aside>
        );
    }
    return (
        <div role="status" aria-live="polite" aria-label="Carregando" className={`${styles.spinnerInline} ${className}`}>
            <span className={styles.spinner} />
        </div>
    );
}

function TreeSplash({ fadeOut, size, className }: { fadeOut: boolean; size?: "sm" | "md" | "lg"; className: string }) {
    const effectiveSize = size || "lg";
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [useVideo, setUseVideo] = useState(true);
    // Key ensures GIF restarts from frame 0 if video is fallback
    const [mountTimestamp] = useState(() => Date.now());

    const sizeClass =
        effectiveSize === "sm" ? styles.sizeSm :
        effectiveSize === "lg" ? styles.sizeLg : styles.sizeMd;
    const width = effectiveSize === "sm" ? 160 : effectiveSize === "lg" ? 380 : 280;

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => setUseVideo(false));
            }
        }
    }, []);

    const gif = (
        <img
            src={`/loading.gif?v=${mountTimestamp}`}
            alt="Carregando..."
            className={styles.gifMedia}
            width={width}
            height="auto"
            loading="eager"
            decoding="async"
        />
    );

    return (
        <aside
            aria-label="Carregando"
            role="status"
            aria-live="polite"
            data-brand-splash=""
            {...(fadeOut ? { "data-fading": "" } : {})}
            className={`${styles.fullScreenWrapper} ${fadeOut ? styles.fadeOut : ""} ${sizeClass} ${className}`}
        >
            <div className={styles.loaderCard}>
                {useVideo ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        className={styles.gifMedia}
                        width={width}
                        height="auto"
                        onError={() => setUseVideo(false)}
                    >
                        <source src="/loading.mp4" type="video/mp4" />
                        {gif}
                    </video>
                ) : gif}
                {/* Shown only when the Black Friday theme is active (see CSS) */}
                <div className={styles.bfCaption} aria-hidden="true">
                    <span className={styles.bfEmbers}>
                        {Array.from({ length: 9 }).map((_, i) => (
                            <i key={i} style={{ ["--i" as any]: i }} />
                        ))}
                    </span>
                    <span className={styles.bfTitle}>
                        <span className={styles.bfBlack}>BLACK</span>
                        <span className={styles.bfFriday}>FRIDAY</span>
                    </span>
                    <span className={styles.bfMeta}>
                        <span className={styles.bfLine} />
                        <svg className={styles.bfFlame} viewBox="0 0 12 16">
                            <path d="M6 0C6.6 3 10 5.2 10 9.6 10 13 8.2 16 6 16S2 13.9 2 10.8c0-2 1-3.3 1.9-4.2.1 1.4.7 2.3 1.5 2.6C5 6.6 4.9 3.4 6 0Z" fill="#e8233f" />
                            <path d="M6 8.5c.4 1.4 2 2.3 2 4.1C8 14.1 7.1 15 6 15s-2-.8-2-2.1c0-1 .6-1.6 1.1-2 .1.6.4 1 .8 1.1-.2-1.3-.2-2.4.1-3.5Z" fill="#ffb347" />
                        </svg>
                        <span className={styles.bfDate}>ECOSOPIS · 27 NOV</span>
                        <svg className={styles.bfFlame} viewBox="0 0 12 16">
                            <path d="M6 0C6.6 3 10 5.2 10 9.6 10 13 8.2 16 6 16S2 13.9 2 10.8c0-2 1-3.3 1.9-4.2.1 1.4.7 2.3 1.5 2.6C5 6.6 4.9 3.4 6 0Z" fill="#e8233f" />
                            <path d="M6 8.5c.4 1.4 2 2.3 2 4.1C8 14.1 7.1 15 6 15s-2-.8-2-2.1c0-1 .6-1.6 1.1-2 .1.6.4 1 .8 1.1-.2-1.3-.2-2.4.1-3.5Z" fill="#ffb347" />
                        </svg>
                        <span className={styles.bfLine} />
                    </span>
                </div>
            </div>
        </aside>
    );
}

export default function BrandLoader({
    fullScreen = false,
    fadeOut = false,
    size,
    className = "",
    splash = false,
}: BrandLoaderProps) {
    if (splash) return <TreeSplash fadeOut={fadeOut} size={size} className={className} />;
    return <Spinner fullScreen={fullScreen} fadeOut={fadeOut} className={className} />;
}
