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
    "inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-lg transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-xs",
    lg: "px-6 py-2.5 text-sm",
  };

  const variants = {
    primary:
      "bg-accent text-white hover:opacity-90 active:opacity-100 shadow-xs",
    outline:
      "border border-border bg-surface text-primary hover:border-accent active:bg-surface-hover",
    ghost:
      "text-secondary hover:text-primary hover:bg-surface active:bg-surface-hover",
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
