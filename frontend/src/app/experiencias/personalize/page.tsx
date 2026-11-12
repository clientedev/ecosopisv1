"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import {
    Search, Upload, ImagePlus, Download, RotateCcw, MessageCircle, Maximize2, X, Check, Palette,
    Layers, Lock, Unlock, AlertCircle, ArrowLeft, ArrowRight, Sparkles, Eye, Wand2, Scissors, Trash2,
} from "lucide-react";
import { loadArtFile, LoadedArt } from "@/lib/personalization/artLoader";
import {
    AreaCfg, ArtTransform, areaAspect, buildMapper, defaultTransform, extractLabel, imageToPlane, renderComposite,
} from "@/lib/personalization/renderer";
import { keyOutBackground, smartFit } from "@/lib/personalization/smart";
import styles from "./page.module.css";

const WHATSAPP_NUMBER = "5511951559212";

interface Area extends AreaCfg {
    id: number;
    product_id: number;
    image_url: string;
    name: string;
}
interface Product {
    id: number;
    name: string;
    slug: string;
    category: string | null;
    description: string | null;
    photos: string[];
    areas: Area[];
    customizable: boolean;
}
interface Layer {
    id: string;
    name: string;
    canvas: HTMLCanvasElement;
    t: ArtTransform;
}
interface Placement {
    t: ArtTransform;
    enabled: boolean;
    cover: boolean;      // esconder o rótulo original por baixo da arte
    layers: Layer[];     // elementos do rótulo original recortados (movíveis)
}

const STEPS = ["Produto", "Arte", "Personalizar", "Resultado"];
const photoCache = new Map<string, Promise<HTMLImageElement>>();

