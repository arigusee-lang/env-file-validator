import type { StaticPageConfig } from './staticPageConfig';

type StaticPageProps = {
  page: StaticPageConfig;
};

export function StaticPage({ page }: StaticPageProps) {
  return (
    <div className="page-shell">
      <header className="hero">
        <div className="hero__headline">
          <div className="hero__title-wrap">
            <p className="section-heading__eyebrow">{page.eyebrow}</p>
            <h1>{page.heading}</h1>
            <p className="hero__lede">{page.lede}</p>
          </div>
        </div>
      </header>

      <main className="static-page">
        <nav className="static-page__nav" aria-label="Site pages">
          <a className="site-footer__link" href="/">
            Env validator
          </a>
          <a className="site-footer__link" href="/properties-file-validator">
            Properties validator
          </a>
          <a className="site-footer__link" href="/privacy-policy">
            Privacy Policy
          </a>
          <a className="site-footer__link" href="/contact">
            Contact
          </a>
        </nav>

        <section className="static-page__card">
          <div className="static-page__sections">
            {page.sections.map((section) => (
              <section key={section.title} className="policy-modal__section">
                <h2>{section.title}</h2>
                {section.body.map((paragraph) =>
                  section.title === 'Email' ? (
                    <p key={paragraph}>
                      <a href={`mailto:${paragraph}`}>{paragraph}</a>
                    </p>
                  ) : (
                    <p key={paragraph}>{paragraph}</p>
                  ),
                )}
              </section>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
