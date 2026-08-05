export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-10 flex flex-col justify-between gap-6 border-b border-signal-border pb-8 md:flex-row md:items-end">
      <div className="max-w-3xl">
        {eyebrow && (
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-pulse-gold animate-pulse" />
            <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-pulse-gold">{eyebrow}</p>
          </div>
        )}
        <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
