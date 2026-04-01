import {
  buildPlainTextReport,
  compareEnvFiles,
  parseEnv,
  type CompareResult,
  type EnvironmentCompareInput,
  type ParsedEnvFile,
  type SourceFile,
} from './features/envCompare';
import { comparePropertiesFiles, parseProperties } from './features/propertiesCompare';

export type ValidatorPageConfig = {
  id: 'env' | 'properties';
  routePath: string;
  title: string;
  description: string;
  canonicalUrl: string;
  ogImageUrl: string;
  softwareApplicationName: string;
  heroTitle: string;
  heroLede: string;
  faqHeading: string;
  faqItems: Array<{
    question: string;
    answer: string;
  }>;
  demoTemplate: string;
  demoEnvironmentTexts: string[];
  demoEnvironmentFilenames: string[];
  templateDefaultName: string;
  environmentFilenameSuggestions: string[];
  fileInputAccept?: string;
  templateUploadLabel: string;
  bulkUploadLabel: string;
  workspaceHint: string;
  templatePlaceholder: string;
  environmentPlaceholder: string;
  emptyStateTitle: string;
  emptyStateBody: string;
  noIssuesTitle: string;
  noIssuesBody: string;
  summaryEnvironmentCountLabel: string;
  summaryMissingLabel: string;
  summaryUndocumentedLabel: string;
  summaryDuplicateLabel: string;
  summaryMalformedLabel: string;
  summaryWarningsLabel: string;
  missingSectionTitle: string;
  missingSubtitle: string;
  missingEmptyLabel: string;
  duplicateSectionTitle: string;
  duplicateSubtitle: string;
  malformedSectionTitle: string;
  malformedSubtitle: string;
  warningsSectionTitle: string;
  warningsSubtitle: string;
  templateHelperText: (comparison: CompareResult) => string;
  isPreferredTemplateFilename: (filename: string) => boolean;
  getEnvironmentFilename: (index: number) => string;
  getDefaultEnvironmentDownloadName: (label: string) => string;
  parse: (input: string, source: SourceFile) => ParsedEnvFile;
  compare: (template: ParsedEnvFile, envs: EnvironmentCompareInput[]) => CompareResult;
  buildReport: (result: CompareResult) => string;
};

const SITE_URL = 'https://envvalidator.com';
const SHARED_OG_IMAGE = `${SITE_URL}/og-image.svg`;

function toKebabFileStem(label: string) {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : 'environment';
}

function envTemplateMatcher(filename: string) {
  const normalized = filename.trim().toLowerCase();

  return (
    normalized === '.env' ||
    normalized === '.env.example' ||
    normalized === 'env.local' ||
    normalized === '.env.local' ||
    normalized === 'env.dev' ||
    normalized === '.env.dev'
  );
}

function propertiesTemplateMatcher(filename: string) {
  const normalized = filename.trim().toLowerCase();

  return (
    normalized === 'application.properties' ||
    normalized === 'config.properties' ||
    normalized === 'reference.properties' ||
    normalized === 'defaults.properties'
  );
}

