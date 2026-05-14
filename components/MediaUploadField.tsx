'use client';
import { useRef, useState } from 'react';

export type MediaKind = 'image' | 'video' | 'audio' | 'file';

const KIND_CONFIG = {
  image: {
    accept: 'image/jpeg,image/png,image/gif,image/webp',
    maxMb: 10,
    resource_type: 'image' as const,
    icon: '🖼️',
    hint: 'JPG, PNG, GIF, WebP · máx 10 MB',
  },
  video: {
    accept: 'video/mp4,video/quicktime,video/webm',
    maxMb: 100,
    resource_type: 'video' as const,
    icon: '🎬',
    hint: 'MP4, MOV, WebM · máx 100 MB',
  },
  audio: {
    accept: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a',
    maxMb: 20,
    resource_type: 'video' as const, // Cloudinary uses 'video' for audio
    icon: '🎵',
    hint: 'MP3, WAV, OGG, M4A · máx 20 MB',
  },
  file: {
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv',
    maxMb: 50,
    resource_type: 'raw' as const,
    icon: '📎',
    hint: 'PDF, DOC, XLS, ZIP, TXT · máx 50 MB',
  },
} as const;

interface Props {
  kind: MediaKind;
  url: string;
  caption?: string;
  onUrlChange: (url: string) => void;
  onCaptionChange?: (caption: string) => void;
}

export default function MediaUploadField({ kind, url, caption, onUrlChange, onCaptionChange }: Props) {
  const [progress, setProgress]   = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');
  const [dragOver, setDragOver]   = useState(false);
  const fileRef                   = useRef<HTMLInputElement>(null);
  const xhrRef                    = useRef<XMLHttpRequest | null>(null);

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

  function doUpload(file: File) {
    const validationErr = validate(file);
    if (validationErr) { setError(validationErr); return; }

    setError('');
    setUploading(true);
    setProgress(0);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', preset!);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener('load', () => {
      setUploading(false);
      xhrRef.current = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { secure_url: string };
          onUrlChange(data.secure_url);
          setProgress(100);
        } catch {
          setError('Resposta inválida do servidor de upload.');
          setProgress(0);
        }
      } else {
        try {
          const body = JSON.parse(xhr.responseText) as { error?: { message: string } };
          setError(body.error?.message ?? `Erro ${xhr.status}`);
        } catch {
          setError(`Erro ${xhr.status}`);
        }
        setProgress(0);
      }
    });

    xhr.addEventListener('error', () => {
      setUploading(false);
      xhrRef.current = null;
      setError('Falha na conexão. Verifique sua internet.');
      setProgress(0);
    });

    xhr.addEventListener('abort', () => {
      setUploading(false);
      xhrRef.current = null;
      setProgress(0);
    });

    xhr.open(
      'POST',
      `https://api.cloudinary.com/v1_1/${cloudName}/${cfg.resource_type}/upload`,
    );
    xhr.send(fd);
  }

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    doUpload(files[0]);
  };

  const cancel = () => xhrRef.current?.abort();
  const clear  = () => { onUrlChange(''); setProgress(0); setError(''); };

  const filename = url
    ? decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '')
    : '';

  return (
    <div className="space-y-3">

      {/* Progress bar ─────────────────────────────────────────────────── */}
      {uploading && (
        <div
          className="rounded-xl px-3 py-3"
          style={{ border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-indigo-300 font-medium">Enviando… {progress}%</span>
            <button
              type="button"
              onClick={cancel}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
          <div
            className="rounded-full overflow-hidden"
            style={{ height: 4, background: 'rgba(255,255,255,0.07)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
              }}
            />
          </div>
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
    </div>
  );
}
