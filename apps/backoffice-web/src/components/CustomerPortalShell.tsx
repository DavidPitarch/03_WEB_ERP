import type { ReactNode } from 'react';

export function CustomerPortalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="customer-shell">
      <div className="customer-shell__backdrop" />
      <main className="customer-shell__content">
        <header className="customer-shell__hero">
          <p className="customer-shell__eyebrow">Portal de transparencia</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>
        {children}
      </main>
    </div>
  );
}