export const envPageConfig: ValidatorPageConfig = {
  id: 'env',
  routePath: '/',
  title: '.env File Validator - Compare .env Files Against .env.example',
  description:
    'Validate .env.local, .env.dev, .env.qa, and .env.prod against your .env.example template. Find missing keys, extra keys, duplicates, malformed lines, and warnings in the browser.',
  canonicalUrl: `${SITE_URL}/`,
  ogImageUrl: SHARED_OG_IMAGE,
  softwareApplicationName: 'Env File Validator',
  heroTitle: 'Validate multiple `.env` files against one `.env.example` template.',
  heroLede:
    'Check whether `.env.local`, `.env.dev`, `.env.qa`, and `.env.prod` match the keys documented in your reference template.',
  faqHeading: 'How this environment file validator works',
  faqItems: [
    {
      question: 'Does this tool upload any environment files?',
      answer: 'No. Parsing, validation, and comparison all happen locally in the browser.',
    },
    {
      question: 'What counts as a missing key?',
      answer:
        'Only template keys without default values count as missing. Defaulted template values are treated as optional fallbacks.',
    },
    {
      question: 'Are template duplicates and malformed lines still validated?',
      answer:
        'Yes. Duplicate keys and malformed lines stay visible in the reference template and in every environment file.',
    },
    {
      question: 'Which dotenv syntax is supported?',
      answer:
        'The validator covers common dotenv syntax: KEY=value assignments, export prefixes, inline comments, quoted values, quoted hashes, and multiline quoted values. Variable references like $NAME or ${NAME} are treated as plain string values and are not expanded at runtime.',
    },
  ],
  demoTemplate: `# Public onboarding template
API_URL=
DB_HOST=localhost
DB_PORT=5432
JWT_SECRET=
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
FEATURE_FLAG_NEW_HOME=false
PUBLIC_TEXT="hello # world" # quoted hash is part of the value
MULTILINE_BANNER="Welcome
Team"
OPTIONAL_NOTE=""
`,
  demoEnvironmentTexts: [
    `# Local development
API_URL=http://localhost:3000 # local api
DB_HOST=localhost
DB_PORT=5432
JWT_SECRET=
LOG_LEVEL=debug
EXPERIMENT_FLAG=true
API_URL=http://localhost:4000
INVALID-NAME=value
PUBLIC_TEXT="hello # local"
MULTILINE_BANNER="Welcome
Local team"
`,
    `# QA deployment
API_URL=https://qa.example.com
DB_HOST=qa-db.internal
DB_PORT=5432
JWT_SECRET=""
REDIS_URL=redis://qa.internal:6379
LOG_LEVEL=" "
FEATURE_FLAG_NEW_HOME=true
PUBLIC_TEXT="qa # banner"
MULTILINE_BANNER="Welcome
QA team" # multiline with trailing comment
`,
    `# Production deployment
API_URL=https://api.example.com
DB_HOST=prod-db.internal
DB_PORT=5432
JWT_SECRET=prod-secret
REDIS_URL=redis://prod.internal:6379
LOG_LEVEL=warn
FEATURE_FLAG_NEW_HOME=false
PUBLIC_TEXT="prod # banner"
MULTILINE_BANNER="Welcome
Production team"
`,
  ],
  demoEnvironmentFilenames: ['.env.dev', '.env.qa', '.env.prod'],
  templateDefaultName: '.env.example',
  environmentFilenameSuggestions: [
    '.env.local',
    '.env.dev',
    '.env.qa',
    '.env.prod',
    '.env.staging',
    '.env.preview',
  ],
  fileInputAccept: undefined,
  templateUploadLabel: 'Upload template',
  bulkUploadLabel: 'Upload all your env files',
  workspaceHint: 'Drag multiple env files here.',
  templatePlaceholder: 'API_URL=',
  environmentPlaceholder: 'API_URL=https://api.example.com',
  emptyStateTitle: 'Paste or upload a template and at least one environment file to start.',
  emptyStateBody:
    'Add more tabs with the plus button if you want to compare local, QA, and production files against the same reference contract.',
  noIssuesTitle: 'No issues detected.',
  noIssuesBody: 'The loaded template and environment files are aligned.',
  summaryEnvironmentCountLabel: 'Environments',
  summaryMissingLabel: 'Missing required',
  summaryUndocumentedLabel: 'Undocumented',
  summaryDuplicateLabel: 'Duplicate groups',
  summaryMalformedLabel: 'Malformed lines',
  summaryWarningsLabel: 'Warnings',
  missingSectionTitle: 'Missing required keys',
  missingSubtitle: 'Only template keys without default values are counted as missing.',
  missingEmptyLabel: 'No required template keys are missing across the loaded environments.',
  duplicateSectionTitle: 'Duplicate keys',
  duplicateSubtitle: 'Duplicate keys remain visible in the template and in every environment file.',
  malformedSectionTitle: 'Malformed lines',
  malformedSubtitle: 'Only valid assignments participate in parity checks.',
  warningsSectionTitle: 'Warnings',
  warningsSubtitle:
    'Undocumented keys, whitespace issues, and explicit empty string literals stay separate from hard validation errors.',
  templateHelperText: (comparison) =>
    `${comparison.template.requiredKeys.length} required keys without defaults. ${comparison.template.defaultedKeys.length} template defaults will not count as missing.`,
  isPreferredTemplateFilename: envTemplateMatcher,
  getEnvironmentFilename: (index) =>
    envPageConfig.environmentFilenameSuggestions[index - 1] ?? `.env.extra-${index}`,
  getDefaultEnvironmentDownloadName: (label) => `.env.${label.replace(/\s+/g, '_')}`,
  parse: parseEnv,
  compare: compareEnvFiles,
  buildReport: buildPlainTextReport,
};

