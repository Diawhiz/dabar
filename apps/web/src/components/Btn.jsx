export default function Btn({
  children,
  icon,
  iconRight,
  variant = "primary",
  size = "md",
  type = "button",
  disabled = false,
  className = "",
  onClick,
  ...rest
}) {
  const sizes = {
    xs: "px-2.5 py-1 text-2xs gap-1.5 rounded-md",
    sm: "px-3 py-1.5 text-xs gap-1.5 rounded-md",
    md: "px-4 py-2 text-xs gap-2 rounded-lg",
    lg: "px-5 py-2.5 text-sm gap-2.5 rounded-xl",
  };

  const variants = {
    primary: "btn-studio-primary",
    orange: "btn-studio-orange",
    secondary: "btn-studio-secondary",
    ghost:
      "bg-transparent text-secondary hover:text-primary hover:bg-surface-hover border border-transparent",
    outline:
      "bg-transparent text-primary hover:bg-surface-hover border border-border hover:border-accent-border",
    danger:
      "bg-danger-muted text-danger border border-danger/30 hover:bg-danger hover:text-white",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`group btn-studio font-sans ${sizes[size] || sizes.md} ${
        variants[variant] || variants.primary
      } disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {icon && <i className={`bx ${icon} shrink-0 text-sm`} />}
      <span className="leading-none">{children}</span>
      {iconRight && (
        <span className="w-5 h-5 rounded-full bg-white/15 dark:bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
          <i className={`bx ${iconRight} text-xs`} />
        </span>
      )}
    </button>
  );
}
