import type { StaticPageConfig } from './staticPageConfig';
import { articlePages } from './articlePages';

type StaticPageProps = {
  page: StaticPageConfig;
};

function buildArticleSchema(page: StaticPageConfig) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.heading,
    description: page.description,
    image: page.ogImageUrl,
    mainEntityOfPage: page.canonicalUrl,
    ...(page.updatedAt
      ? { datePublished: page.updatedAt, dateModified: page.updatedAt }
      : {}),
    author: { '@type': 'Organization', name: 'Env File Validator' },
    publisher: { '@type': 'Organization', name: 'Env File Validator' },
  };
}

export function StaticPage({ page }: StaticPageProps) {
  const isArticle = page.kind === 'article';

  return (
    <div className="page-shell">
      {isArticle ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildArticleSchema(page)) }}
        />
      ) : null}

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
          {articlePages.map((article) => (
            <a key={article.routePath} className="site-footer__link" href={article.routePath}>
              {article.navLabel ?? article.heading}
            </a>
          ))}
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

            {page.cta ? (
              <p className="static-page__cta">
                <a className="button button--demo" href={page.cta.href}>
                  {page.cta.label}
                </a>
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
