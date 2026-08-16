export default function Btn({
  children,
  icon,
  variant = "primary",
  size = "md",
  type = "button",
  disabled = false,
  className = "",
  onClick,
  ...rest
}) {
  const sizes = {
    xs: "px-3 py-1 text-[11px]",
    sm: "px-4 py-1.5 text-xs",
    md: "px-5 py-2.5 text-xs",
    lg: "px-6 py-3.5 text-sm",
  };

  const variants = {
    primary:
      "island-btn-primary shadow-[0_4px_18px_-2px_var(--accent-glow)] text-accent-fg",
    secondary:
      "island-btn-secondary text-primary hover:text-white",
    ghost:
      "bg-transparent text-secondary hover:text-primary hover:bg-white/5",
    danger:
      "bg-danger-muted text-danger border border-danger/30 hover:bg-danger hover:text-white",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`group island-btn ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      <span className="font-semibold tracking-tight">{children}</span>
      {icon ? (
        <div className="island-btn-icon-capsule">
          <i className={`bx ${icon}`} />
        </div>
      ) : null}
    </button>
  );
}
