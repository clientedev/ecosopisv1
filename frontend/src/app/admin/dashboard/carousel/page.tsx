"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../dashboard.module.css";
import EditCarouselModal from "./EditCarouselModal";

export default function CarouselAdmin() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const router = useRouter();

    const fetchItems = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
            const res = await fetch(`${apiUrl}/carousel/`);
            const data = await res.json();
            setItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching carousel items:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/admin");
            return;
        }
        fetchItems();
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        router.push("/admin");
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este slide?")) return;
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/carousel/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            setItems(items.filter(i => i.id !== id));
        } catch (error) {
            console.error("Error deleting item:", error);
        }
    };

    return (
        <div className={styles.dashboard}>
            <aside className={styles.sidebar}>
                <div className={styles.logo}>ECOSOPIS ADMIN</div>
                <nav>
                    <Link href="/admin/dashboard">Produtos</Link>
                    <Link href="/admin/dashboard/carousel" className={styles.active}>Carrossel Hero</Link>
                    <Link href="/admin/dashboard/usuarios">Usuários</Link>
                    <Link href="/admin/dashboard/cupons">Cupons</Link>
                    <Link href="/">Ver Site</Link>
                    <button onClick={handleLogout} className={styles.logoutBtn}>Sair</button>
                </nav>
            </aside>
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <h1>Gerenciar Carrossel Hero</h1>
                    <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>+ Novo Slide</button>
                </header>

                <div className={styles.productTable}>
                    <table>
                        <thead>
                            <tr>
                                <th>Imagem</th>
                                <th>Título</th>
                                <th>Badge</th>
                                <th>Ordem</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item: any) => (
                                <tr key={item.id}>
                                    <td>
                                        <img src={item.image_url || "/placeholder.png"} alt={item.title} className={styles.productThumb} />
                                    </td>
                                    <td><strong>{item.title}</strong></td>
                                    <td>{item.badge}</td>
                                    <td>{item.order}</td>
                                    <td>
                                        <div className={styles.actions}>
                                            <button className={styles.editBtn} onClick={() => setEditingItem(item)}>Editar</button>
                                            <button className={styles.deleteBtn} onClick={() => handleDelete(item.id)}>Excluir</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {(editingItem || isCreateModalOpen) && (
                    <EditCarouselModal 
                        item={editingItem} 
                        onClose={() => {
                            setEditingItem(null);
                            setIsCreateModalOpen(false);
                        }}
                        onSave={() => fetchItems()}
                    />
                )}
            </main>
        </div>
    );
}
