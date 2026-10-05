"use client";

import React from "react";
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

    const sizeClass = 
        effectiveSize === "sm" ? styles.sizeSm :
        effectiveSize === "lg" ? styles.sizeLg : styles.sizeMd;

    const content = (
        <div className={styles.loaderCard}>
            <img
                src="/loading.gif"
                alt="Carregando..."
                className={styles.gifMedia}
                width={effectiveSize === "sm" ? 160 : effectiveSize === "lg" ? 380 : 280}
                height="auto"
                loading="eager"
                decoding="async"
            />
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
