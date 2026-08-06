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
    "inline-flex items-center justify-center gap-2 font-body font-semibold rounded-card transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const sizes = {
    sm: "px-4 py-1.5 text-xs",
    md: "px-6 py-2.5 text-sm",
    lg: "px-8 py-3 text-base",
  };

  const variants = {
    primary:
      "bg-ember text-white hover:bg-[#C84A28] active:bg-[#B3412A]",
    outline:
      "border-2 border-ink text-ink hover:bg-ink hover:text-paper active:bg-ink/90",
    ghost:
      "text-muted hover:text-ink hover:bg-surface active:bg-border",
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
