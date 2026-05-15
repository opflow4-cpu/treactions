'use client';
import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, User, Lock, ChevronRight, Shield } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [clock, setClock]       = useState('');

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toUTCString().replace('GMT', 'UTC'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) { window.location.href = '/'; return; }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Credenciais inválidas.');
    } catch {
      setError('Falha na conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#020710', padding: 16,
      backgroundImage: `
        linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)
      `,
      backgroundSize: '48px 48px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Ambient glows */}
      <div style={{ position: 'absolute', top: '-15%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,100,255,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '20%', width: 400, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(120,0,200,0.05) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* Scan line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)',
        animation: 'scan-line 6s linear infinite',
        pointerEvents: 'none',
      }} />

      {/* Corner decorations */}
      {(['tl','tr','bl','br'] as const).map((corner) => (
        <div key={corner} style={{
          position: 'absolute',
          top:    corner.startsWith('t') ? 20 : 'auto',
          bottom: corner.startsWith('b') ? 20 : 'auto',
          left:   corner.endsWith('l')   ? 20 : 'auto',
          right:  corner.endsWith('r')   ? 20 : 'auto',
          width: 24, height: 24,
          borderTop:    corner.startsWith('t') ? '1px solid rgba(0,212,255,0.2)' : 'none',
          borderBottom: corner.startsWith('b') ? '1px solid rgba(0,212,255,0.2)' : 'none',
          borderLeft:   corner.endsWith('l')   ? '1px solid rgba(0,212,255,0.2)' : 'none',
          borderRight:  corner.endsWith('r')   ? '1px solid rgba(0,212,255,0.2)' : 'none',
        }} />
      ))}

      {/* System clock */}
      {clock && (
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(0,212,255,0.2)',
          letterSpacing: '0.1em', whiteSpace: 'nowrap',
        }}>
          {clock}
        </div>
      )}

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%', maxWidth: 400,
          background: 'rgba(4, 10, 26, 0.92)',
          border: '1px solid rgba(0,212,255,0.16)',
          borderRadius: 20,
          padding: '40px 36px',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 0 80px rgba(0,212,255,0.07), 0 24px 60px rgba(0,0,0,0.7)',
          position: 'relative',
        }}
      >
        {/* Top border glow */}
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)',
        }} />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
              background: 'rgba(0,212,255,0.08)',
              border: '1px solid rgba(0,212,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 30px rgba(0,212,255,0.15)',
            }}
          >
            <Zap size={24} color="#00d4ff" />
          </motion.div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
            <Shield size={11} color="rgba(0,212,255,0.4)" />
            <span style={{ fontSize: 10, color: 'rgba(0,212,255,0.4)', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
              Acesso Restrito
            </span>
          </div>

          <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            TReactions
          </h1>
          <p style={{ color: '#1e3a5f', fontSize: 12, margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Sistema de Automação
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Username */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#1e3a5f', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 7 }}>
                Usuário
              </label>
              <div style={{ position: 'relative' }}>
                <User size={14} color="#1e3a5f" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="admin"
                  className="input-hud"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#1e3a5f', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 7 }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} color="#1e3a5f" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  className="input-hud"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    background: 'rgba(239,68,68,0.07)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 9, padding: '9px 14px',
                    fontSize: 12, color: '#f87171',
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              style={{
                marginTop: 6, width: '100%', padding: '12px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 13, fontWeight: 600, letterSpacing: '0.06em',
                borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
                border: '1px solid rgba(0,212,255,0.4)',
                background: loading ? 'rgba(0,212,255,0.04)' : 'rgba(0,212,255,0.1)',
                color: loading ? 'rgba(0,212,255,0.4)' : '#00d4ff',
                boxShadow: loading ? 'none' : '0 0 20px rgba(0,212,255,0.1)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(0,212,255,0.2)', borderTopColor: '#00d4ff' }}
                  />
                  Autenticando…
                </>
              ) : (
                <>
                  Acessar Sistema
                  <ChevronRight size={15} />
                </>
              )}
            </motion.button>
          </div>
        </form>

        {/* Bottom decoration */}
        <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(0,212,255,0.06)' }} />
          <span style={{ fontSize: 9, color: '#0f2440', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Protocolo seguro · HMAC-SHA256
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(0,212,255,0.06)' }} />
        </div>
      </motion.div>
    </div>
  );
}
