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
    "inline-flex items-center justify-center gap-1.5 font-sans font-medium rounded transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed select-none outline-none";

  const sizes = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3 py-1.5 text-xs",
    lg: "px-4 py-2 text-sm",
  };

  const variants = {
    primary:
      "bg-accent text-white hover:bg-[var(--accent-hover)] active:opacity-90",
    secondary:
      "bg-surface text-primary border border-border hover:bg-surface-hover hover:border-border-strong",
    outline:
      "border border-border bg-transparent text-primary hover:bg-surface hover:border-border-strong",
    ghost:
      "text-secondary hover:text-primary hover:bg-surface active:bg-surface-hover",
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
