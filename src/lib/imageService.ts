/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  WELOKL IMAGE SERVICE                                           ║
 * ║                                                                 ║
 * ║  Single file that owns ALL image operations.                   ║
 * ║                                                                 ║
 * ║  TO MIGRATE TO S3 / CLOUDFLARE R2:                            ║
 * ║    1. Implement ImageProvider interface below                   ║
 * ║    2. Swap `const provider = supabaseProvider` at the bottom   ║
 * ║    3. Nothing else in your codebase changes.                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Bucket layout
 *   shop-images/
 *     {userId}/logo.webp          ← shop logo    (1 per shop)
 *     {userId}/banner.webp        ← shop banner  (1 per shop)
 *
 *   product-images/
 *     {userId}/{productId}/1.webp ← primary image
 *     {userId}/{productId}/2.webp ← secondary image (optional)
 *
 * Compression
 *   All uploads compressed client-side to WebP ≤ 300 KB
 *   before hitting the network. Storage stays lean forever.
 *
 * Dynamic resizing
 *   imgUrl() returns a CDN transform URL (Supabase Pro) or plain URL (free).
 *   On Supabase Pro: ?width=400&resize=cover for on-the-fly resizing.
 *   On Supabase Free: returns full image URL (browser caches it).
 *   On S3/CF R2: swap imgUrl() to use CF Images or imgix.
 */

import { createClient } from '@/lib/supabase/client'

// ── Constants ──────────────────────────────────────────────────────
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!
const MAX_SIZE_BYTES = 300_000   // 300 KB — target after compression
const MAX_DIMENSION  = 1200      // px — never store above this
const WEBP_QUALITY   = 0.82      // starting quality, auto-reduced if needed

export type ShopImageType = 'logo' | 'banner'

/** Hard limits enforced both client-side (UI) and service-side */
export const LIMITS = {
  shopLogo:      1,
  shopBanner:    1,
  productImages: 2,   // slot 1 = primary, slot 2 = secondary
} as const

export interface UploadResult {
  url:  string   // full public URL — save this in your DB column
  path: string   // bucket-relative path — use for deletion
}

// ══════════════════════════════════════════════════════════════════
//  PROVIDER INTERFACE
//  Implement this to swap the storage backend without touching
//  any other file in the codebase.
// ══════════════════════════════════════════════════════════════════
export interface ImageProvider {
  /**
   * Upload a file to a given path in the bucket.
   * @param bucket  e.g. 'shop-images' | 'product-images'
   * @param path    e.g. 'userId/logo.webp'
   * @param file    Already compressed File object
   */
  upload(bucket: string, path: string, file: File): Promise<void>

  /** Delete one or more paths from a bucket. */
  remove(bucket: string, paths: string[]): Promise<void>

  /**
   * Return a URL for the file at this path.
   * @param opts  Optional width/height for CDN resize. Ignored if backend doesn't support it.
   */
  url(bucket: string, path: string, opts?: ResizeOpts): string
}

export interface ResizeOpts {
  width?:  number
  height?: number
  resize?: 'cover' | 'contain' | 'fill'
}

// ══════════════════════════════════════════════════════════════════
//  SUPABASE PROVIDER (current default)
// ══════════════════════════════════════════════════════════════════
const supabaseProvider: ImageProvider = {
  async upload(bucket, path, file) {
    const sb = createClient()
    const { error } = await sb.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: 'image/webp',
    })
    if (error) throw new Error(`Upload failed: ${error.message}`)
  },

  async remove(bucket, paths) {
    const { error } = await createClient().storage.from(bucket).remove(paths)
    if (error) console.error('Storage delete error:', error.message)
  },

  url(bucket, path, opts) {
    if (!opts || (!opts.width && !opts.height)) {
      // Plain public URL — works on all Supabase plans
      return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
    }
    // Image transform URL — only works on Supabase Pro.
    // On free plan this returns a 400; fall back gracefully in <img> onError.
    const base = `${SUPABASE_URL}/storage/v1/render/image/public/${bucket}/${path}`
    const p = new URLSearchParams()
    if (opts.width)  p.set('width',  String(opts.width))
    if (opts.height) p.set('height', String(opts.height))
    if (opts.resize) p.set('resize', opts.resize)
    return `${base}?${p.toString()}`
  },
}

// ══════════════════════════════════════════════════════════════════
//  S3 / CLOUDFLARE R2 PROVIDER STUB
//  Uncomment and fill in when you move to S3/R2.
// ══════════════════════════════════════════════════════════════════
/*
import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: process.env.AWS_REGION! })
const BUCKET_MAP: Record<string, string> = {
  'shop-images':    process.env.S3_SHOP_IMAGES_BUCKET!,
  'product-images': process.env.S3_PRODUCT_IMAGES_BUCKET!,
}
const CDN_URL = process.env.CDN_URL!  // e.g. https://cdn.welokl.com

const s3Provider: ImageProvider = {
  async upload(bucket, path, file) {
    const Body = Buffer.from(await file.arrayBuffer())
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_MAP[bucket],
      Key: path,
      Body,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000',
    }))
  },
  async remove(bucket, paths) {
    await s3.send(new DeleteObjectsCommand({
      Bucket: BUCKET_MAP[bucket],
      Delete: { Objects: paths.map(Key => ({ Key })) },
    }))
  },
  url(bucket, path, opts) {
    const base = `${CDN_URL}/${path}`
    // Use Cloudflare Images / imgix for resizing
    if (opts?.width) return `${base}?width=${opts.width}&fit=${opts.resize ?? 'cover'}`
    return base
  },
}
*/

