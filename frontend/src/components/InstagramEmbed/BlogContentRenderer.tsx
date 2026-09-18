"use client";

import React from "react";
import InstagramPostEmbed from "./InstagramPostEmbed";
import { isInstagramContent, extractInstagramId } from "@/utils/instagramUtils";

interface BlogContentRendererProps {
    content: string;
    className?: string;
}

/**
 * Renderiza o conteúdo textual de uma postagem de blog,
 * detectando automaticamente blocos ou links do Instagram incorporados no texto
 * e transformando-os em componentes interativos e responsivos de post completo.
 */
export default function BlogContentRenderer({ content, className = "" }: BlogContentRendererProps) {
    if (!content) return null;

    // Se o conteúdo tiver código embed blockquote do Instagram
    if (content.includes("instagram-media") && content.includes("data-instgrm-permalink")) {
        const parts = content.split(/(<blockquote[\s\S]*?<\/blockquote>)/gi);
        return (
            <div className={className}>
                {parts.map((part, idx) => {
                    if (part.includes("instagram-media")) {
                        return <InstagramPostEmbed key={idx} url={part} />;
                    }
                    if (!part.trim()) return null;
                    return (
                        <div key={idx} style={{ whiteSpace: "pre-line", marginBottom: "1rem" }}>
                            {part}
                        </div>
                    );
                })}
            </div>
        );
    }

    // Procura por linhas que sejam links diretos do Instagram
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        // Verifica se a linha é uma URL isolada do Instagram
        if (
            isInstagramContent(trimmed) &&
            extractInstagramId(trimmed) &&
            (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("www."))
        ) {
            // Descarrega parágrafo acumulado anterior
            if (currentParagraph.length > 0) {
                elements.push(
                    <div
                        key={`text-${index}`}
                        style={{ whiteSpace: "pre-line", marginBottom: "1rem" }}
                    >
                        {currentParagraph.join("\n")}
                    </div>
                );
                currentParagraph = [];
            }
            // Insere o embed do Instagram
            elements.push(<InstagramPostEmbed key={`ig-${index}`} url={trimmed} />);
        } else {
            currentParagraph.push(line);
        }
    });

    // Descarrega o que sobrou
    if (currentParagraph.length > 0) {
        elements.push(
            <div
                key="text-final"
                style={{ whiteSpace: "pre-line", marginBottom: "1rem" }}
            >
                {currentParagraph.join("\n")}
            </div>
        );
    }

    return <div className={className}>{elements}</div>;
}
