import { supabase } from "../supabase/client";

const SIZE = 256;
const BUCKET = "avatars";

/**
 * Processa e envia a foto de avatar (Fase 3 Etapa 2). No cliente: corrige a
 * orientação EXIF (fotos de câmera mobile), faz center-crop quadrado e reduz para
 * 256×256 webp — bundle leve, sem libs. Envia ao Supabase Storage e devolve a URL
 * pública com cache-bust temporal (a CDN serve o arquivo novo na hora). Sem
 * backend (modo demo), devolve um objectURL local (preview da sessão).
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await toSquareWebp(file);

  if (!supabase) {
    // Demo/offline: sem upload real; preview local (perdido ao recarregar).
    return URL.createObjectURL(blob);
  }

  const path = `${userId}/avatar.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "image/webp",
    cacheControl: "3600",
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust: força navegador + CDN a buscar a versão recém-enviada.
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Decodifica respeitando o EXIF, recorta no centro (quadrado) e exporta webp 256². */
async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await decode(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("AVATAR_CANVAS_UNAVAILABLE");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  if ("close" in bitmap) (bitmap as ImageBitmap).close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) throw new Error("AVATAR_ENCODE_FAILED");
  return blob;
}

/**
 * `createImageBitmap` com `imageOrientation: 'from-image'` aplica a rotação EXIF
 * automaticamente (resolve fotos "deitadas" de iPhone/Android). Fallback para
 * <img> quando a opção não é suportada.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
