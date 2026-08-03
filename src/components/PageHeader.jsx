export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-10 flex flex-col justify-between gap-6 border-b border-linen/70 pb-8 md:flex-row md:items-end">
      <div className="max-w-3xl">
        {eyebrow && (
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold">{eyebrow}</p>
          </div>
        )}
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-navy sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-walnut sm:text-lg">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
