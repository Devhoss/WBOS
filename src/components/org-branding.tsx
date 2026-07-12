function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const sizeMap = {
  sm: { wrapper: "size-7", text: "text-[10px]" },
  md: { wrapper: "size-9", text: "text-xs" },
  lg: { wrapper: "size-12", text: "text-sm" },
} as const;

export function OrgBranding({
  name,
  logoPath,
  size = "md",
}: {
  name: string;
  logoPath?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const s = sizeMap[size];

  if (logoPath) {
    return (
      <div className={`${s.wrapper} shrink-0 overflow-hidden rounded-md`}>
        <img
          src={`/${logoPath}`}
          alt={name}
          className="size-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`${s.wrapper} flex shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground`}
    >
      <span className={`font-semibold ${s.text}`}>{getInitials(name)}</span>
    </div>
  );
}
