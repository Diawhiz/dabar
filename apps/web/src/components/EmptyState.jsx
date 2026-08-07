import Waveform from "./Waveform.jsx";
import Btn from "./Btn.jsx";

/**
 * EmptyState — friendly empty placeholder with a flat-lining waveform.
 */
export default function EmptyState({
  heading = "Nothing here yet",
  message = "Upload your first sermon to get started.",
  actionLabel,
  onAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* Flat-line waveform illustration */}
      <div className="flex items-end justify-center gap-px h-10 w-48 opacity-20 mb-6" aria-hidden="true">
        {Array.from({ length: 32 }, (_, i) => (
          <div
            key={i}
            className="bg-muted rounded-sm"
            style={{ width: "2px", height: `${8 + (i % 3) * 4}%` }}
          />
        ))}
      </div>

      <h3 className="font-display text-xl font-semibold text-ink">{heading}</h3>
      <p className="mt-2 text-sm text-muted font-body max-w-sm">{message}</p>

      {actionLabel && onAction && (
        <Btn variant="primary" className="mt-6" onClick={onAction}>
          {actionLabel}
        </Btn>
      )}
    </div>
  );
}
