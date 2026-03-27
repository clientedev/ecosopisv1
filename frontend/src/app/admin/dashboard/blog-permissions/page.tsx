"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";

interface User {
    id: number;
    email: string;
    full_name: string;
    role: string;
    can_post_news: boolean;
    created_at: string;
}

export default function BlogPermissions() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<number | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
    const router = useRouter();

    const token = () => localStorage.getItem("token") || "";

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/auth/users", {
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (res.status === 401 || res.status === 403) {
                router.push("/admin");
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (e) {
            console.error("Error fetching users", e);
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = async (user: User) => {
        setToggling(user.id);
        try {
            const res = await fetch(`/api/auth/users/${user.id}/blog-permission`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(prev => prev.map(u =>
                    u.id === user.id ? { ...u, can_post_news: data.can_post_news } : u
                ));
                showToast(
                    data.can_post_news
                        ? `✅ ${user.full_name} agora pode postar no blog`
                        : `🚫 Permissão removida de ${user.full_name}`,
                    "success"
                );
            } else {
                const err = await res.json();
                showToast(err.detail || "Erro ao alterar permissão", "error");
            }
        } catch (e) {
            showToast("Erro de conexão", "error");
        } finally {
            setToggling(null);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem("token")) {
            router.push("/admin");
            return;
        }
        fetchUsers();
    }, [router]);

    const clientUsers = users.filter(u => u.role !== "admin");
    const admins = users.filter(u => u.role === "admin");

    return (
        <div className={styles.dashboard} style={{ height: '100vh', overflow: 'hidden', display: 'flex' }}>
            <AdminSidebar activePath="/admin/dashboard/blog-permissions" />
            <main className={styles.mainContent} style={{ flex: 1, overflowY: 'auto' }}>
                <header className={styles.header}>
                    <h1>Permissões de Blog</h1>
                    <p style={{ color: "#888", fontWeight: 400, fontSize: "0.95rem", marginTop: 4 }}>
                        Gerencie quem pode criar postagens no blog de novidades.
                    </p>
                </header>

                {/* Toast */}
                {toast && (
                    <div style={{
                        position: "fixed", top: 20, right: 20, zIndex: 9999,
                        background: toast.type === "success" ? "#2d5a27" : "#c0392b",
                        color: "#fff", padding: "14px 24px", borderRadius: 10,
                        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                        fontWeight: 600, fontSize: "0.95rem",
                        animation: "slideIn 0.3s ease"
                    }}>
                        {toast.msg}
                    </div>
                )}

                {/* Stats */}
                <div className={styles.stats}>
                    <div className={styles.statCard}>
                        <h3>Total de Usuários</h3>
                        <p>{users.length}</p>
                    </div>
                    <div className={styles.statCard}>
                        <h3>Com Acesso ao Blog</h3>
                        <p style={{ color: "#2d5a27" }}>
                            {admins.length + clientUsers.filter(u => u.can_post_news).length}
                        </p>
                    </div>
                    <div className={styles.statCard}>
                        <h3>Sem Acesso</h3>
                        <p style={{ color: "#e74c3c" }}>
                            {clientUsers.filter(u => !u.can_post_news).length}
                        </p>
                    </div>
                </div>

                {/* How it works */}
                <div style={{
                    background: "linear-gradient(135deg, #e8f5e9, #f0f9f0)",
                    borderRadius: 12, padding: "16px 20px",
                    border: "1px solid #c8e6c9", marginBottom: 24
                }}>
                    <p style={{ margin: 0, color: "#2d5a27", fontSize: "0.9rem" }}>
                        💡 <strong>Como funciona:</strong> Administradores sempre podem postar.
                        Para clientes, clique em <strong>Liberar Acesso</strong> para permitir que criem postagens no blog de novidades.
                        Clique novamente para revogar o acesso.
                    </p>
                </div>

                {/* Admins */}
                <h2 style={{ color: "#2d5a27", marginBottom: 12, fontSize: "1.1rem" }}>
                    Administradores
                </h2>
                <div className={styles.productTable} style={{ marginBottom: 32 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Email</th>
                                <th>Status Blog</th>
                            </tr>
                        </thead>
                        <tbody>
                            {admins.map(user => (
                                <tr key={user.id}>
                                    <td><strong>{user.full_name}</strong></td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span className={styles.stockBadge} style={{ background: "#2d5a27", color: "#fff", padding: "4px 14px", borderRadius: 20 }}>
                                            ✅ Acesso Total
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Clients */}
                <h2 style={{ color: "#2d5a27", marginBottom: 12, fontSize: "1.1rem" }}>
                    Clientes — Permissões de Blog
                </h2>
                <div className={styles.productTable}>
                    {loading ? (
                        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>Carregando...</div>
                    ) : clientUsers.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
                            Nenhum cliente cadastrado ainda.
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Email</th>
                                    <th>Cadastro</th>
                                    <th>Status Blog</th>
                                    <th>Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clientUsers.map(user => (
                                    <tr key={user.id}>
                                        <td><strong>{user.full_name}</strong></td>
                                        <td>{user.email}</td>
                                        <td style={{ color: "#888" }}>
                                            {new Date(user.created_at).toLocaleDateString("pt-BR")}
                                        </td>
                                        <td>
                                            {user.can_post_news ? (
                                                <span style={{
                                                    background: "#e8f5e9", color: "#2d5a27",
                                                    padding: "4px 14px", borderRadius: 20,
                                                    fontWeight: 600, fontSize: "0.85rem"
                                                }}>
                                                    ✅ Pode Postar
                                                </span>
                                            ) : (
                                                <span style={{
                                                    background: "#fdecea", color: "#c0392b",
                                                    padding: "4px 14px", borderRadius: 20,
                                                    fontWeight: 600, fontSize: "0.85rem"
                                                }}>
                                                    🚫 Sem Acesso
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => togglePermission(user)}
                                                disabled={toggling === user.id}
                                                style={{
                                                    background: user.can_post_news ? "#e74c3c" : "#2d5a27",
                                                    color: "#fff", border: "none",
                                                    padding: "8px 18px", borderRadius: 8,
                                                    cursor: toggling === user.id ? "not-allowed" : "pointer",
                                                    fontWeight: 600, fontSize: "0.85rem",
                                                    opacity: toggling === user.id ? 0.7 : 1,
                                                    transition: "all 0.2s"
                                                }}
                                            >
                                                {toggling === user.id
                                                    ? "..."
                                                    : user.can_post_news
                                                        ? "Revogar Acesso"
                                                        : "Liberar Acesso"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>
        </div>
    );
}
