import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { urlAvatar } from "@/lib/avatar-store";

export function Avatar({
  id,
  fallback,
  className,
  alt,
  bust,
}: {
  id: string;
  fallback: string;
  className?: string;
  alt?: string;
  /** Forza il ricaricamento ignorando la cache: usato dopo aver cambiato la propria foto. */
  bust?: number;
}) {
  const [errore, setErrore] = useState(false);
  useEffect(() => setErrore(false), [id, bust]);

  if (!errore) {
    const src = bust ? `${urlAvatar(id)}?v=${bust}` : urlAvatar(id);
    return (
      <img
        src={src}
        alt={alt ?? `Foto di ${fallback}`}
        onError={() => setErrore(true)}
        className={cn("shrink-0 rounded-2xl object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl bg-secondary font-display",
        className,
      )}
    >
      {fallback}
    </span>
  );
}