export const propertiesPageConfig: ValidatorPageConfig = {
  id: 'properties',
  routePath: '/properties-file-validator',
  title: 'Properties File Validator - Compare .properties Files Against a Template',
  description:
    'Validate application.properties, application-dev.properties, application-qa.properties, and application-prod.properties against a reference template. Find missing keys, extra keys, duplicates, malformed lines, and warnings in the browser.',
  canonicalUrl: `${SITE_URL}/properties-file-validator`,
  ogImageUrl: SHARED_OG_IMAGE,
  softwareApplicationName: 'Properties File Validator',
  heroTitle: 'Validate multiple `.properties` files against one `application.properties` reference file.',
  heroLede:
    'Check whether `application-dev.properties`, `application-qa.properties`, and `application-prod.properties` match the keys in `application.properties`.',
  faqHeading: 'How this properties file validator works',
  faqItems: [
    {
      question: 'Does this tool upload any .properties files?',
      answer: 'No. Parsing, validation, and comparison all happen locally in the browser.',
    },
    {
      question: 'Can I compare multiple .properties files against one reference file?',
      answer:
        'Yes. Upload or drag in a full set like application.properties, application-dev.properties, application-qa.properties, and application-prod.properties, and the validator will compare every runtime file against the reference file.',
    },
    {
      question: 'What counts as a missing property?',
      answer:
        'Every key documented in the reference file is treated as part of the expected contract, even when that reference file includes a default value.',
    },
    {
      question: 'Are duplicate and malformed lines validated in the template too?',
      answer:
        'Yes. Duplicate keys and malformed lines stay visible in the template and in every compared .properties file.',
    },
    {
      question: 'Which .properties syntax is supported?',
      answer:
        'The validator covers common Java properties syntax: key=value, key:value, whitespace separators, comment lines starting with # or !, and continuation lines with a trailing backslash.',
    },
    {
      question: 'What does Quick Fix change?',
      answer:
        'Quick Fix removes malformed property lines, collapses duplicate keys so the last valid value wins, and normalizes line endings and extra spacing. It does not add missing properties or move undocumented properties into the reference file.',
    },
  ],
  demoTemplate: `# Shared application template
app.name=Env Validator
server.port=8080
db.url=
db.user=
db.password=
feature.newHome=false
banner.message=Welcome \\
  team
`,
  demoEnvironmentTexts: [
    `# Development config
app.name=Env Validator Dev
server.port=8081
db.url=jdbc:postgresql://localhost:5432/envvalidator
db.user=dev_user
db.password=
feature.experimental=true
db.url=jdbc:postgresql://localhost:6432/envvalidator
=broken
banner.message=Welcome \\
  local team
`,
    `! QA config
app.name=Env Validator QA
server.port=
db.url=jdbc:postgresql://qa-db.internal:5432/envvalidator
db.user=qa_user
db.password=
feature.newHome=true
banner.message=Welcome \\
  qa team
`,
    `# Production config
app.name=Env Validator
db.url=jdbc:postgresql://prod-db.internal:5432/envvalidator
db.user=prod_user
db.password=prod_secret
feature.newHome=false
banner.message=Welcome \\
  production team
`,
  ],
  demoEnvironmentFilenames: [
    'application-dev.properties',
    'application-qa.properties',
    'application-prod.properties',
  ],
  templateDefaultName: 'application.properties',
  environmentFilenameSuggestions: [
    'application-dev.properties',
    'application-qa.properties',
    'application-prod.properties',
    'application-local.properties',
    'config-dev.properties',
  ],
  fileInputAccept: '.properties,text/plain',
  templateUploadLabel: 'Upload',
  bulkUploadLabel: 'Upload all your .properties files',
  workspaceHint: 'Drag multiple properties files here.',
  templatePlaceholder: 'app.name=Env Validator',
  environmentPlaceholder: 'app.name=Env Validator Dev',
  emptyStateTitle: 'Paste or upload a template and at least one properties file to start.',
  emptyStateBody:
    'Add more widgets with the plus button if you want to compare development, QA, and production property files against the same reference template.',
  noIssuesTitle: 'No issues detected.',
  noIssuesBody: 'The loaded template and properties files are aligned.',
  summaryEnvironmentCountLabel: 'Files',
  summaryMissingLabel: 'Missing properties',
  summaryUndocumentedLabel: 'Extra properties',
  summaryDuplicateLabel: 'Duplicate groups',
  summaryMalformedLabel: 'Malformed lines',
  summaryWarningsLabel: 'Warnings',
  missingSectionTitle: 'Missing properties',
  missingSubtitle: 'All template keys are counted as part of the reference contract.',
  missingEmptyLabel: 'No documented properties are missing across the loaded files.',
  duplicateSectionTitle: 'Duplicate properties',
  duplicateSubtitle:
    'Duplicate properties remain visible in the template and in every compared file.',
  malformedSectionTitle: 'Malformed property lines',
  malformedSubtitle: 'Only valid property assignments participate in parity checks.',
  warningsSectionTitle: 'Warnings',
  warningsSubtitle:
    'Undocumented properties and empty runtime values stay separate from hard validation errors.',
  templateHelperText: (comparison) =>
    `${comparison.template.requiredKeys.length} properties are documented in the reference file. ${comparison.template.defaultedKeys.length} of them already include default values.`,
  isPreferredTemplateFilename: propertiesTemplateMatcher,
  getEnvironmentFilename: (index) =>
    propertiesPageConfig.environmentFilenameSuggestions[index - 1] ??
    `application-extra-${index}.properties`,
  getDefaultEnvironmentDownloadName: (label) =>
    `${toKebabFileStem(label)}.properties`,
  parse: parseProperties,
  compare: comparePropertiesFiles,
  buildReport: buildPlainTextReport,
};

export function getActiveValidatorPage(pathname: string): ValidatorPageConfig {
  return pathname.startsWith(propertiesPageConfig.routePath)
    ? propertiesPageConfig
    : envPageConfig;
}