function loadPhoto(url: string): Promise<HTMLImageElement> {
    let p = photoCache.get(url);
    if (!p) {
        p = new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => {
                // alguns armazenamentos externos não enviam CORS: tenta sem (a exportação PNG pode falhar)
                const img2 = new Image();
                img2.onload = () => resolve(img2);
                img2.onerror = () => { photoCache.delete(url); reject(new Error("Foto indisponível")); };
                img2.src = url;
            };
            img.src = url;
        });
        photoCache.set(url, p);
    }
    return p;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function PersonalizePage() {
    const [products, setProducts] = useState<Product[] | null>(null);
    const [loadError, setLoadError] = useState("");
    const [step, setStep] = useState(1);
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("Todos");
    const [onlyReady, setOnlyReady] = useState(false);
    const [notice, setNotice] = useState<Product | null>(null);

    const [product, setProduct] = useState<Product | null>(null);
    const [photoUrl, setPhotoUrl] = useState("");
    const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
    const [photoError, setPhotoError] = useState("");
    const [areaId, setAreaId] = useState<number | null>(null);
    const [placements, setPlacements] = useState<Record<number, Placement>>({});
    const [activeLayer, setActiveLayer] = useState<string | null>(null);
    const [aiNotes, setAiNotes] = useState<string[]>([]);
    const [extract, setExtract] = useState<null | { canvas: HTMLCanvasElement; rect: [number, number, number, number]; tol: number }>(null);
    const [kitSel, setKitSel] = useState<number[]>([]);
    const [kitBusy, setKitBusy] = useState(false);
    const [kitUrl, setKitUrl] = useState("");
    const [kitCanvas, setKitCanvas] = useState<HTMLCanvasElement | null>(null);

    const [art, setArt] = useState<LoadedArt | null>(null);
    const [artError, setArtError] = useState("");
    const [artLoading, setArtLoading] = useState(false);
    const [artPreview, setArtPreview] = useState("");
    const [dragOver, setDragOver] = useState(false);

    const [lockRatio, setLockRatio] = useState(true);
    const [showArea, setShowArea] = useState(true);
    const [result, setResult] = useState<HTMLCanvasElement | null>(null);
    const [resultUrl, setResultUrl] = useState("");
    const [compare, setCompare] = useState(50);
    const [zoom, setZoom] = useState(false);
    const [busy, setBusy] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const dragRef = useRef<{ id: number; p0: [number, number]; cx: number; cy: number } | null>(null);
    const pinchRef = useRef<{ d0: number; s0: number } | null>(null);
    const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());

    // ── catálogo real ───────────────────────────────────────────────────────
    useEffect(() => {
        let alive = true;
        fetch("/api/personalization/products")
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Falha ao carregar o catálogo."))))
            .then((d: Product[]) => alive && setProducts(d))
            .catch((e) => alive && setLoadError(e.message || "Falha ao carregar o catálogo."));
        return () => { alive = false; };
    }, []);

    const categories = useMemo(() => {
        const set = new Set<string>();
        (products || []).forEach((p) => p.category && set.add(p.category));
        return ["Todos", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    }, [products]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (products || []).filter((p) => {
            if (category !== "Todos" && p.category !== category) return false;
            if (onlyReady && !p.customizable) return false;
            if (!q) return true;
            return `${p.name} ${p.category || ""} ${p.description || ""}`.toLowerCase().includes(q);
        });
    }, [products, query, category, onlyReady]);

    // ── produto / foto / áreas ──────────────────────────────────────────────
    const photosWithAreas = useMemo(() => (product ? product.photos.filter((u) => product.areas.some((a) => a.image_url === u)) : []), [product]);
    const areasOnPhoto = useMemo(() => (product ? product.areas.filter((a) => a.image_url === photoUrl) : []), [product, photoUrl]);
    const area = useMemo(() => areasOnPhoto.find((a) => a.id === areaId) || null, [areasOnPhoto, areaId]);

    useEffect(() => {
        if (!photoUrl) { setPhoto(null); return; }
        let alive = true;
        setPhotoError("");
        loadPhoto(photoUrl).then((img) => alive && setPhoto(img)).catch((e) => alive && setPhotoError(e.message));
        return () => { alive = false; };
    }, [photoUrl]);

    const initPlacements = useCallback((p: Product, url: string, a: LoadedArt | null, img: HTMLImageElement | null) => {
        const next: Record<number, Placement> = {};
        const list = p.areas.filter((x) => x.image_url === url);
        list.forEach((x, i) => {
            const w = img?.naturalWidth || 1000, h = img?.naturalHeight || 1000;
            if (a && img) {
                // montagem inteligente por padrão: centraliza a logo e esconde o rótulo antigo quando ele atrapalharia
                const r = smartFit(a.canvas, img, w, h, x);
                next[x.id] = { t: r.t, enabled: i === 0, cover: r.cover, layers: [] };
            } else {
                next[x.id] = { t: defaultTransform(x, w, h, a?.canvas || null), enabled: i === 0, cover: !!x.cover_label, layers: [] };
            }
        });
        setPlacements(next);
        setActiveLayer(null);
        setAiNotes([]);
    }, []);

    const chooseProduct = (p: Product) => {
        if (!p.customizable) { setNotice(p); return; }
        setNotice(null);
        setProduct(p);
        const url = p.photos.find((u) => p.areas.some((a) => a.image_url === u)) || p.photos[0];
        setPhotoUrl(url);
        const first = p.areas.find((a) => a.image_url === url);
        setAreaId(first ? first.id : null);
        setResult(null);
        setStep(art ? 3 : 2);
    };

    // reposiciona a arte quando a foto/arte/produto mudam (ajusta à área)
    useEffect(() => {
        if (product && photo) initPlacements(product, photoUrl, art, photo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product, photoUrl, photo, art]);

    const changePhoto = (url: string) => {
        if (!product) return;
        setPhotoUrl(url);
        const first = product.areas.find((a) => a.image_url === url);
        setAreaId(first ? first.id : null);
    };

    // ── arte ────────────────────────────────────────────────────────────────
    const handleFile = async (file: File | undefined | null) => {
        if (!file) return;
        setArtError("");
        setArtLoading(true);
        try {
            const loaded = await loadArtFile(file);
            setArt(loaded);
            setArtPreview(loaded.canvas.toDataURL("image/png"));
        } catch (e: any) {
            setArtError(e?.message || "Não foi possível ler o arquivo.");
        } finally {
            setArtLoading(false);
        }
    };

    // ── composição ──────────────────────────────────────────────────────────
    const compose = useCallback((outWidth: number, draft: boolean): HTMLCanvasElement | null => {
        if (!photo || !product) return null;
        const pw = photo.naturalWidth, ph = photo.naturalHeight;
        const list = product.areas.filter((a) => a.image_url === photoUrl);
        let current: CanvasImageSource = photo;
        let out: HTMLCanvasElement | null = null;
        const w = Math.min(outWidth, pw);
        for (const a of list) {
            const pl = placements[a.id];
            if (!pl || !pl.enabled || !art) continue;
            out = renderComposite({ photo: current as any, photoW: pw, photoH: ph, area: { ...a, cover_label: pl.cover }, art: art.canvas, t: pl.t, outWidth: w, draft });
            current = out; // as próximas áreas desenham sobre o resultado já composto
            for (const ly of pl.layers) {
                out = renderComposite({ photo: current as any, photoW: pw, photoH: ph, area: { ...a, cover_label: false }, art: ly.canvas, t: ly.t, outWidth: w, draft });
                current = out;
            }
        }
        if (!out) {
            out = document.createElement("canvas");
            out.width = w;
            out.height = Math.round((ph * w) / pw);
            out.getContext("2d")!.drawImage(photo, 0, 0, out.width, out.height);
        }
        return out;
    }, [photo, product, photoUrl, placements, art]);

    // prévia ao vivo (rascunho rápido + versão final após uma pausa)
    useEffect(() => {
        if (step !== 3) return;
        const cv = canvasRef.current;
        if (!cv || !photo) return;
        const paint = (draft: boolean) => {
            const res = compose(draft ? 640 : 1100, draft);
            if (!res) return;
            cv.width = res.width;
            cv.height = res.height;
            cv.getContext("2d")!.drawImage(res, 0, 0);
        };
        const raf = requestAnimationFrame(() => paint(true));
        const id = setTimeout(() => paint(false), 220);
        return () => { cancelAnimationFrame(raf); clearTimeout(id); };
    }, [step, compose, photo]);

    const activeLayerRef = useRef<string | null>(null);
    activeLayerRef.current = activeLayer;
    const patchT = (pl: Placement, patch: Partial<ArtTransform>): Placement => {
        const lid = activeLayerRef.current;
        if (lid && pl.layers.some((l) => l.id === lid)) return { ...pl, layers: pl.layers.map((l) => (l.id === lid ? { ...l, t: { ...l.t, ...patch } } : l)) };
        return { ...pl, t: { ...pl.t, ...patch } };
    };
    const updateT = (patch: Partial<ArtTransform>, id = areaId) => {
        if (id == null) return;
        setPlacements((prev) => (prev[id] ? { ...prev, [id]: patchT(prev[id], patch) } : prev));
    };
    const curP = areaId != null ? placements[areaId] : undefined;
    const curLayer = curP && activeLayer ? curP.layers.find((l) => l.id === activeLayer) || null : null;
    const cur = curP ? { ...curP, t: curLayer ? curLayer.t : curP.t } : undefined;

    const setSize = (key: "scale" | "sx" | "sy", v: number) => {
        if (!cur) return;
        if (key === "sx" && lockRatio) updateT({ sx: v, sy: v });
        else if (key === "sy" && lockRatio) updateT({ sx: v, sy: v });
        else updateT({ [key]: v } as Partial<ArtTransform>);
    };

    // arrastar / pinçar / roda sobre a prévia
    const toImage = (e: { clientX: number; clientY: number }): [number, number] | null => {
        const cv = canvasRef.current;
        if (!cv) return null;
        const r = cv.getBoundingClientRect();
        return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height];
    };
    const mapperFor = (a: Area, curv: number) => {
        const cv = canvasRef.current!;
        return buildMapper(a, curv, cv.width, cv.height, photo!.naturalWidth, photo!.naturalHeight);
    };
    const onPointerDown = (e: React.PointerEvent) => {
        if (!area || !cur || !photo) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
            const [p, q] = Array.from(pointers.current.values());
            pinchRef.current = { d0: Math.hypot(p.x - q.x, p.y - q.y) || 1, s0: cur.t.scale };
            dragRef.current = null;
            return;
        }
        const pt = toImage(e);
        if (!pt) return;
        const p0 = imageToPlane(mapperFor(area, cur.t.curvature), pt[0], pt[1]);
        dragRef.current = { id: area.id, p0, cx: cur.t.cx, cy: cur.t.cy };
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinchRef.current && pointers.current.size === 2 && cur) {
            const [p, q] = Array.from(pointers.current.values());
            const d = Math.hypot(p.x - q.x, p.y - q.y) || 1;
            updateT({ scale: clamp(pinchRef.current.s0 * (d / pinchRef.current.d0), 0.03, 2.5) });
            return;
        }
        const d = dragRef.current;
        if (!d || !area || !cur) return;
        const pt = toImage(e);
        if (!pt) return;
        const p = imageToPlane(mapperFor(area, cur.t.curvature), pt[0], pt[1]);
        if (!isFinite(p[0]) || !isFinite(p[1])) return;
        updateT({ cx: d.cx + (p[0] - d.p0[0]), cy: d.cy + (p[1] - d.p0[1]) }, d.id);
    };
    const onPointerUp = (e: React.PointerEvent) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinchRef.current = null;
        if (pointers.current.size === 0) dragRef.current = null;
    };
    useEffect(() => {
        const cv = canvasRef.current;
        if (!cv || step !== 3) return;
        const onWheel = (ev: WheelEvent) => {
            if (areaId == null) return;
            ev.preventDefault();
            setPlacements((prev) => {
                const p = prev[areaId];
                if (!p) return prev;
                const lid = activeLayerRef.current;
                const base = lid ? p.layers.find((l) => l.id === lid)?.t ?? p.t : p.t;
                return { ...prev, [areaId]: patchT(p, { scale: clamp(base.scale * Math.exp(-ev.deltaY * 0.0015), 0.03, 2.5) }) };
            });
        };
        cv.addEventListener("wheel", onWheel, { passive: false });
        return () => cv.removeEventListener("wheel", onWheel);
    }, [step, areaId, photo]);

    // ── Ajuda da I.A. (montagem inteligente) ────────────────────────────────
    const runAI = () => {
        if (!art || !photo || !product) return;
        const list = product.areas.filter((a) => a.image_url === photoUrl);
        const notes: string[] = [];
        setPlacements((prev) => {
            const next = { ...prev };
            list.forEach((a) => {
                const r = smartFit(art.canvas, photo, photo.naturalWidth, photo.naturalHeight, a);
                next[a.id] = { t: r.t, enabled: true, cover: r.cover, layers: [] };
                if (a.id === areaId || !notes.length) notes.splice(0, notes.length, ...r.notes);
            });
            return next;
        });
        setActiveLayer(null);
        setAiNotes(notes.length ? notes : ["Montagem concluída."]);
    };

    // ── elementos do rótulo original ────────────────────────────────────────
    const openExtract = () => {
        if (!photo || !area) return;
        const cv = extractLabel(photo, photo.naturalWidth, photo.naturalHeight, area, 900);
        setExtract({ canvas: cv, rect: [0.3, 0.3, 0.7, 0.7], tol: 0.5 });
    };
    const confirmExtract = () => {
        if (!extract || !area || !photo || areaId == null) return;
        const { canvas, rect } = extract;
        const x0 = Math.round(rect[0] * canvas.width), y0 = Math.round(rect[1] * canvas.height);
        const x1 = Math.round(rect[2] * canvas.width), y1 = Math.round(rect[3] * canvas.height);
        const w = Math.max(4, x1 - x0), h = Math.max(4, y1 - y0);
        const crop = document.createElement("canvas");
        crop.width = w; crop.height = h;
        crop.getContext("2d")!.drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
        const piece = keyOutBackground(crop, extract.tol);
        const A = areaAspect(area, photo.naturalWidth, photo.naturalHeight);
        const id = `l${Date.now()}`;
        const t: ArtTransform = {
            cx: (x0 + x1) / 2 / canvas.width, cy: (((y0 + y1) / 2) / canvas.height) / A, scale: w / canvas.width,
            sx: 1, sy: 1, rotation: 0, opacity: 1, perspX: 0, perspY: 0, curvature: area.curvature || 0,
        };
        setPlacements((prev) => {
            const p = prev[areaId];
            if (!p) return prev;
            const n = p.layers.length + 1;
            return { ...prev, [areaId]: { ...p, cover: true, layers: [...p.layers, { id, name: `Elemento ${n}`, canvas: piece, t }] } };
        });
        setActiveLayer(id);
        setExtract(null);
    };
    const removeLayer = (id: string) => {
        if (areaId == null) return;
        setPlacements((prev) => (prev[areaId] ? { ...prev, [areaId]: { ...prev[areaId], layers: prev[areaId].layers.filter((l) => l.id !== id) } } : prev));
        if (activeLayer === id) setActiveLayer(null);
    };
    const extractRef = useRef<HTMLDivElement | null>(null);
    const extractDrag = useRef<[number, number] | null>(null);
    const exNorm = (e: React.PointerEvent): [number, number] => {
        const r = extractRef.current!.getBoundingClientRect();
        return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)];
    };
    const exDown = (e: React.PointerEvent) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); extractDrag.current = exNorm(e); };
    const exMove = (e: React.PointerEvent) => {
        const s0 = extractDrag.current;
        if (!s0 || !extract) return;
        const p = exNorm(e);
        const r: [number, number, number, number] = [Math.min(s0[0], p[0]), Math.min(s0[1], p[1]), Math.max(s0[0], p[0]), Math.max(s0[1], p[1])];
        if (r[2] - r[0] > 0.02 && r[3] - r[1] > 0.02) setExtract({ ...extract, rect: r });
    };
    const exUp = () => { extractDrag.current = null; };
    const exCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
        if (node && extract) { node.width = extract.canvas.width; node.height = extract.canvas.height; node.getContext("2d")!.drawImage(extract.canvas, 0, 0); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [extract?.canvas]);

    // ── kit: vários produtos numa imagem só ─────────────────────────────────
    const toggleKit = (id: number) => setKitSel((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id]));
    const buildKit = async () => {
        if (!art || !product || !result) return;
        setKitBusy(true);
        try {
            const tiles: { cv: HTMLCanvasElement; name: string }[] = [{ cv: result, name: product.name }];
            for (const pid of kitSel) {
                if (pid === product.id) continue;
                const p = (products || []).find((x) => x.id === pid);
                if (!p) continue;
                const url = p.photos.find((u) => p.areas.some((a) => a.image_url === u)) || p.photos[0];
                const img = await loadPhoto(url);
                const pw = img.naturalWidth, ph = img.naturalHeight, w = Math.min(1100, pw);
                let current: CanvasImageSource = img;
                let out: HTMLCanvasElement | null = null;
                for (const a of p.areas.filter((x) => x.image_url === url)) {
                    const r = smartFit(art.canvas, img, pw, ph, a);
                    out = renderComposite({ photo: current as any, photoW: pw, photoH: ph, area: { ...a, cover_label: r.cover }, art: art.canvas, t: r.t, outWidth: w, draft: false });
                    current = out;
                }
                if (!out) { out = document.createElement("canvas"); out.width = w; out.height = Math.round((ph * w) / pw); out.getContext("2d")!.drawImage(img, 0, 0, out.width, out.height); }
                tiles.push({ cv: out, name: p.name });
            }
            const n = tiles.length, cols = n <= 3 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / cols);
            const cw = 760, chh = 820, cap = 54, gap = 24, pad = 32;
            const W = pad * 2 + cols * cw + (cols - 1) * gap, H = pad * 2 + rows * (chh + cap) + (rows - 1) * gap;
            const cv = document.createElement("canvas");
            cv.width = W; cv.height = H;
            const ctx = cv.getContext("2d")!;
            ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
            tiles.forEach((t, i) => {
                const cx = pad + (i % cols) * (cw + gap), cy = pad + Math.floor(i / cols) * (chh + cap + gap);
                ctx.fillStyle = "#f6f4ef"; ctx.fillRect(cx, cy, cw, chh);
                const k = Math.min(cw / t.cv.width, chh / t.cv.height);
                const dw = t.cv.width * k, dh = t.cv.height * k;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(t.cv, cx + (cw - dw) / 2, cy + (chh - dh) / 2, dw, dh);
                ctx.fillStyle = "#2b3a2f"; ctx.font = "600 26px sans-serif"; ctx.textAlign = "center";
                ctx.fillText(t.name.length > 38 ? t.name.slice(0, 36) + "…" : t.name, cx + cw / 2, cy + chh + 36);
            });
            setKitCanvas(cv);
            setKitUrl(cv.toDataURL("image/jpeg", 0.9));
        } catch {
            alert("Não foi possível montar o kit agora. Tente novamente.");
        } finally {
            setKitBusy(false);
        }
    };
    const downloadKit = () => {
        if (!kitCanvas) return;
        kitCanvas.toBlob((blob) => {
            if (!blob) return;
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "kit-personalizado.png";
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }, "image/png");
    };

    // ── resultado ───────────────────────────────────────────────────────────
    const generate = () => {
        if (!photo) return;
        setBusy(true);
        setTimeout(() => {
            try {
                const res = compose(Math.min(photo.naturalWidth, 2000), false);
                setResult(res);
                setResultUrl(res ? res.toDataURL("image/jpeg", 0.92) : "");
                setStep(4);
            } finally {
                setBusy(false);
            }
        }, 30);
    };

    const download = () => {
        if (!result || !product) return;
        try {
            result.toBlob((blob) => {
                if (!blob) { alert("Não foi possível gerar o PNG."); return; }
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `simulacao-${product.slug || "produto"}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            }, "image/png");
        } catch {
            alert("Não foi possível exportar a imagem (a foto do produto bloqueia a exportação).");
        }
    };

    const redo = () => {
        if (product && photo) initPlacements(product, photoUrl, art, photo);
        setStep(3);
    };

    const useOnOtherProduct = () => {
        setKitUrl(""); setKitCanvas(null);
        setResult(null);
        setProduct(null);
        setStep(1);
    };

    const quoteUrl = product
        ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
            `Olá! Fiz uma simulação de personalização no site da Ecosopis. 🌿\n\n*Produto:* ${product.name}\n*Arte:* ${art?.name || ""}\n*Quantidade aproximada:* \n*Empresa/Evento:* \n\nVou enviar a imagem da simulação em seguida.`
        )}`
        : "#";

    const canGo = (n: number) => (n === 1) || (n === 2 && !!product) || (n === 3 && !!product && !!art) || (n === 4 && !!result);

    // ── render ──────────────────────────────────────────────────────────────
    return (
        <main>
            <Header />
            <div className={styles.page}>
                <section className={styles.hero}>
                    <div className="container">
                        <Link href="/experiencias" className={styles.back}><ArrowLeft size={16} /> Experiências</Link>
                        <h1>Personalize seu Produto</h1>
                        <p>Visualize seus produtos com sua própria identidade visual antes de solicitar a produção.</p>
                    </div>
                </section>

                <div className="container">
                    <ol className={styles.stepper}>
                        {STEPS.map((label, i) => {
                            const n = i + 1;
                            return (
                                <li key={label} className={`${styles.stepItem} ${step === n ? styles.stepActive : ""} ${step > n ? styles.stepDone : ""}`}>
                                    <button type="button" disabled={!canGo(n)} onClick={() => setStep(n)}>
                                        <span className={styles.stepNum}>{step > n ? <Check size={14} /> : n}</span>
                                        <span className={styles.stepLabel}>{label}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>

                    {/* ───────── ETAPA 1 ───────── */}
                    {step === 1 && (
                        <section className={styles.panel}>
                            <h2>1. Escolha o produto</h2>
                            {art && (
                                <p className={styles.keepArt}><Sparkles size={16} /> Sua arte <strong>{art.name}</strong> será aplicada ao produto escolhido.</p>
                            )}
                            <div className={styles.toolbar}>
                                <label className={styles.search}>
                                    <Search size={18} />
                                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" />
                                </label>
                                <label className={styles.check}>
                                    <input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} /> Só com personalização disponível
                                </label>
                            </div>
                            <div className={styles.chips} role="tablist">
                                {categories.map((c) => (
                                    <button key={c} type="button" className={`${styles.chip} ${category === c ? styles.chipOn : ""}`} onClick={() => setCategory(c)}>{c}</button>
                                ))}
                            </div>

                            {notice && (
                                <div className={styles.notice} role="alert">
                                    <AlertCircle size={20} />
                                    <div>
                                        <strong>{notice.name}</strong> ainda não tem uma área de personalização configurada.
                                        <br />
                                        <small>Administrador: marque a área em <Link href="/admin/dashboard/personalizacao">Admin → Personalização</Link> para liberar este produto.</small>
                                    </div>
                                </div>
                            )}

                            {loadError && <p className={styles.error}>{loadError}</p>}
                            {!products && !loadError && <p className={styles.muted}>Carregando produtos…</p>}
                            {products && filtered.length === 0 && <p className={styles.muted}>Nenhum produto encontrado.</p>}
                            <div className={styles.grid}>
                                {filtered.map((p) => (
                                    <button key={p.id} type="button" className={`${styles.product} ${product?.id === p.id ? styles.productOn : ""}`} onClick={() => chooseProduct(p)}>
                                        <div className={styles.productImg}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={p.photos[0]} alt={p.name} loading="lazy" />
                                            <span className={`${styles.badge} ${p.customizable ? styles.badgeOk : styles.badgeOff}`}>
                                                {p.customizable ? "Personalização disponível" : "Em configuração"}
                                            </span>
                                        </div>
                                        <div className={styles.productInfo}>
                                            <span className={styles.cat}>{p.category || "Produto"}</span>
                                            <strong>{p.name}</strong>
                                            {p.description && <p>{p.description}</p>}
                                            <span className={styles.opt}><Palette size={14} /> {p.customizable ? "Pronto para personalizar" : "Aguardando configuração"}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ───────── ETAPA 2 ───────── */}
                    {step === 2 && product && (
                        <section className={styles.panel}>
                            <h2>2. Envie a sua arte</h2>
                            <p className={styles.muted}>Logotipo, identidade visual ou o rótulo completo. Formatos: PNG, JPG, SVG ou PDF. O arquivo fica só no seu navegador.</p>
                            <div className={styles.twoCols}>
                                <div
                                    className={`${styles.drop} ${dragOver ? styles.dropOver : ""}`}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
                                    onClick={() => fileRef.current?.click()}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
                                >
                                    <Upload size={34} />
                                    <strong>{artLoading ? "Lendo arquivo…" : "Arraste sua arte aqui ou clique para escolher"}</strong>
                                    <span>PNG · JPG · SVG · PDF (até 25 MB)</span>
                                    <input ref={fileRef} type="file" hidden accept=".png,.jpg,.jpeg,.svg,.pdf,image/png,image/jpeg,image/svg+xml,application/pdf" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
                                </div>
                                <div className={styles.artPreview}>
                                    {art ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={artPreview} alt="Prévia da arte" />
                                            <small>{art.name} · {art.canvas.width}×{art.canvas.height}px</small>
                                        </>
                                    ) : (
                                        <div className={styles.empty}><ImagePlus size={36} /><span>A prévia da sua arte aparece aqui</span></div>
                                    )}
                                </div>
                            </div>
                            {artError && <p className={styles.error} role="alert">{artError}</p>}
                            <div className={styles.actions}>
                                <button type="button" className={styles.btnGhost} onClick={() => setStep(1)}><ArrowLeft size={16} /> Trocar produto</button>
                                <button type="button" className={styles.btnPrimary} disabled={!art} onClick={() => setStep(3)}>Aplicar no produto <ArrowRight size={16} /></button>
                            </div>
                        </section>
                    )}

                    {/* ───────── ETAPA 3 ───────── */}
                    {step === 3 && product && (
                        <section className={styles.panel}>
                            <h2>3. Personalize: {product.name}</h2>
                            {photoError && <p className={styles.error}>{photoError}</p>}
                            <div className={styles.editor}>
                                <div className={styles.stage}>
                                    <div className={styles.canvasWrap} style={photo ? { aspectRatio: `${photo.naturalWidth} / ${photo.naturalHeight}`, width: `min(100%, calc(78vh * ${photo.naturalWidth / photo.naturalHeight}))` } : undefined}>
                                        <canvas
                                            ref={canvasRef}
                                            className={styles.canvas}
                                            onPointerDown={onPointerDown}
                                            onPointerMove={onPointerMove}
                                            onPointerUp={onPointerUp}
                                            onPointerCancel={onPointerUp}
                                            aria-label="Prévia do produto personalizado. Arraste para mover a arte."
                                        />
                                        {showArea && area && (
                                            <svg className={styles.areaSvg} viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                                                <polygon points={area.quad.map((p) => p.join(",")).join(" ")} vectorEffect="non-scaling-stroke" />
                                            </svg>
                                        )}
                                    </div>
                                    <p className={styles.hint}>Arraste a arte para mover · use a roda do mouse ou o gesto de pinça para o tamanho.</p>
                                    {photosWithAreas.length > 1 && (
                                        <div className={styles.thumbs}>
                                            {photosWithAreas.map((u) => (
                                                <button key={u} type="button" className={u === photoUrl ? styles.thumbOn : ""} onClick={() => changePhoto(u)} aria-label="Trocar fotografia">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={u} alt="" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <aside className={styles.controls}>
                                    <button type="button" className={styles.aiBtn} onClick={runAI} disabled={!art || !photo}>
                                        <Wand2 size={18} /> Ajuda da I.A.
                                        <small>Analisa sua logo e o produto e monta tudo sozinha</small>
                                    </button>
                                    {aiNotes.length > 0 && (
                                        <ul className={styles.aiNotes}>{aiNotes.map((n) => <li key={n}>{n}</li>)}</ul>
                                    )}
                                    {areasOnPhoto.length > 1 && (
                                        <div className={styles.areaPills}>
                                            <span className={styles.ctrlTitle}><Layers size={14} /> Áreas</span>
                                            {areasOnPhoto.map((a) => (
                                                <div key={a.id} className={`${styles.pill} ${a.id === areaId ? styles.pillOn : ""}`}>
                                                    <button type="button" onClick={() => setAreaId(a.id)}>{a.name}</button>
                                                    <label title="Aplicar a arte nesta área">
                                                        <input type="checkbox" checked={!!placements[a.id]?.enabled} onChange={(e) => setPlacements((p) => ({ ...p, [a.id]: { ...p[a.id], enabled: e.target.checked } }))} />
                                                        aplicar
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {curP && area && (
                                        <div className={styles.layerBox}>
                                            <span className={styles.ctrlTitle}><Layers size={14} /> O que você está movendo</span>
                                            <div className={styles.layerPills}>
                                                <button type="button" className={!activeLayer ? styles.pillOnBtn : ""} onClick={() => setActiveLayer(null)}>Minha arte</button>
                                                {curP.layers.map((l) => (
                                                    <span key={l.id} className={l.id === activeLayer ? styles.pillOnBtn : ""}>
                                                        <button type="button" onClick={() => setActiveLayer(l.id)}>{l.name}</button>
                                                        <button type="button" aria-label={`Remover ${l.name}`} onClick={() => removeLayer(l.id)}><Trash2 size={12} /></button>
                                                    </span>
                                                ))}
                                            </div>
                                            <div className={styles.rowBtns}>
                                                <button type="button" className={styles.btnGhost} onClick={openExtract}><Scissors size={14} /> Mover elementos do rótulo original</button>
                                            </div>
                                            <label className={styles.check}>
                                                <input type="checkbox" checked={curP.cover} onChange={(e) => setPlacements((p) => ({ ...p, [areaId as number]: { ...p[areaId as number], cover: e.target.checked } }))} />
                                                Esconder o rótulo original (a arte não mistura com ele)
                                            </label>
                                        </div>
                                    )}

                                    {cur && area && (
                                        <>
                                            <Slider label="Tamanho" min={0.05} max={1.6} step={0.01} value={cur.t.scale} onChange={(v) => updateT({ scale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
                                            <div className={styles.lockRow}>
                                                <button type="button" onClick={() => setLockRatio(!lockRatio)} className={styles.lockBtn}>
                                                    {lockRatio ? <Lock size={14} /> : <Unlock size={14} />} {lockRatio ? "Proporção travada" : "Proporção livre"}
                                                </button>
                                            </div>
                                            <Slider label="Largura" min={0.2} max={2.5} step={0.01} value={cur.t.sx} onChange={(v) => setSize("sx", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
                                            <Slider label="Altura" min={0.2} max={2.5} step={0.01} value={cur.t.sy} onChange={(v) => setSize("sy", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
                                            <Slider label="Rotação" min={-180} max={180} step={1} value={cur.t.rotation} onChange={(v) => updateT({ rotation: v })} fmt={(v) => `${Math.round(v)}°`} />
                                            <Slider label="Opacidade (100% = sólida)" min={0.05} max={1} step={0.01} value={cur.t.opacity} onChange={(v) => updateT({ opacity: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
                                            <Slider label="Perspectiva horizontal" min={-0.6} max={0.6} step={0.01} value={cur.t.perspX} onChange={(v) => updateT({ perspX: v })} fmt={(v) => v.toFixed(2)} />
                                            <Slider label="Perspectiva vertical" min={-0.6} max={0.6} step={0.01} value={cur.t.perspY} onChange={(v) => updateT({ perspY: v })} fmt={(v) => v.toFixed(2)} />
                                            <Slider label="Curvatura da superfície" min={0} max={1} step={0.01} value={cur.t.curvature} onChange={(v) => updateT({ curvature: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
                                            <div className={styles.rowBtns}>
                                                <button type="button" className={styles.btnGhost} onClick={() => product && photo && initPlacements(product, photoUrl, art, photo)}><RotateCcw size={14} /> Ajustar à área</button>
                                                <label className={styles.check}><input type="checkbox" checked={showArea} onChange={(e) => setShowArea(e.target.checked)} /> Mostrar área</label>
                                            </div>
                                        </>
                                    )}
                                </aside>
                            </div>
                            <div className={styles.actions}>
                                <button type="button" className={styles.btnGhost} onClick={() => setStep(2)}><ArrowLeft size={16} /> Trocar arte</button>
                                <button type="button" className={styles.btnPrimary} disabled={busy || !art || !photo} onClick={generate}>{busy ? "Gerando…" : "Gerar visualização"} <Eye size={16} /></button>
                            </div>
                        </section>
                    )}

                    {/* ───────── ETAPA 4 ───────── */}
                    {step === 4 && product && result && (
                        <section className={styles.panel}>
                            <h2>4. Sua simulação</h2>
                            <div className={styles.compare} style={{ ["--pos" as any]: `${compare}%`, aspectRatio: `${result.width} / ${result.height}` }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img className={styles.cmpAfter} src={resultUrl} alt="Produto personalizado" />
                                <div className={styles.cmpBeforeWrap}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img className={styles.cmpBefore} src={photoUrl} alt="Produto original" />
                                </div>
                                <span className={`${styles.tag} ${styles.tagL}`}>Original</span>
                                <span className={`${styles.tag} ${styles.tagR}`}>Personalizado</span>
                                <div className={styles.cmpHandle} />
                                <input type="range" min={0} max={100} value={compare} onChange={(e) => setCompare(+e.target.value)} className={styles.cmpRange} aria-label="Comparar original e personalizado" />
                            </div>
                            <div className={styles.resultBtns}>
                                <button type="button" className={styles.btnPrimary} onClick={download}><Download size={16} /> Baixar PNG</button>
                                <button type="button" className={styles.btnGhost} onClick={() => setZoom(true)}><Maximize2 size={16} /> Ver ampliado</button>
                                <button type="button" className={styles.btnGhost} onClick={redo}><RotateCcw size={16} /> Refazer</button>
                                <a className={styles.btnWhats} href={quoteUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Solicitar orçamento</a>
                            </div>
                            <div className={styles.kitBox}>
                                <h3>Montar um kit com vários produtos</h3>
                                <p>Escolha os produtos (inclui sacolas e embalagens) e geramos <strong>uma única imagem</strong> com todos personalizados com a sua arte.</p>
                                <div className={styles.kitGrid}>
                                    {(products || []).filter((p) => p.id !== product.id && p.customizable).map((p) => (
                                        <label key={p.id} className={`${styles.kitItem} ${kitSel.includes(p.id) ? styles.kitOn : ""}`}>
                                            <input type="checkbox" checked={kitSel.includes(p.id)} onChange={() => toggleKit(p.id)} />
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={p.photos[0]} alt="" loading="lazy" />
                                            <span>{p.name}</span>
                                            {p.category === "Embalagens" && <em>sacola / embalagem</em>}
                                        </label>
                                    ))}
                                </div>
                                <button type="button" className={styles.btnPrimary} disabled={kitBusy || kitSel.length === 0} onClick={buildKit}>
                                    <Layers size={16} /> {kitBusy ? "Montando o kit…" : `Gerar imagem do kit (${kitSel.length + 1} produtos)`}
                                </button>
                                {kitUrl && (
                                    <div className={styles.kitResult}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={kitUrl} alt="Kit personalizado" />
                                        <button type="button" className={styles.btnPrimary} onClick={downloadKit}><Download size={16} /> Baixar imagem do kit (PNG)</button>
                                    </div>
                                )}
                            </div>
                            <div className={styles.again}>
                                <p>Gostou? Aplique a mesma identidade visual em outros produtos.</p>
                                <button type="button" className={styles.btnLight} onClick={useOnOtherProduct}><Layers size={16} /> Escolher outro produto</button>
                            </div>
                            <p className={styles.muted}>Simulação ilustrativa: o resultado final pode variar levemente conforme o processo de produção. Baixe a imagem e envie junto com o pedido de orçamento.</p>
                        </section>
                    )}
                </div>
            </div>

            {extract && (
                <div className={styles.modal} role="dialog" aria-modal="true">
                    <div className={styles.exBox} onClick={(e) => e.stopPropagation()}>
                        <button type="button" className={styles.exClose} aria-label="Fechar" onClick={() => setExtract(null)}><X size={20} /></button>
                        <h3>Mover elementos do rótulo original</h3>
                        <p>Arraste sobre a imagem para selecionar o elemento que quer reaproveitar (logo, texto, desenho). Ele vira uma peça que você move, aumenta e gira; o rótulo antigo é escondido.</p>
                        <div ref={extractRef} className={styles.exStage} style={{ aspectRatio: `${extract.canvas.width} / ${extract.canvas.height}`, width: `min(100%, calc(46vh * ${extract.canvas.width / extract.canvas.height}))` }}
                            onPointerDown={exDown} onPointerMove={exMove} onPointerUp={exUp} onPointerCancel={exUp}>
                            <canvas ref={exCanvasRef} />
                            <div className={styles.exRect} style={{ left: `${extract.rect[0] * 100}%`, top: `${extract.rect[1] * 100}%`, width: `${(extract.rect[2] - extract.rect[0]) * 100}%`, height: `${(extract.rect[3] - extract.rect[1]) * 100}%` }} />
                        </div>
                        <Slider label="Remover o fundo do recorte" min={0} max={1} step={0.01} value={extract.tol} onChange={(v) => setExtract({ ...extract, tol: v })} fmt={(v) => (v < 0.02 ? "mantém fundo" : `${Math.round(v * 100)}%`)} />
                        <div className={styles.rowBtns}>
                            <button type="button" className={styles.btnGhost} onClick={() => setExtract(null)}>Cancelar</button>
                            <button type="button" className={styles.btnPrimary} onClick={confirmExtract}><Scissors size={16} /> Usar como elemento móvel</button>
                        </div>
                    </div>
                </div>
            )}

            {zoom && result && (
                <div className={styles.modal} role="dialog" aria-modal="true" onClick={() => setZoom(false)}>
                    <button type="button" className={styles.modalClose} aria-label="Fechar"><X size={22} /></button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultUrl} alt="Simulação ampliada" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
            <Footer />
        </main>
    );
}

function Slider({ label, min, max, step, value, onChange, fmt }: {
    label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; fmt: (v: number) => string;
}) {
    return (
        <label className={styles.slider}>
            <span><em>{label}</em><b>{fmt(value)}</b></span>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
        </label>
    );
}
