import type { StaticPageConfig } from './staticPageConfig';

const SITE_URL = 'https://envvalidator.com';
const SHARED_OG_IMAGE = `${SITE_URL}/og-image.png`;
const UPDATED_AT = '2026-06-19';

const TOOL_CTA = {
  label: 'Open the .env file validator',
  href: '/',
} as const;

export const articlePages: StaticPageConfig[] = [
  {
    id: 'guide-validate',
    kind: 'article',
    updatedAt: UPDATED_AT,
    routePath: '/how-to-validate-env-file',
    navLabel: 'Validate guide',
    title: 'How to Validate a .env File Against .env.example',
    description:
      'A step-by-step guide to validating a .env file against its .env.example template: catch missing keys, extra keys, duplicates, and malformed lines before they break a deploy.',
    canonicalUrl: `${SITE_URL}/how-to-validate-env-file`,
    ogImageUrl: SHARED_OG_IMAGE,
    eyebrow: 'Guide',
    heading: 'How to validate a .env file against .env.example',
    lede:
      'Your .env.example is the contract for which environment variables an app needs. Validating a real .env file against it catches configuration gaps before they turn into runtime errors.',
    cta: TOOL_CTA,
    sections: [
      {
        title: 'Why validate against .env.example at all?',
        body: [
          'Most projects commit a .env.example (or .env.sample) file that lists every environment variable the application expects, usually with empty or placeholder values. The real .env files stay out of version control because they hold secrets and machine-specific values.',
          'The problem is drift. A teammate adds a new variable to .env.example but your local .env never gets it. A key is renamed in code but the old name lingers in production. A value gets pasted twice. None of this is visible until the app crashes on boot or, worse, silently reads an empty string. Validating one file against the other turns those invisible mismatches into a list you can act on.',
        ],
      },
      {
        title: 'Step 1: Treat .env.example as the source of truth',
        body: [
          'Decide which file is the template. In almost every project that is .env.example, because it is reviewed, committed, and shared across the team. Every required key should appear there, even if its value is blank.',
          'A useful rule: a template key with no value is required, and a template key with a default value is optional. That distinction lets a validator tell the difference between "you forgot to set DATABASE_URL" and "you left LOG_LEVEL at its default", instead of flagging everything.',
        ],
      },
      {
        title: 'Step 2: Compare your real .env against it',
        body: [
          'Load the template and the environment file side by side and look for four categories of issue. Missing keys: required template keys that are absent from the environment file. Extra (undocumented) keys: keys present in the environment file but not in the template, which are often typos or leftover variables. Duplicates: the same key assigned more than once, where the last assignment silently wins. Malformed lines: entries that are not valid KEY=value pairs.',
          'The browser-based .env file validator on this site does exactly this. Paste or drop your .env.example and up to three environment files, and it highlights each category and links every key to the exact file and line it appears on, with no upload to a server.',
        ],
      },
      {
        title: 'Step 3: Fix and re-check',
        body: [
          'Add the missing keys, remove or rename the undocumented ones, collapse duplicates to a single assignment, and repair malformed lines. Then run the comparison again until the report is clean.',
          'For teams, the same check is worth running in CI before a deploy, so a missing or malformed variable fails the pipeline instead of the production server. Validating locally first simply makes that gate faster to pass.',
        ],
      },
    ],
  },
  {
    id: 'guide-difference',
    kind: 'article',
    updatedAt: UPDATED_AT,
    routePath: '/env-vs-env-example',
    navLabel: '.env vs .env.example',
    title: '.env vs .env.example: What Is the Difference?',
    description:
      'A clear explanation of .env vs .env.example: what each file is for, why one is committed and the other is not, and how to keep them in sync.',
    canonicalUrl: `${SITE_URL}/env-vs-env-example`,
    ogImageUrl: SHARED_OG_IMAGE,
    eyebrow: 'Guide',
    heading: '.env vs .env.example: what is the difference?',
    lede:
      'They look almost identical, but .env and .env.example play opposite roles. One holds your real configuration; the other documents what configuration is expected.',
    cta: TOOL_CTA,
    sections: [
      {
        title: 'What .env is for',
        body: [
          'A .env file holds the actual environment variables for one specific environment: real database URLs, API keys, secrets, and feature flags. It is loaded at runtime by a dotenv library or your framework and is specific to a machine or deployment.',
          'Because it contains secrets and environment-specific values, .env should never be committed to version control. It is almost always listed in .gitignore, and each developer or deployment maintains its own copy.',
        ],
      },
      {
        title: 'What .env.example is for',
        body: [
          'A .env.example (sometimes .env.sample or .env.template) is a committed, shareable blueprint. It lists every variable the application needs, usually with empty values or safe placeholders rather than real secrets.',
          'Its job is documentation and onboarding: a new developer copies it to .env and fills in real values. Because it is in version control, code review keeps it honest, so it becomes the canonical list of "what this app expects to be configured".',
        ],
      },
      {
        title: 'The key differences at a glance',
        body: [
          'Committed: .env.example yes, .env no. Contains secrets: .env yes, .env.example no. Purpose: .env is real runtime config, .env.example is a documented contract. Number of copies: one .env.example for the repo, many .env files (local, dev, qa, prod).',
          'The two files share the same keys but differ in values. That is exactly why drift happens: it is easy to update one and forget the other, since git only ever sees the example.',
        ],
      },
      {
        title: 'How to keep them in sync',
        body: [
          'Whenever you add or rename a variable in code, update .env.example in the same commit so reviewers see it. Then have every developer re-check their local .env against the new template.',
          'You can automate the check: load .env.example as the template and your .env as the environment in the validator on this site, and it will list any key that is missing, undocumented, duplicated, or malformed. Keeping the example accurate and the real files validated against it is the whole game.',
        ],
      },
    ],
  },
  {
    id: 'guide-compare',
    kind: 'article',
    updatedAt: UPDATED_AT,
    routePath: '/compare-env-files',
    navLabel: 'Compare guide',
    title: 'How to Compare and Diff .env Files',
    description:
      'Learn how to compare and diff .env files across environments to find keys that are missing, extra, or defined differently between local, dev, qa, and prod.',
    canonicalUrl: `${SITE_URL}/compare-env-files`,
    ogImageUrl: SHARED_OG_IMAGE,
    eyebrow: 'Guide',
    heading: 'How to compare and diff .env files',
    lede:
      'A plain text diff of two .env files is noisy and order-sensitive. Comparing them by key tells you what actually differs between environments.',
    cta: { label: 'Compare your .env files now', href: '/' },
    sections: [
      {
        title: 'Why a line-based diff falls short',
        body: [
          'Running git diff or a generic text diff on two .env files compares them line by line. That reports differences in order, comments, and blank lines that do not matter, while making it hard to answer the real question: which keys exist in one file but not the other, and which keys have different values?',
          'Environment files are really a set of key-value pairs, not an ordered document. Comparing them as a set of keys removes the noise and surfaces the differences that affect how the app runs.',
        ],
      },
      {
        title: 'What a key-aware comparison shows you',
        body: [
          'A proper .env comparison groups results by key across every file. It tells you which keys are present everywhere, which are missing from one environment, which appear only in a single file, and which are duplicated within a file. It can also flag malformed lines that would otherwise be parsed as garbage.',
          'This is the difference between "line 14 changed" and "JWT_SECRET is set in prod but empty in qa" — the second is actionable.',
        ],
      },
      {
        title: 'How to compare .env files in the browser',
        body: [
          'Open the validator on this site and load one file as the reference template, then add the others as environments. You can paste them or drop up to four files at once. The tool parses each file and shows a per-key report: missing keys, undocumented keys, duplicates, and malformed lines, with each key linked to the exact file and line.',
          'Everything runs locally in your browser, so you can safely compare real .env.dev, .env.qa, and .env.prod files without any of their contents leaving your machine.',
        ],
      },
      {
        title: 'Common reasons environments diverge',
        body: [
          'A variable added for a new feature reaches dev but not prod. A secret is rotated in one place and not another. A key is renamed in code, leaving the old name behind in one file. A value is pasted twice, so a duplicate silently overrides the intended one.',
          'Diffing your environments by key on a schedule — or before each deploy — catches these before they cause an outage. It is the same comparison whether you have two files or four.',
        ],
      },
    ],
  },
  {
    id: 'guide-mistakes',
    kind: 'article',
    updatedAt: UPDATED_AT,
    routePath: '/common-env-file-mistakes',
    navLabel: 'Common mistakes',
    title: 'Common .env File Mistakes and How to Catch Them',
    description:
      'The most common .env file mistakes — missing keys, duplicates, malformed lines, and quoting errors — and how to catch them before they break your app.',
    canonicalUrl: `${SITE_URL}/common-env-file-mistakes`,
    ogImageUrl: SHARED_OG_IMAGE,
    eyebrow: 'Guide',
    heading: 'Common .env file mistakes and how to catch them',
    lede:
      'Environment files are deceptively simple, which is exactly why small mistakes slip through. Here are the ones that bite most often.',
    cta: TOOL_CTA,
    sections: [
      {
        title: 'Missing required keys',
        body: [
          'The most common failure is a variable the app needs that is simply not set. The code reads process.env.DATABASE_URL, gets undefined, and either crashes on boot or — worse — falls back to an empty string and connects to nothing.',
          'Catch it by validating against .env.example: any required template key (one with no default value) that is absent from the environment file is a missing key. Fix it by adding the key, even if the value is a placeholder you will fill in later.',
        ],
      },
      {
        title: 'Duplicate keys',
        body: [
          'When the same key is assigned twice in one file, most dotenv parsers keep the last assignment and silently discard the first. If the two values differ, you can spend hours debugging why the app ignores the value you can clearly see near the top of the file.',
          'Collapse every key to a single assignment. A validator that reports duplicate keys with their line numbers makes these easy to spot in a long file.',
        ],
      },
      {
        title: 'Malformed lines and quoting errors',
        body: [
          'Lines that are not valid KEY=value pairs are a frequent source of trouble: a missing equals sign, a key with spaces or hyphens, an unterminated quote, or a value that spans lines without proper quoting. Some of these are dropped silently; others swallow the lines that follow them.',
          'Quoting is its own trap. A hash inside an unquoted value can be read as the start of a comment, and a multiline value only works if it is wrapped in quotes. When in doubt, quote the value. A validator that understands dotenv syntax will flag the malformed line instead of letting the parser guess.',
        ],
      },
      {
        title: 'Undocumented and stale keys',
        body: [
          'Keys that exist in a real .env but not in .env.example are usually leftovers: a typo (DATABSE_URL), a variable from an old feature, or something added locally and never documented. They clutter configuration and hide real problems.',
          'Treat the template as the source of truth and review every undocumented key: either add it to .env.example because it is legitimately needed, or delete it. The validator on this site lists missing, duplicate, malformed, and undocumented keys together, so a single pass turns a messy .env into a clean, documented one.',
        ],
      },
    ],
  },
];
