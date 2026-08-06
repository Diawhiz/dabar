import { forwardRef } from "react";
import { motion } from "framer-motion";

const variants = {
  gold: "bg-pulse-gold text-white font-bold hover:brightness-110 shadow-pulse",
  amber: "bg-pulse-amber text-white font-bold hover:brightness-110 shadow-laser",
  navy: "bg-signal-panel text-text-primary border border-signal-border hover:bg-signal-hover hover:border-text-secondary shadow-sm",
  outline: "border border-signal-border bg-signal-panel/40 text-text-secondary hover:border-pulse-gold hover:text-pulse-gold shadow-sm",
  ghost: "bg-transparent text-text-secondary hover:bg-signal-panel hover:text-text-primary",
};

const sizes = {
  sm: "h-9 px-3.5 text-xs rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-13 px-7 text-base rounded-2xl gap-2.5 font-display",
};

const Button = forwardRef(function Button(
  { variant = "gold", size = "md", className = "", children, disabled, ...props },
  ref
) {
  const variantClass = variants[variant] || variants.gold;
  const sizeClass = sizes[size] || sizes.md;

  return (
    <motion.button
      ref={ref}
      type="button"
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
});

export default Button;


