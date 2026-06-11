export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-gold">{eyebrow}</p>}
        <h1 className="font-serif text-4xl font-semibold tracking-normal text-navy sm:text-5xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-base leading-7 text-walnut">{description}</p>}
      </div>
      {action}
    </div>
  );
}
