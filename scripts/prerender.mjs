import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const ssrEntryPath = path.join(rootDir, 'dist-ssr', 'entry-server.js');

const { render } = await import(pathToFileURL(ssrEntryPath).href);
const template = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');

const routes = [
  {
    pathname: '/',
    outputPath: path.join(distDir, 'index.html'),
  },
  {
    pathname: '/privacy-policy',
    outputPath: path.join(distDir, 'privacy-policy', 'index.html'),
  },
  {
    pathname: '/contact',
    outputPath: path.join(distDir, 'contact', 'index.html'),
  },
  {
    pathname: '/properties-file-validator',
    outputPath: path.join(distDir, 'properties-file-validator', 'index.html'),
  },
];

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}

function replaceHeadValue(html, pattern, value) {
  return html.replace(pattern, value);
}

for (const route of routes) {
  const { appHtml, head } = render(route.pathname);
  const isStandaloneStaticPage =
    route.pathname === '/privacy-policy' || route.pathname === '/contact';

  let html = template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

  html = replaceHeadValue(html, /<title>.*?<\/title>/s, `<title>${escapeHtml(head.title)}</title>`);
  html = replaceHeadValue(
    html,
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${escapeAttribute(head.canonicalUrl)}" />`,
  );
  html = replaceHeadValue(
    html,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${escapeAttribute(head.description)}" />`,
  );
  html = replaceHeadValue(
    html,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${escapeAttribute(head.title)}" />`,
  );
  html = replaceHeadValue(
    html,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${escapeAttribute(head.description)}" />`,
  );
  html = replaceHeadValue(
    html,
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${escapeAttribute(head.canonicalUrl)}" />`,
  );
  html = replaceHeadValue(
    html,
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:image" content="${escapeAttribute(head.ogImageUrl)}" />`,
  );
  html = replaceHeadValue(
    html,
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${escapeAttribute(head.title)}" />`,
  );
  html = replaceHeadValue(
    html,
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${escapeAttribute(head.description)}" />`,
  );
  html = replaceHeadValue(
    html,
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:image" content="${escapeAttribute(head.ogImageUrl)}" />`,
  );

  if (isStandaloneStaticPage) {
    html = html.replace(
      /\s*<script\s+id="env-validator-adsense-loader"[\s\S]*?<\/script>/,
      '',
    );
    html = html.replace(/\s*<script type="module"[^>]*><\/script>/, '');
  }

  await fs.mkdir(path.dirname(route.outputPath), { recursive: true });
  await fs.writeFile(route.outputPath, html);
}
