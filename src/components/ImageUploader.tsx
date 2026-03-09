/**
 * ImageUploader
 * ─────────────────────────────────────────────────────────────────
 * Reusable drag-and-drop image upload zone.
 *
 * Props:
 *   onUpload(file)  – called with File after validation (before compress)
 *   currentUrl?     – existing URL shown as current image
 *   label?          – upload button label
 *   aspectRatio?    – '1:1' | '16:9' | '4:3' | '3:1'  (default '1:1')
 *   progress?       – 0–100 shows progress bar; 100 shows ✓ badge
 *   disabled?       – grey out and block interaction
 *   hint?           – shown below zone when no file selected
 *   maxSlots?       – for multi-image (e.g. products): shows slot number
 *   slot?           – slot label string shown in center
 */
'use client'
import { useRef, useState, DragEvent } from 'react'
import { formatBytes } from '@/lib/imageService'

interface ImageUploaderProps {
  onUpload:     (file: File) => void
  currentUrl?:  string | null
  label?:       string
  disabled?:    boolean
  progress?:    number
  aspectRatio?: '1:1' | '16:9' | '4:3' | '3:1'
  hint?:        string
  slot?:        string   // e.g. "Photo 1", "Photo 2"
}

const ASPECT_PAD: Record<string, string> = {
  '1:1':  '100%',
  '16:9': '56.25%',
  '4:3':  '75%',
  '3:1':  '33.33%',
}

export default function ImageUploader({
  onUpload, currentUrl, label = 'Upload image',
  disabled, progress, aspectRatio = '1:1', hint, slot,
}: ImageUploaderProps) {
  const [preview, setPreview]   = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [fileInfo, setFileInfo] = useState<string | null>(null)
  const [err, setErr]           = useState<string | null>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  const isUploading = typeof progress === 'number' && progress > 0 && progress < 100
  const isDone      = progress === 100
  const displayUrl  = preview || currentUrl || null

  function validate(file: File): string | null {
    if (!file.type.startsWith('image/')) return 'Only image files are accepted.'
    if (file.size > 15 * 1024 * 1024)   return 'File must be under 15 MB.'
    return null
  }

  function handle(file: File) {
    setErr(null)
    const e = validate(file)
    if (e) { setErr(e); return }
    // Generate local preview immediately
    const url = URL.createObjectURL(file)
    setPreview(url)
    setFileInfo(`${file.name} (${formatBytes(file.size)}) → compressing to WebP`)
    onUpload(file)
  }

  function onFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    if (file) handle(file)
    ev.target.value = ''   // allow re-selecting same file
  }

  function onDrop(ev: DragEvent<HTMLDivElement>) {
    ev.preventDefault(); setDragging(false)
    const file = ev.dataTransfer.files?.[0]
    if (file) handle(file)
  }

  return (
    <div style={{ fontFamily: 'inherit', width: '100%' }}>
      <style>{`
        .img-uploader-zone:hover .img-overlay-hover { opacity: 1 !important; }
      `}</style>

      {/* ── Drop zone ─────────────────────────────────────── */}
      <div
        className="img-uploader-zone"
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={ev => { ev.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          position: 'relative',
          paddingTop: ASPECT_PAD[aspectRatio] || '100%',
          borderRadius: 14,
          border: `2px dashed ${dragging ? '#FF3008' : err ? '#ef4444' : 'var(--border-2)'}`,
          background: dragging ? 'rgba(255,48,8,.07)' : 'var(--bg-2)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          overflow: 'hidden',
          transition: 'border-color .15s, background .15s',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {/* Current / preview image */}
        {displayUrl && (
          <img
            src={displayUrl}
            alt="Preview"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => {
              // Image transform URL failed (free plan) — fall back to plain URL
              const target = e.currentTarget
              if (target.src.includes('/render/image/')) {
                target.src = target.src.replace('/render/image/', '/object/')
                  .split('?')[0]
              }
            }}
          />
        )}

        {/* Empty state overlay */}
        {!displayUrl && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12,
          }}>
            <div style={{ fontSize: 28, lineHeight: 1 }}>📷</div>
            {slot && (
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-3)', letterSpacing: '0.05em' }}>
                {slot}
              </span>
            )}
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textAlign: 'center' }}>{label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{dragging ? 'Drop it!' : 'Click or drag & drop'}</span>
          </div>
        )}

        {/* Hover overlay on existing image */}
        {displayUrl && (
          <div className="img-overlay-hover" style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'rgba(0,0,0,.52)', opacity: 0, transition: 'opacity .2s',
          }}>
            <span style={{ fontSize: 22 }}>✎</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Change image</span>
          </div>
        )}

        {/* Progress bar (bottom) */}
        {isUploading && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,.15)' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#FF3008', transition: 'width .25s' }} />
          </div>
        )}

        {/* Done badge */}
        {isDone && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            width: 24, height: 24, borderRadius: '50%',
            background: '#22C55E', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 900,
          }}>✓</div>
        )}

        {/* Uploading spinner overlay */}
        {isUploading && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            width: 24, height: 24, borderRadius: '50%',
            border: '2.5px solid rgba(255,255,255,.2)',
            borderTopColor: '#FF3008',
            animation: 'spin .7s linear infinite',
          }} />
        )}
      </div>

      {/* Global spin animation */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* File info / hint / error */}
      <div style={{ minHeight: 20, marginTop: 6 }}>
        {err && (
          <p style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>⚠ {err}</p>
        )}
        {!err && isUploading && (
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Uploading… {progress}%</p>
        )}
        {!err && isDone && (
          <p style={{ fontSize: 11, color: '#22C55E', fontWeight: 700 }}>✓ Uploaded successfully</p>
        )}
        {!err && !isUploading && !isDone && fileInfo && (
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{fileInfo}</p>
        )}
        {!err && !fileInfo && hint && (
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{hint}</p>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
    </div>
  )
}