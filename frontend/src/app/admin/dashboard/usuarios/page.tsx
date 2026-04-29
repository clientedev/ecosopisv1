"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../dashboard.module.css";

import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/auth/users`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            } else if (res.status === 401 || res.status === 403) {
                router.push("/admin");
            }
        } catch (error) {
            console.error("Error fetching users:", error);
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
        fetchUsers();
    }, [router]);

    const handlePromoteUser = async (userId: number) => {
        if (!confirm("Tem certeza que deseja promover este usuário a administrador?")) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/auth/users/${userId}/promote`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                alert("Usuário promovido com sucesso!");
                fetchUsers();
            } else {
                const error = await res.json();
                alert(error.detail || "Erro ao promover usuário");
            }
        } catch (error) {
            console.error("Error promoting user:", error);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!confirm("Tem certeza que deseja remover este usuário?")) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/auth/users/${userId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                setUsers(users.filter((u: any) => u.id !== userId));
            } else {
                const error = await res.json();
                alert(error.detail || "Erro ao deletar usuário");
            }
        } catch (error) {
            console.error("Error deleting user:", error);
        }
    };

    const handleToggleRoulette = async (userId: number) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/auth/users/${userId}/toggle-roulette`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                fetchUsers();
            } else {
                const error = await res.json();
                alert(error.detail || "Erro ao alterar permissão da roleta");
            }
        } catch (error) {
            console.error("Error toggling roulette:", error);
        }
    };

    return (
        <div className={styles.dashboard} style={{ height: '100vh', overflow: 'hidden', display: 'flex' }}>
            <AdminSidebar activePath="/admin/dashboard/usuarios" />
            <main className={styles.mainContent} style={{ flex: 1, overflowY: 'auto' }}>
                <header className={styles.header}>
                    <h1>Gerenciar Usuários</h1>
                </header>

                <div className={styles.stats}>
                    <div className={styles.statCard}>
                        <h3>Total de Clientes</h3>
                        <p>{users.length}</p>
                    </div>
                </div>

                <div className={styles.productTable}>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nome</th>
                                <th>Email</th>
                                <th>WhatsApp</th>
                                <th>Cargo</th>
                                <th>Roleta</th>
                                <th>Data Cadastro</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user: any) => (
                                <tr key={user.id}>
                                    <td>{user.id}</td>
                                    <td><strong>{user.full_name}</strong></td>
                                    <td>{user.email}</td>
                                    <td>
                                        {user.phone ? (
                                            <a 
                                                href={`https://wa.me/${user.phone.replace(/\D/g, '')}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '5px', 
                                                    color: '#25D366', 
                                                    fontWeight: 'bold',
                                                    textDecoration: 'none'
                                                }}
                                            >
                                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.393 0 12.03c0 2.123.544 4.197 1.582 6.033L0 24l6.105-1.602a11.83 11.83 0 005.937 1.598h.005c6.637 0 12.032-5.395 12.034-12.03a11.83 11.83 0 00-3.489-8.452z"/>
                                                </svg>
                                                {user.phone}
                                            </a>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`${styles.stockBadge} ${user.role === 'admin' ? styles.stockOk : styles.editBtn}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`${styles.stockBadge} ${user.pode_girar_roleta ? styles.stockOk : styles.deleteBtn}`} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                            {user.pode_girar_roleta ? "DISPONÍVEL" : "BLOQUEADO"}
                                        </span>
                                    </td>
                                    <td>{new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
                                    <td>
                                        <div className={styles.actions}>
                                            <button
                                                className={styles.editBtn}
                                                onClick={() => handleToggleRoulette(user.id)}
                                                style={{ backgroundColor: user.pode_girar_roleta ? '#ef4444' : '#b8860b', color: 'white' }}
                                            >
                                                {user.pode_girar_roleta ? "Remover Giro" : "Liberar Giro"}
                                            </button>
                                            {user.role !== 'admin' && (
                                                <button
                                                    className={styles.editBtn}
                                                    onClick={() => handlePromoteUser(user.id)}
                                                    style={{ backgroundColor: '#2d5a27', color: 'white' }}
                                                >
                                                    Promover
                                                </button>
                                            )}
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => handleDeleteUser(user.id)}
                                            >
                                                Remover User
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
