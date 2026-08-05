import { forwardRef } from "react";

const variants = {
  gold: "bg-pulse-gold text-signal-bg font-bold hover:bg-yellow-400 shadow-pulse active:scale-[0.98]",
  amber: "bg-pulse-amber text-white font-bold hover:bg-orange-600 shadow-laser active:scale-[0.98]",
  navy: "bg-signal-panel text-text-primary border border-signal-border hover:bg-signal-hover hover:border-text-secondary active:scale-[0.98]",
  outline: "border border-signal-border bg-transparent text-text-secondary hover:border-pulse-gold hover:text-pulse-gold active:scale-[0.98]",
  ghost: "bg-transparent text-text-secondary hover:bg-signal-panel hover:text-text-primary",
};

const sizes = {
  sm: "h-9 px-3.5 text-xs rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-13 px-7 text-base rounded-2xl gap-2.5 font-display",
};

const Button = forwardRef(function Button(
  { variant = "gold", size = "md", className = "", children, ...props },
  ref
) {
  const variantClass = variants[variant] || variants.gold;
  const sizeClass = sizes[size] || sizes.md;

  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
