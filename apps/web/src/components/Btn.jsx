export default function Btn({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  disabled = false,
  className = "",
  ...rest
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-sans font-semibold rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none outline-none active:scale-[0.98]";

  const sizes = {
    xs: "px-2 py-0.5 text-[11px]",
    sm: "px-2.5 py-1 text-xs",
    md: "px-3.5 py-1.5 text-xs",
    lg: "px-4.5 py-2 text-sm",
  };

  const variants = {
    primary:
      "bg-accent text-accent-fg hover:bg-[var(--accent-hover)] shadow-sm hover:shadow-[0_0_12px_var(--accent-glow)] border border-accent/20",
    secondary:
      "bg-surface text-primary border border-border hover:bg-surface-hover hover:border-border-strong shadow-xs",
    outline:
      "border border-border bg-transparent text-primary hover:bg-surface hover:border-border-strong",
    ghost:
      "text-secondary hover:text-primary hover:bg-surface-hover active:bg-surface-active",
    danger:
      "bg-danger-muted text-danger border border-danger/30 hover:bg-danger hover:text-white",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${base} ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
