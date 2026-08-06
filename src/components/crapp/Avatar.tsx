import { cn } from "@/lib/utils";
import { useAvatar } from "@/lib/avatar-store";

export function Avatar({
  id,
  fallback,
  className,
  alt,
}: {
  id: string;
  fallback: string;
  className?: string;
  alt?: string;
}) {
  const src = useAvatar(id);
  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? `Foto di ${fallback}`}
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
