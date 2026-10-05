"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./BrandLoader.module.css";

export interface BrandLoaderProps {
    fullScreen?: boolean;
    fadeOut?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

export default function BrandLoader({
    fullScreen = false,
    fadeOut = false,
    size,
    className = ""
}: BrandLoaderProps) {
    const effectiveSize = size || (fullScreen ? "lg" : "md");
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
                playPromise.catch(() => {
                    // If video autoplay is prevented by browser policy, fallback to GIF
                    setUseVideo(false);
                });
            }
        }
    }, []);

    const content = (
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
                    <img
                        src={`/loading.gif?v=${mountTimestamp}`}
                        alt="Carregando..."
                        className={styles.gifMedia}
                        width={width}
                        height="auto"
                        loading="eager"
                        decoding="async"
                    />
                </video>
            ) : (
                <img
                    src={`/loading.gif?v=${mountTimestamp}`}
                    alt="Carregando..."
                    className={styles.gifMedia}
                    width={width}
                    height="auto"
                    loading="eager"
                    decoding="async"
                />
            )}
        </div>
    );

    if (fullScreen) {
        return (
            <aside
                aria-label="Carregando"
                role="status"
                aria-live="polite"
                className={`${styles.fullScreenWrapper} ${fadeOut ? styles.fadeOut : ""} ${sizeClass} ${className}`}
            >
                {content}
            </aside>
        );
    }

    return (
        <div 
            role="status" 
            aria-live="polite" 
            className={`${styles.inlineWrapper} ${sizeClass} ${className}`}
        >
            {content}
        </div>
    );
}
