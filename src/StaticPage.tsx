import { useEffect, useState } from 'react';
import type { StaticPageConfig } from './staticPageConfig';

type ThemeMode = 'light' | 'dark';

type StaticPageProps = {
  page: StaticPageConfig;
};

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const savedTheme = window.localStorage.getItem('env-validator-theme');

  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function upsertMeta(
  selector: string,
  attribute: 'name' | 'property',
  key: string,
  content: string,
) {
  const existing = document.querySelector<HTMLMetaElement>(selector);
  const element = existing ?? document.createElement('meta');

  if (!existing) {
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.content = content;
}

function setMetadata(page: StaticPageConfig) {
  document.title = page.title;

  const description =
    document.querySelector<HTMLMetaElement>('meta[name="description"]') ??
    document.createElement('meta');

  if (!description.parentNode) {
    description.name = 'description';
    document.head.appendChild(description);
  }

  description.content = page.description;

  const canonical =
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ??
    document.createElement('link');

  if (!canonical.parentNode) {
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }

  canonical.href = page.canonicalUrl;

  upsertMeta('meta[property="og:title"]', 'property', 'og:title', page.title);
  upsertMeta('meta[property="og:description"]', 'property', 'og:description', page.description);
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', page.canonicalUrl);
  upsertMeta('meta[property="og:image"]', 'property', 'og:image', page.ogImageUrl);
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', page.title);
  upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', page.description);
  upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', page.ogImageUrl);
}

export function StaticPage({ page }: StaticPageProps) {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    setMetadata(page);
  }, [page]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('env-validator-theme', theme);
  }, [theme]);

  return (
    <div className="page-shell">
      <header className="hero">
        <div className="hero__headline">
          <div className="hero__title-wrap">
            <p className="section-heading__eyebrow">{page.eyebrow}</p>
            <h1>{page.heading}</h1>
            <p className="hero__lede">{page.lede}</p>
          </div>
          <div className="hero__controls hero__controls--right">
            <button
              type="button"
              className="theme-toggle"
              suppressHydrationWarning
              onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? 'Dark theme' : 'Light theme'}
            </button>
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
                {section.body.map((paragraph) => (
                  section.title === 'Email' ? (
                    <p key={paragraph}>
                      <a href={`mailto:${paragraph}`}>{paragraph}</a>
                    </p>
                  ) : (
                    <p key={paragraph}>{paragraph}</p>
                  )
                ))}
              </section>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
