import { renderToString } from 'react-dom/server';
import App from './App';
import { getActiveValidatorPage } from './validatorPageConfig';
import { getStaticPage } from './staticPageConfig';

export function render(pathname = '/') {
  const staticPage = getStaticPage(pathname);
  const pageConfig = staticPage ?? getActiveValidatorPage(pathname);

  return {
    appHtml: renderToString(<App pathname={pathname} />),
    head: {
      title: pageConfig.title,
      description: pageConfig.description,
      canonicalUrl: pageConfig.canonicalUrl,
      ogImageUrl: pageConfig.ogImageUrl,
    },
  };
}
