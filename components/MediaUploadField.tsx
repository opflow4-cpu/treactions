'use client';
import { useRef, useState } from 'react';

export type MediaKind = 'image' | 'video' | 'audio' | 'file';

// Cloudinary unsigned uploads require resource-type specific endpoints.
// /auto/upload only works with signed (API-key) requests.
const KIND_CONFIG = {
  image: { accept: 'image/jpeg,image/png,image/gif,image/webp', maxMb: 10,  endpoint: 'image', icon: '🖼️', hint: 'JPG, PNG, GIF, WebP · máx 10 MB' },
  video: { accept: 'video/mp4,video/quicktime,video/webm',      maxMb: 100, endpoint: 'video', icon: '🎬', hint: 'MP4, MOV, WebM · máx 100 MB' },
  audio: { accept: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a', maxMb: 20, endpoint: 'video', icon: '🎵', hint: 'MP3, WAV, OGG, M4A · máx 20 MB' },
  file:  { accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv',  maxMb: 50, endpoint: 'raw',   icon: '📎', hint: 'PDF, DOC, XLS, ZIP, TXT · máx 50 MB' },
} as const;

interface Props {
  kind: MediaKind;
  url: string;
  caption?: string;
  onUrlChange: (url: string) => void;
  onCaptionChange?: (caption: string) => void;
}

export default function MediaUploadField({ kind, url, caption, onUrlChange, onCaptionChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');
  const [dragOver, setDragOver]   = useState(false);
  const [debugLog, setDebugLog]   = useState<{
    cloudName: string | undefined;
    preset: string | undefined;
    endpoint: string;
    formDataKeys: string[];
    formDataValues: Record<string, string>;
    status: string;
    response: string | null;
  } | null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset    = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const cfg       = KIND_CONFIG[kind];
  const configured = !!(cloudName && preset);

  function validate(file: File): string | null {
    const maxBytes = cfg.maxMb * 1024 * 1024;
    if (file.size > maxBytes)
      return `Arquivo muito grande. Máximo: ${cfg.maxMb} MB (atual: ${(file.size / 1024 / 1024).toFixed(1)} MB)`;
    if (kind === 'image' && !file.type.startsWith('image/'))
      return 'Formato inválido. Use JPG, PNG, GIF ou WebP.';
    if (kind === 'video' && !file.type.startsWith('video/'))
      return 'Formato inválido. Use MP4, MOV ou WebM.';
    if (kind === 'audio' && !file.type.startsWith('audio/'))
      return 'Formato inválido. Use MP3, WAV, OGG ou M4A.';
    return null;
  }

  async function doUpload(file: File) {
    const validationErr = validate(file);
    if (validationErr) { setError(validationErr); return; }

    setError('');
    setUploading(true);
    setDebugLog(null);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${cfg.endpoint}/upload`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', preset!);

    // Confirm exactly what is being sent — must be ONLY these two keys
    const fdKeys = [...formData.keys()];
    const fdEntries: Record<string, string> = {};
    for (const [k, v] of formData.entries()) {
      fdEntries[k] = v instanceof File ? `[File: ${v.name} ${v.type} ${(v.size/1024).toFixed(1)}KB]` : String(v);
    }

    const debugInfo = {
      cloudName,
      preset,
      endpoint: uploadUrl,
      formDataKeys: fdKeys,
      formDataValues: fdEntries,
    };

    console.group('[MediaUpload] DEBUG');
    console.log('cloudName     :', cloudName);
    console.log('preset        :', preset);
    console.log('endpoint      :', uploadUrl);
    console.log('FormData keys :', fdKeys);
    console.log('FormData entries:', fdEntries);
    console.groupEnd();

    setDebugLog({ ...debugInfo, status: 'sending…', response: null });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      const rawText = await res.text();
      console.log('[MediaUpload] HTTP status :', res.status);
      console.log('[MediaUpload] raw response:', rawText);

      let data: { secure_url?: string; error?: { message: string } };
      try { data = JSON.parse(rawText); } catch { data = {}; }

      setDebugLog((d) => d ? { ...d, status: `HTTP ${res.status}`, response: rawText } : d);

      if (!res.ok) {
        setError(data.error?.message ?? `Erro ${res.status} — veja o console para detalhes`);
        return;
      }

      if (!data.secure_url) {
        setError('Cloudinary não retornou secure_url. Veja console.');
        return;
      }

      onUrlChange(data.secure_url);
      setDebugLog(null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.error('[MediaUpload] fetch error:', err);
      setError('Falha na conexão. Verifique sua internet.');
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    doUpload(files[0]);
  };

  const cancel = () => abortRef.current?.abort();
  const clear  = () => { onUrlChange(''); setError(''); };

  const filename = url
    ? decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '')
    : '';

  return (
    <div className="space-y-3">

      {/* Uploading indicator ──────────────────────────────────────────── */}
      {uploading && (
        <div
          className="rounded-xl px-3 py-3"
          style={{ border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-indigo-300 font-medium">Enviando…</span>
            <button
              type="button"
              onClick={cancel}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
          {/* Indeterminate bar — fetch doesn't expose upload bytes */}
          <div
            className="rounded-full overflow-hidden"
            style={{ height: 4, background: 'rgba(255,255,255,0.07)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: '40%',
                background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                animation: 'mediaUploadSlide 1.2s ease-in-out infinite alternate',
              }}
            />
          </div>
          <style>{`
            @keyframes mediaUploadSlide {
              from { margin-left: 0%; }
              to   { margin-left: 60%; }
            }
          `}</style>
        </div>
      )}

      {/* Preview ──────────────────────────────────────────────────────── */}
      {url && !uploading && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.02)' }}
        >
          {kind === 'image' && (
            <img
              src={url}
              alt="preview"
              style={{ display: 'block', width: '100%', maxHeight: 140, objectFit: 'cover' }}
            />
          )}
          {kind === 'video' && (
            <video
              src={url}
              controls
              style={{ display: 'block', width: '100%', maxHeight: 140, background: '#000' }}
            />
          )}
          {kind === 'audio' && (
            <div className="p-3">
              <audio
                src={url}
                controls
                style={{ width: '100%', filter: 'invert(0.8) hue-rotate(180deg)' }}
              />
            </div>
          )}
          {kind === 'file' && (
            <div className="flex items-center gap-3 px-3 py-3">
              <span style={{ fontSize: 26 }}>📎</span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-300 truncate flex-1 hover:underline"
              >
                {filename || 'Abrir arquivo'}
              </a>
            </div>
          )}
          <div
            className="flex items-center gap-3 px-3 py-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Trocar arquivo
            </button>
            <span className="text-gray-700 text-xs">·</span>
            <button
              type="button"
              onClick={clear}
              className="text-xs text-red-500 hover:text-red-400 transition-colors"
            >
              Remover
            </button>
          </div>
        </div>
      )}

      {/* Drop zone ────────────────────────────────────────────────────── */}
      {!url && !uploading && (
        configured ? (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all select-none"
            style={{
              border: `2px dashed ${dragOver ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.1)'}`,
              background: dragOver ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.015)',
              padding: '22px 16px',
              outline: 'none',
            }}
          >
            <span style={{ fontSize: 30, lineHeight: 1 }}>{cfg.icon}</span>
            <div className="text-center">
              <p className="text-sm text-gray-400">
                Arraste ou{' '}
                <span className="text-indigo-400 underline underline-offset-2">escolha do PC</span>
              </p>
              <p className="text-xs text-gray-600 mt-0.5">{cfg.hint}</p>
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl px-4 py-4 text-center space-y-1.5"
            style={{ border: '1px dashed rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.04)' }}
          >
            <p className="text-xs font-semibold text-amber-400">Upload não configurado</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Adicione{' '}
              <code className="text-amber-300 font-mono">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code>
              {' '}e{' '}
              <code className="text-amber-300 font-mono">NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code>
              {' '}no arquivo{' '}
              <code className="text-amber-300 font-mono">.env.local</code>
            </p>
          </div>
        )
      )}

      {/* Error ────────────────────────────────────────────────────────── */}
      {error && (
        <p
          className="text-xs text-red-400 rounded-lg px-3 py-2"
          style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.05)' }}
        >
          ✗ {error}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept={cfg.accept}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
      />

      {/* Manual URL ───────────────────────────────────────────────────── */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">
          {url ? 'URL do arquivo' : 'Ou cole a URL manualmente'}
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => { onUrlChange(e.target.value); setError(''); }}
          placeholder="https://…"
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500/60"
        />
      </div>

      {/* Caption ──────────────────────────────────────────────────────── */}
      {onCaptionChange !== undefined && (
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Legenda (opcional)</label>
          <input
            type="text"
            value={caption ?? ''}
            onChange={(e) => onCaptionChange(e.target.value)}
            placeholder="Legenda da mídia…"
            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/60"
          />
        </div>
      )}

      {/* DEBUG panel ──────────────────────────────────────────────────── */}
      <details
        open
        className="rounded-lg overflow-hidden text-[10px] font-mono"
        style={{ border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(10,12,22,0.8)' }}
      >
        <summary className="px-3 py-1.5 cursor-pointer text-indigo-400 select-none">
          🔍 DEBUG — Cloudinary config
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-1 text-gray-400 leading-relaxed">
          <div>
            <span className="text-gray-600">cloudName  : </span>
            <span className={cloudName ? 'text-emerald-400' : 'text-red-400'}>
              {cloudName ?? '⚠ undefined (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME não carregado)'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">preset     : </span>
            <span className={preset ? 'text-emerald-400' : 'text-red-400'}>
              {preset ?? '⚠ undefined (NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET não carregado)'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">endpoint   : </span>
            <span className="text-blue-300">
              {cloudName
                ? `https://api.cloudinary.com/v1_1/${cloudName}/${cfg.endpoint}/upload`
                : '(aguardando cloudName)'}
            </span>
          </div>

          {debugLog && (
            <>
              <div className="mt-1 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-gray-600">status     : </span>
                <span className={debugLog.status.includes('200') ? 'text-emerald-400' : 'text-yellow-400'}>
                  {debugLog.status}
                </span>
              </div>
              <div>
                <span className="text-gray-600">fd keys    : </span>
                <span className={
                  JSON.stringify(debugLog.formDataKeys) === '["file","upload_preset"]'
                    ? 'text-emerald-400' : 'text-red-400'
                }>
                  {JSON.stringify(debugLog.formDataKeys)}
                </span>
              </div>
              {debugLog.response && (
                <div className="mt-1">
                  <span className="text-gray-600">response   :</span>
                  <pre
                    className="mt-1 text-red-300 whitespace-pre-wrap break-all"
                    style={{ maxHeight: 120, overflowY: 'auto' }}
                  >
                    {debugLog.response}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </details>
    </div>
  );
}
