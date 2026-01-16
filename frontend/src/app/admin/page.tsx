"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function AdminLoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}`;
            const formData = new FormData();
            formData.append("username", email);
            formData.append("password", password);

            const res = await fetch(`${apiUrl}/api/auth/login`, {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem("token", data.access_token);
                router.push("/admin/dashboard");
            } else {
                setError("Credenciais inválidas");
            }
        } catch (err) {
            setError("Erro ao conectar com o servidor");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.loginBox}>
                <h1>Painel Administrativo</h1>
                <form onSubmit={handleLogin}>
                    <div className={styles.inputGroup}>
                        <label>E-mail</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                            placeholder="admin@admin.com"
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>Senha</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                            placeholder="admin123"
                        />
                    </div>
                    {error && <p className={styles.error}>{error}</p>}
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? "Entrando..." : "Entrar"}
                    </button>
                </form>
            </div>
        </div>
    );
}
