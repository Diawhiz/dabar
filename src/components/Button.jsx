export default function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-navy text-cream shadow-soft hover:bg-[#24365f]",
    secondary: "bg-cream text-navy shadow-soft ring-1 ring-navy/10 hover:bg-parchment",
    ghost: "text-walnut hover:bg-linen/70 hover:text-navy",
  };

  return (
    <button
      className={[
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
