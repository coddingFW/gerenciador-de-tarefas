import { useEffect, useState } from "preact/hooks";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Avatar do usuário: foto quando há URL válida; senão, iniciais. Cai para
 *  iniciais se a imagem falhar (ex.: objectURL de demo expirado). */
export function Avatar({
  name,
  avatarUrl,
  size = 32,
}: {
  name: string;
  avatarUrl: string | null;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [avatarUrl]);
  const showImg = avatarUrl && !errored;

  return (
    <span
      class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 font-medium text-brand-dark dark:bg-brand/20 dark:text-sky-200"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {showImg ? (
        <img src={avatarUrl} alt="" class="h-full w-full object-cover" onError={() => setErrored(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
