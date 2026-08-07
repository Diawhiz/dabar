/**
 * ReelStrip — horizontal scrolling container with film-strip sprocket edges.
 * The signature layout primitive for Dabar.
 */
export default function ReelStrip({ children, label, className = "" }) {
  return (
    <div className={className}>
      {label && (
        <p className="sr-only">{label}</p>
      )}
      {/* Top sprocket edge */}
      <div className="sprocket-edge" aria-hidden="true" />

      {/* Scrollable reel */}
      <div className="reel-strip py-5 px-1" role="list" aria-label={label || "Content reel"}>
        {children}
      </div>

      {/* Bottom sprocket edge */}
      <div className="sprocket-edge" aria-hidden="true" />
    </div>
  );
}
