'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './VerifyEmail.module.css';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token de verificação ausente.');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/verify?token=${token}`);
        const data = await res.json();

        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'E-mail verificado com sucesso!');
        } else {
          setStatus('error');
          setMessage(data.detail || 'Ocorreu um erro ao verificar seu e-mail.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Erro de conexão com o servidor.');
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Verificação de E-mail</h1>
        
        {status === 'loading' && (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Verificando sua conta...</p>
          </div>
        )}

        {status === 'success' && (
          <div className={styles.success}>
            <div className={styles.icon}>✅</div>
            <p>{message}</p>
            <Link href="/conta" className={styles.button}>
              Ir para o Login
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className={styles.error}>
            <div className={styles.icon}>❌</div>
            <p>{message}</p>
            <Link href="/conta" className={styles.buttonSecondary}>
              Tentar Novamente
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
