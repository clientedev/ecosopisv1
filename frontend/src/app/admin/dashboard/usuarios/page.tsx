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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
            const res = await fetch(`${apiUrl}/api/auth/users`, {
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
            const res = await fetch(`${apiUrl}/api/auth/users/${userId}/promote`, {
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
            const res = await fetch(`${apiUrl}/api/auth/users/${userId}`, {
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

    return (
        <div className={styles.dashboard}>
            <AdminSidebar activePath="/admin/dashboard/usuarios" />
            <main className={styles.mainContent}>
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
                                <th>Cargo</th>
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
                                        <span className={`${styles.stockBadge} ${user.role === 'admin' ? styles.stockOk : styles.editBtn}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td>{new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
                                    <td>
                                        <div className={styles.actions}>
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
                                                Remover
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