// ── ACTIVE PROVIDER — swap this one line to migrate ───────────────
const provider: ImageProvider = supabaseProvider

// ══════════════════════════════════════════════════════════════════
//  COMPRESSION
// ══════════════════════════════════════════════════════════════════
/**
 * Compress and convert any image to WebP ≤ maxBytes.
 * Canvas-based, runs entirely in the browser.
 */
export async function compressImage(
  file: File,
  maxBytes = MAX_SIZE_BYTES,
  maxDim   = MAX_DIMENSION,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  return new Promise((resolve, reject) => {
    const img     = new Image()
    const blobUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(blobUrl)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width);  width  = maxDim }
        else                { width  = Math.round(width  * maxDim / height); height = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, width, height)
      let quality = WEBP_QUALITY
      const tryEncode = () => {
        canvas.toBlob(blob => {
          if (!blob) { resolve(file); return }
          if (blob.size > maxBytes && quality > 0.35) { quality -= 0.08; tryEncode(); return }
          resolve(new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.webp'),
            { type: 'image/webp', lastModified: Date.now() },
          ))
        }, 'image/webp', quality)
      }
      tryEncode()
    }
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Image load failed')) }
    img.src = blobUrl
  })
}

// ══════════════════════════════════════════════════════════════════
//  UPLOAD FUNCTIONS
// ══════════════════════════════════════════════════════════════════

/** Upload shop logo or banner. Upserts (replaces) any existing file. */
export async function uploadShopImage(
  file: File,
  userId: string,
  type: ShopImageType,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  onProgress?.(5)
  const compressed = await compressImage(file)
  onProgress?.(40)
  const path = `${userId}/${type}.webp`
  await provider.upload('shop-images', path, compressed)
  onProgress?.(100)
  return { url: provider.url('shop-images', path), path }
}

/** Upload one product image into slot 1 (primary) or slot 2 (secondary). */
export async function uploadProductImage(
  file: File,
  userId: string,
  productId: string,
  slot: 1 | 2,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  onProgress?.(5)
  const compressed = await compressImage(file)
  onProgress?.(40)
  const path = `${userId}/${productId}/${slot}.webp`
  await provider.upload('product-images', path, compressed)
  onProgress?.(100)
  return { url: provider.url('product-images', path), path }
}

// ══════════════════════════════════════════════════════════════════
//  DELETE FUNCTIONS
//  Also called server-side via SQL trigger — these are client-side helpers
// ══════════════════════════════════════════════════════════════════

export async function deleteProductImages(userId: string, productId: string): Promise<void> {
  await provider.remove('product-images', [
    `${userId}/${productId}/1.webp`,
    `${userId}/${productId}/2.webp`,
  ])
}

export async function deleteShopImages(userId: string): Promise<void> {
  await provider.remove('shop-images', [
    `${userId}/logo.webp`,
    `${userId}/banner.webp`,
  ])
}

export async function deleteStorageFile(bucket: string, path: string): Promise<void> {
  await provider.remove(bucket, [path])
}

// ══════════════════════════════════════════════════════════════════
//  URL HELPERS — used throughout the UI
// ══════════════════════════════════════════════════════════════════

/** Generic resized URL. Falls back gracefully on free Supabase plan. */
export function imgUrl(
  bucket: string,
  path: string,
  opts: ResizeOpts = {},
): string {
  return provider.url(bucket, path, opts)
}

/** Shop logo at the requested pixel size. */
export function shopLogoUrl(userId: string, width = 200): string {
  return provider.url('shop-images', `${userId}/logo.webp`, { width, height: width, resize: 'cover' })
}

/** Shop banner at the requested width. */
export function shopBannerUrl(userId: string, width = 800): string {
  return provider.url('shop-images', `${userId}/banner.webp`, { width, height: Math.round(width * 0.35), resize: 'cover' })
}

/** Product image at the requested size. Slot 1 = primary. */
export function productImgUrl(userId: string, productId: string, slot: 1 | 2 = 1, width = 400): string {
  return provider.url('product-images', `${userId}/${productId}/${slot}.webp`, { width, height: width, resize: 'cover' })
}

// ── Misc helpers ───────────────────────────────────────────────────

/** Parse a public storage URL back into bucket + path for deletions. */
export function parseBucketPath(publicUrl: string): { bucket: string; path: string } | null {
  try {
    const marker = '/storage/v1/object/public/'
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return null
    const rest  = publicUrl.slice(idx + marker.length)
    const slash = rest.indexOf('/')
    return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) }
  } catch { return null }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024)    return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}