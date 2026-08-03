export default function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = {
    primary:
      "bg-gradient-to-r from-navy via-navy to-navy-dark text-cream shadow-navyGlow hover:from-navy-light hover:to-navy hover:shadow-warm active:scale-[0.98]",
    secondary:
      "bg-cream/90 text-navy glass-card border border-linen shadow-soft hover:bg-parchment hover:border-gold/40 active:scale-[0.98]",
    gold:
      "bg-gradient-to-r from-gold via-gold-light to-gold-dark text-navy font-bold shadow-glow hover:brightness-110 active:scale-[0.98]",
    ghost:
      "text-walnut hover:bg-linen/70 hover:text-navy active:scale-[0.98]",
  };

  return (
    <button
      className={[
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant] ?? styles.primary,
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
