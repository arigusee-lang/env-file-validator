import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type WheelEvent,
} from 'react';
import { AdSlot } from './components/AdSlot';
import {
  EnvTextEditor,
  type EditorHoverTarget,
  type EditorLineInteraction,
  type EditorTooltipDetail,
} from './components/EnvTextEditor';
import {
  type DuplicateGroup,
  type EnvironmentCompareResult,
  type LineIssue,
  type ParsedEnvFile,
} from './features/envCompare';
import {
  canQuickFixPropertiesText,
  quickFixPropertiesText,
} from './features/propertiesCompare';
import {
  getActiveValidatorPage,
  type ValidatorPageConfig,
} from './validatorPageConfig';
import { StaticPage } from './StaticPage';
import { getStaticPage } from './staticPageConfig';

type ThemeMode = 'light' | 'dark';
type FullscreenLayoutMode = 'grid' | 'row';
type FullscreenResizer =
  | {
      kind: 'grid-column';
    }
  | {
      kind: 'grid-row';
    }
  | {
      kind: 'row-column';
      index: number;
    }
  | null;

type EnvironmentTab = {
  id: string;
  label: string;
  filename: string;
  loadedName?: string;
  text: string;
};

type DropState =
  | {
      kind: 'idle';
    }
  | {
      kind: 'single-template';
    }
  | {
      kind: 'single-environment';
      environmentId: string;
    }
  | {
      kind: 'bulk';
      message: string;
    }
  | {
      kind: 'bulk-invalid';
      message: string;
    };

type HoverTarget = EditorHoverTarget;

type ResultTitleHighlights = {
  field?: string;
  targets?: string;
};

type ResultItem = {
  id: string;
  title: string;
  meta: string;
  tone?: 'default' | 'danger' | 'warning';
  titleHighlights?: ResultTitleHighlights;
  metaHighlights?: string[];
  badges?: string[];
  hover?: HoverTarget;
};

type GroupedEnvironmentResult = {
  filename: string;
  lines: number[];
};

declare global {
  interface Window {
    googlefc?: {
      callbackQueue?: Array<Record<string, () => void>>;
      showRevocationMessage?: () => void;
    };
  }
}

function getCurrentPathname() {
  return typeof window === 'undefined' ? '/' : window.location.pathname;
}

function upsertMeta(
  selector: string,
  attribute: 'name' | 'property',
  key: string,
  content: string,
) {
  let element = document.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.content = content;
}

function setMetadata(pageConfig: ValidatorPageConfig) {
  document.title = pageConfig.title;

  let description = document.querySelector<HTMLMetaElement>(
    'meta[name="description"]',
  );

  if (!description) {
    description = document.createElement('meta');
    description.name = 'description';
    document.head.appendChild(description);
  }

  description.content = pageConfig.description;

  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }

  canonical.href = pageConfig.canonicalUrl;

  upsertMeta('meta[property="og:title"]', 'property', 'og:title', pageConfig.title);
  upsertMeta('meta[property="og:description"]', 'property', 'og:description', pageConfig.description);
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', pageConfig.canonicalUrl);
  upsertMeta('meta[property="og:image"]', 'property', 'og:image', pageConfig.ogImageUrl);
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', pageConfig.title);
  upsertMeta(
    'meta[name="twitter:description"]',
    'name',
    'twitter:description',
    pageConfig.description,
  );
  upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', pageConfig.ogImageUrl);
}

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

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function getEnvironmentFilename(index: number, pageConfig: ValidatorPageConfig) {
  return pageConfig.getEnvironmentFilename(index);
}

function createEnvironment(
  index: number,
  pageConfig: ValidatorPageConfig,
  text = '',
  loadedName?: string,
): EnvironmentTab {
  return {
    id: makeId('env'),
    label: `Environment ${index}`,
    filename: loadedName ?? getEnvironmentFilename(index, pageConfig),
    loadedName,
    text,
  };
}

function getEnvironmentDisplayName(environment: EnvironmentTab) {
  return environment.loadedName ?? environment.label;
}

function resequenceEnvironments(
  environments: EnvironmentTab[],
  pageConfig: ValidatorPageConfig,
) {
  return environments.map((environment, index) => ({
    ...environment,
    label: `Environment ${index + 1}`,
    filename: environment.loadedName ?? getEnvironmentFilename(index + 1, pageConfig),
  }));
}

function isPreferredTemplateFilename(filename: string, pageConfig: ValidatorPageConfig) {
  return pageConfig.isPreferredTemplateFilename(filename);
}

function hasDraggedFiles(event: DragEvent<HTMLElement>) {
  const items = Array.from(event.dataTransfer?.items ?? []);

  if (items.length > 0) {
    return items.some((item) => item.kind === 'file');
  }

  return (event.dataTransfer?.files?.length ?? 0) > 0;
}

function getDraggedFileCount(event: DragEvent<HTMLElement>) {
  const itemCount = Array.from(event.dataTransfer?.items ?? []).filter(
    (item) => item.kind === 'file',
  ).length;

  if (itemCount > 0) {
    return itemCount;
  }

  return event.dataTransfer?.files?.length ?? 0;
}

async function readDroppedFiles(files: File[]) {
  return Promise.all(
    files.map(async (file) => ({
      file,
      text: await file.text(),
    })),
  );
}

function canScrollVertically(element: HTMLElement, deltaY: number) {
  if (deltaY < 0) {
    return element.scrollTop > 0;
  }

  if (deltaY > 0) {
    return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }

  return false;
}

function getNormalizedTrackPercents(weights: number[], count: number) {
  const fallbackWeight = 100 / Math.max(count, 1);
  const activeWeights = Array.from({ length: count }, (_, index) =>
    Math.max(weights[index] ?? fallbackWeight, 1),
  );
  const total = activeWeights.reduce((sum, weight) => sum + weight, 0) || count;

  return activeWeights.map((weight) => (weight / total) * 100);
}

function buildResizableTrackTemplate(weights: number[]) {
  return weights
    .flatMap((weight, index) =>
      index < weights.length - 1
        ? [`minmax(0, ${weight}fr)`, '12px']
        : [`minmax(0, ${weight}fr)`],
    )
    .join(' ');
}

function groupIssuesByLine(issues: LineIssue[]) {
  const issuesByLine = new Map<number, LineIssue[]>();

  issues.forEach((issue) => {
    const existing = issuesByLine.get(issue.lineNumber) ?? [];
    existing.push(issue);
    issuesByLine.set(issue.lineNumber, existing);
  });

  return issuesByLine;
}

function formatLineNumbers(lines: number[]) {
  return `${lines.length > 1 ? 'lines' : 'line'} ${lines.join(', ')}`;
}

function buildHoverTarget(
  template: number[] = [],
  environments?: Record<string, number[]>,
): HoverTarget {
  const normalizedEnvironments =
    environments && Object.keys(environments).length > 0 ? environments : undefined;

  return {
    template,
    environments: normalizedEnvironments,
  };
}

function buildTooltipDetails(
  issues: LineIssue[],
  relatedLocations: string[],
): EditorTooltipDetail[] {
  const details: EditorTooltipDetail[] = Array.from(
    new Map<string, EditorTooltipDetail>(
      issues.map((issue) => [
        `${issue.severity}-${issue.message}`,
        {
          tone: issue.severity === 'error' ? 'error' : 'warning',
          label: issue.severity === 'error' ? 'Error' : 'Warning',
          text: issue.message,
        } satisfies EditorTooltipDetail,
      ]),
    ).values(),
  );

  if (relatedLocations.length > 0) {
    details.push({
      tone: 'linked',
      label: 'Linked',
      text: relatedLocations.join('; '),
    });
  }

  return details;
}

function getEnvironmentStatusTone(environment?: EnvironmentCompareResult) {
  if (!environment) {
    return null;
  }

  if (
    environment.summary.missingRequiredKeys > 0 ||
    environment.summary.duplicateGroups > 0 ||
    environment.summary.malformedLines > 0
  ) {
    return 'danger';
  }

  if (
    environment.summary.warningCount > 0 ||
    environment.summary.undocumentedKeys > 0
  ) {
    return 'warning';
  }

  return 'success';
}

function groupEnvironmentItems(
  items: Array<{
    groupKey: string;
    filename: string;
    lineNumber?: number;
    buildTitle: (filenames: string[]) => string;
    buildTitleHighlights?: (filenames: string[]) => ResultTitleHighlights;
    buildMeta: (environments: GroupedEnvironmentResult[]) => string;
    buildMetaHighlights?: (environments: GroupedEnvironmentResult[]) => string[];
    tone: ResultItem['tone'];
  }>,
) {
  const groups = new Map<
    string,
    {
      filename: string;
      lineNumbers: Set<number>;
      buildTitle: (filenames: string[]) => string;
      buildTitleHighlights?: (filenames: string[]) => ResultTitleHighlights;
      buildMeta: (environments: GroupedEnvironmentResult[]) => string;
      buildMetaHighlights?: (environments: GroupedEnvironmentResult[]) => string[];
      tone: ResultItem['tone'];
    }[]
  >();

  items.forEach((item) => {
    const existing = groups.get(item.groupKey) ?? [];
    const match = existing.find((group) => group.filename === item.filename);

    if (match) {
      if (item.lineNumber) {
        match.lineNumbers.add(item.lineNumber);
      }
    } else {
      existing.push({
        filename: item.filename,
        lineNumbers: new Set(item.lineNumber ? [item.lineNumber] : []),
        buildTitle: item.buildTitle,
        buildTitleHighlights: item.buildTitleHighlights,
        buildMeta: item.buildMeta,
        buildMetaHighlights: item.buildMetaHighlights,
        tone: item.tone,
      });
      groups.set(item.groupKey, existing);
    }
  });

  return Array.from(groups.entries()).map(([groupKey, environments]) => {
    const normalizedEnvironments = environments
      .map((environment) => ({
        filename: environment.filename,
        lines: Array.from(environment.lineNumbers).sort((left, right) => left - right),
      }));
    const filenames = normalizedEnvironments.map((environment) => environment.filename);
    const [firstEnvironment] = environments;

    return {
      id: groupKey,
      title: firstEnvironment.buildTitle(filenames),
      titleHighlights: firstEnvironment.buildTitleHighlights?.(filenames),
      meta: firstEnvironment.buildMeta(normalizedEnvironments),
      metaHighlights: firstEnvironment.buildMetaHighlights?.(normalizedEnvironments),
      tone: firstEnvironment.tone,
    } satisfies ResultItem;
  });
}

function toLineMap(parsed: ParsedEnvFile) {
  const linesByKey = new Map<string, number[]>();

  parsed.lines.forEach((line) => {
    if (line.kind !== 'assignment' && line.kind !== 'continuation') {
      return;
    }

    const existing = linesByKey.get(line.normalizedKey) ?? [];
    existing.push(line.lineNumber);
    linesByKey.set(line.normalizedKey, existing);
  });

  return linesByKey;
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getDownloadFilename(
  filename: string | undefined,
  fallbackLabel: string,
  defaultFilename: string,
) {
  if (filename && filename.trim().length > 0) {
    return filename;
  }

  return defaultFilename ?? `.env.${fallbackLabel.replace(/\s+/g, '_')}`;
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'danger' | 'warning' | 'success';
}) {
  return (
    <div className={`summary-card summary-card--${tone}`}>
      <span className="summary-card__value">{value}</span>
      <span className="summary-card__label">{label}</span>
    </div>
  );
}

function IconButton({
  label,
  title,
  onClick,
  disabled = false,
  className = '',
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`.trim()}
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ResultSection({
  title,
  subtitle,
  items,
  emptyLabel,
  count,
  tone = 'default',
}: {
  title: string;
  subtitle: string;
  items: ResultItem[];
  emptyLabel: string;
  count: number;
  tone?: 'default' | 'danger' | 'warning';
}) {
  return (
    <section className={`panel panel--stacked panel--${tone}`}>
      <div className="panel__header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span className={`panel__count panel__count--${tone}`}>{count}</span>
      </div>
      {items.length === 0 ? (
        <div className="panel__empty">{emptyLabel}</div>
      ) : (
        <ul className="issue-list">
          {items.map((item) => (
            <li key={item.id} className={`issue-row issue-row--${item.tone ?? 'default'}`}>
              <div className="issue-row__body">
                <div className="issue-row__topline">
                  <strong>{renderIssueTitle(item)}</strong>
                  {item.badges?.length ? (
                    <div className="issue-row__badges">
                      {item.badges.map((badge) => (
                        <span key={badge} className="issue-badge">
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <p>{renderIssueMeta(item)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function renderIssueTitle(item: ResultItem) {
  return renderHighlightedText(item.title, [
    {
      value: item.titleHighlights?.field,
      className: 'issue-title__field',
      key: 'field',
    },
    {
      value: item.titleHighlights?.targets,
      className: 'issue-title__targets',
      key: 'targets',
    },
  ]);
}

function renderIssueMeta(item: ResultItem) {
  return renderHighlightedText(
    item.meta,
    (item.metaHighlights ?? []).map((value, index) => ({
      value,
      className: 'issue-meta__target',
      key: `meta-${index}`,
    })),
  );
}

function renderHighlightedText(
  text: string,
  highlights: Array<{
    value?: string;
    className: string;
    key: string;
  }>,
) {
  const activeHighlights = highlights.filter(
    (highlight): highlight is { value: string; className: string; key: string } =>
      Boolean(highlight.value),
  );

  if (activeHighlights.length === 0) {
    return text;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  activeHighlights.forEach((highlight) => {
    const index = text.indexOf(highlight.value, cursor);

    if (index === -1) {
      return;
    }

    if (index > cursor) {
      parts.push(text.slice(cursor, index));
    }

    parts.push(
      <span key={highlight.key} className={highlight.className}>
        {highlight.value}
      </span>,
    );
    cursor = index + highlight.value.length;
  });

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts.length > 0 ? parts : text;
}

function buildTemplateDuplicateItems(groups: DuplicateGroup[]): ResultItem[] {
  return groups.map((group) => ({
    id: `template-duplicate-${group.key}-${group.lines.join('-')}`,
    title: `${group.key} is duplicated in the template`,
    meta: `Reference file lines ${group.lines.join(', ')}. Last valid value still wins during parsing.`,
    tone: 'danger',
    titleHighlights: {
      field: group.key,
    },
    hover: buildHoverTarget(group.lines),
  }));
}

function buildTemplateIssueItems(issues: LineIssue[]): ResultItem[] {
  return issues.map((issue) => ({
    id: `template-issue-${issue.code}-${issue.lineNumber}-${issue.key ?? 'line'}`,
    title: issue.key
      ? `${issue.key} needs attention in the template`
      : `Template line ${issue.lineNumber} needs attention`,
    meta: `Reference file line ${issue.lineNumber}. ${issue.message}`,
    tone: issue.severity === 'error' ? 'danger' : 'warning',
    titleHighlights: issue.key
      ? {
          field: issue.key,
        }
      : undefined,
    hover: buildHoverTarget([issue.lineNumber]),
  }));
}

function buildEnvironmentDuplicateItems(
  environments: EnvironmentCompareResult[],
): ResultItem[] {
  return groupEnvironmentItems(
    environments.flatMap((environment) =>
      environment.duplicateKeys.flatMap((group) =>
        group.lines.map((lineNumber) => ({
          groupKey: `duplicate-${group.key}`,
          filename: environment.filename,
          lineNumber,
          buildTitle: (filenames) => `${group.key} is duplicated in ${filenames.join(', ')}`,
          buildTitleHighlights: (filenames) => ({
            field: group.key,
            targets: filenames.join(', '),
          }),
          buildMeta: (groupedEnvironments) =>
            groupedEnvironments
              .map((entry) => `${entry.filename} ${formatLineNumbers(entry.lines)}`)
              .join('; '),
          buildMetaHighlights: (groupedEnvironments) =>
            groupedEnvironments.map((entry) => entry.filename),
          tone: 'danger' as const,
        })),
      ),
    ),
  );
}

function buildEnvironmentMalformedItems(
  environments: EnvironmentCompareResult[],
): ResultItem[] {
  return groupEnvironmentItems(
    environments.flatMap((environment) =>
      environment.malformedLines.map((issue) => ({
        groupKey: `malformed-${issue.code}-${issue.key ?? issue.raw}-${issue.message}`,
        filename: environment.filename,
        lineNumber: issue.lineNumber,
        buildTitle: (filenames) =>
          issue.key
            ? `${issue.key} is malformed in ${filenames.join(', ')}`
            : `Malformed line in ${filenames.join(', ')}`,
        buildTitleHighlights: (filenames) => ({
          field: issue.key,
          targets: filenames.join(', '),
        }),
        buildMeta: (groupedEnvironments) =>
          `${issue.message} ${groupedEnvironments
            .map((entry) => `${entry.filename} ${formatLineNumbers(entry.lines)}`)
            .join('; ')}`,
        buildMetaHighlights: (groupedEnvironments) =>
          groupedEnvironments.map((entry) => entry.filename),
        tone: 'danger' as const,
      })),
    ),
  );
}

function buildEnvironmentWarningItems(
  environments: EnvironmentCompareResult[],
): ResultItem[] {
  return groupEnvironmentItems(
    environments.flatMap((environment) =>
      environment.warnings.map((issue) => ({
        groupKey: `warning-${issue.code}-${issue.key ?? issue.raw}-${issue.message}`,
        filename: environment.filename,
        lineNumber: issue.lineNumber,
        buildTitle: (filenames) =>
          issue.key
            ? `${issue.key} has warnings in ${filenames.join(', ')}`
            : `Warnings in ${filenames.join(', ')}`,
        buildTitleHighlights: (filenames) => ({
          field: issue.key,
          targets: filenames.join(', '),
        }),
        buildMeta: (groupedEnvironments) =>
          `${issue.message} ${groupedEnvironments
            .map((entry) => `${entry.filename} ${formatLineNumbers(entry.lines)}`)
            .join('; ')}`,
        buildMetaHighlights: (groupedEnvironments) =>
          groupedEnvironments.map((entry) => entry.filename),
        tone: 'warning' as const,
      })),
    ),
  );
}

function ValidatorApp({ pageConfig }: { pageConfig: ValidatorPageConfig }) {
  const [initialEnvironment] = useState<EnvironmentTab>(() => createEnvironment(1, pageConfig));
  const fullscreenGridRef = useRef<HTMLDivElement>(null);
  const fullscreenRowRef = useRef<HTMLDivElement>(null);
  const workspaceModalRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [templateText, setTemplateText] = useState('');
  const [templateLoadedName, setTemplateLoadedName] = useState<string | null>(null);
  const [environments, setEnvironments] = useState<EnvironmentTab[]>(() => [initialEnvironment]);
  const [renamingEnvironmentId, setRenamingEnvironmentId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [hoveredLines, setHoveredLines] = useState<HoverTarget>(() => buildHoverTarget());
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const [isPrivacyChoicesAvailable, setIsPrivacyChoicesAvailable] = useState(false);
  const [fullscreenLayout, setFullscreenLayout] = useState<FullscreenLayoutMode>('grid');
  const [fullscreenColumnRatio, setFullscreenColumnRatio] = useState(50);
  const [fullscreenRowRatio, setFullscreenRowRatio] = useState(50);
  const [fullscreenRowColumnRatios, setFullscreenRowColumnRatios] = useState([
    25,
    25,
    25,
    25,
  ]);
  const [activeFullscreenResizer, setActiveFullscreenResizer] =
    useState<FullscreenResizer>(null);
  const [dropState, setDropState] = useState<DropState>({ kind: 'idle' });

  function setStatusMessage(...messages: unknown[]) {
    void messages;
  }

  useEffect(() => {
    setMetadata(pageConfig);
  }, [pageConfig]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('env-validator-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
    window.googlefc.callbackQueue.push({
      CONSENT_API_READY: () => {
        setIsPrivacyChoicesAvailable(
          typeof window.googlefc?.showRevocationMessage === 'function',
        );
      },
    });
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = isWorkspaceExpanded ? 'hidden' : '';
    document.body.style.overflow = isWorkspaceExpanded ? 'hidden' : '';

    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isWorkspaceExpanded]);

  useEffect(() => {
    const currentResizer = activeFullscreenResizer;
    const resizeModeMatchesLayout =
      currentResizer?.kind === 'row-column'
        ? fullscreenLayout === 'row'
        : fullscreenLayout === 'grid';

    if (!isWorkspaceExpanded || !currentResizer || !resizeModeMatchesLayout) {
      document.documentElement.style.cursor = '';
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const resizer = currentResizer;

      if (!resizer) {
        return;
      }

      if (resizer.kind === 'grid-column') {
        const rect = fullscreenGridRef.current?.getBoundingClientRect();

        if (!rect) {
          return;
        }

        const nextRatio = ((event.clientX - rect.left) / rect.width) * 100;
        setFullscreenColumnRatio(Math.min(75, Math.max(25, nextRatio)));
        return;
      }

      if (resizer.kind === 'grid-row') {
        const rect = fullscreenGridRef.current?.getBoundingClientRect();

        if (!rect) {
          return;
        }

        const nextRatio = ((event.clientY - rect.top) / rect.height) * 100;
        setFullscreenRowRatio(Math.min(72, Math.max(28, nextRatio)));
        return;
      }

      const rect = fullscreenRowRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const widgetCount = environments.length + 1;
      const minTrackPercent = widgetCount >= 4 ? 10 : widgetCount === 3 ? 14 : 18;
      const pointerPercent = ((event.clientX - rect.left) / rect.width) * 100;

      setFullscreenRowColumnRatios((current) => {
        const currentPercents = getNormalizedTrackPercents(current, widgetCount);
        const leadingPercent = currentPercents
          .slice(0, resizer.index)
          .reduce((sum, value) => sum + value, 0);
        const currentPairWidth = currentPercents[resizer.index] + currentPercents[resizer.index + 1];
        const nextLeadingWidth = Math.min(
          currentPairWidth - minTrackPercent,
          Math.max(minTrackPercent, pointerPercent - leadingPercent),
        );
        const nextTrailingWidth = currentPairWidth - nextLeadingWidth;
        const next = [...current];

        for (let index = 0; index < widgetCount; index += 1) {
          next[index] = currentPercents[index];
        }

        next[resizer.index] = nextLeadingWidth;
        next[resizer.index + 1] = nextTrailingWidth;

        return next;
      });
    }

    function handlePointerUp() {
      setActiveFullscreenResizer(null);
    }

    document.documentElement.style.cursor =
      currentResizer?.kind === 'grid-row' ? 'row-resize' : 'col-resize';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.documentElement.style.cursor = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    activeFullscreenResizer,
    environments.length,
    fullscreenLayout,
    isWorkspaceExpanded,
  ]);

  const parsedTemplate = pageConfig.parse(templateText, 'template');
  const templateLinesByKey = toLineMap(parsedTemplate);
  const parsedEnvironments = environments.map((environment) => {
    const parsed = pageConfig.parse(environment.text, 'env');

    return {
      ...environment,
      parsed,
      linesByKey: toLineMap(parsed),
    };
  });

  const comparison = pageConfig.compare(
    parsedTemplate,
    parsedEnvironments.map((environment) => ({
      id: environment.id,
      label: environment.label,
      filename: environment.filename,
      parsed: environment.parsed,
    })),
  );
  const comparisonByEnvironmentId = new Map(
    comparison.environments.map((environment) => [environment.id, environment]),
  );
  const canQuickFixAllProperties =
    pageConfig.id === 'properties' &&
    (canQuickFixPropertiesText(templateText, parsedTemplate) ||
      parsedEnvironments.some((environment) =>
        canQuickFixPropertiesText(environment.text, environment.parsed),
      ));
  const report = pageConfig.buildReport(comparison);
  const templateIssuesByLine = groupIssuesByLine(parsedTemplate.issues);
  const environmentIssuesByLine = new Map(
    parsedEnvironments.map((environment) => [
      environment.id,
      groupIssuesByLine(environment.parsed.issues),
    ]),
  );

  function getEnvironmentLinesForKey(normalizedKey: string) {
    return parsedEnvironments.reduce<Record<string, number[]>>((accumulator, environment) => {
      const lines = environment.linesByKey.get(normalizedKey);

      if (lines && lines.length > 0) {
        accumulator[environment.id] = lines;
      }

      return accumulator;
    }, {});
  }

  function getKeyHoverTarget(normalizedKey: string) {
    return buildHoverTarget(
      templateLinesByKey.get(normalizedKey) ?? [],
      getEnvironmentLinesForKey(normalizedKey),
    );
  }

  function getRelatedLocationsForKey(
    normalizedKey: string,
    source: 'template' | 'env',
    lineNumber: number,
    environmentId?: string,
  ) {
    const relatedLocations: string[] = [];
    const templateLines = templateLinesByKey.get(normalizedKey) ?? [];
    const templateLabel = templateLoadedName ?? pageConfig.templateDefaultName;
    const relevantTemplateLines =
      source === 'template'
        ? templateLines.filter((currentLine) => currentLine !== lineNumber)
        : templateLines;

    if (relevantTemplateLines.length > 0) {
      relatedLocations.push(`${templateLabel} ${formatLineNumbers(relevantTemplateLines)}`);
    }

    parsedEnvironments.forEach((environment) => {
      const environmentLines = environment.linesByKey.get(normalizedKey) ?? [];
      const relevantEnvironmentLines =
        source === 'env' && environment.id === environmentId
          ? environmentLines.filter((currentLine) => currentLine !== lineNumber)
          : environmentLines;

      if (relevantEnvironmentLines.length > 0) {
        relatedLocations.push(
          `${environment.loadedName ?? environment.filename} ${formatLineNumbers(
            relevantEnvironmentLines,
          )}`,
        );
      }
    });

    return relatedLocations;
  }

  function buildTemplateLineInteractions() {
    const interactions = new Map<number, EditorLineInteraction>();

    parsedTemplate.lines.forEach((line) => {
      const lineIssues = templateIssuesByLine.get(line.lineNumber) ?? [];
      const relatedLocations =
        line.kind === 'assignment' || line.kind === 'continuation'
          ? getRelatedLocationsForKey(line.normalizedKey, 'template', line.lineNumber)
          : [];

      if (lineIssues.length === 0 && relatedLocations.length === 0) {
        return;
      }

      const hover =
        line.kind === 'assignment' || line.kind === 'continuation'
          ? getKeyHoverTarget(line.normalizedKey)
          : buildHoverTarget([line.lineNumber]);

      interactions.set(line.lineNumber, {
        details: buildTooltipDetails(lineIssues, relatedLocations),
        hover,
      });
    });

    return interactions;
  }

  function buildEnvironmentLineInteractions() {
    return new Map<string, Map<number, EditorLineInteraction>>(
      parsedEnvironments.map((environment) => {
        const interactions = new Map<number, EditorLineInteraction>();
        const issuesByLine =
          environmentIssuesByLine.get(environment.id) ?? new Map<number, LineIssue[]>();

        environment.parsed.lines.forEach((line) => {
          const lineIssues = issuesByLine.get(line.lineNumber) ?? [];
          const relatedLocations =
            line.kind === 'assignment' || line.kind === 'continuation'
              ? getRelatedLocationsForKey(
                  line.normalizedKey,
                  'env',
                  line.lineNumber,
                  environment.id,
                )
              : [];

          if (lineIssues.length === 0 && relatedLocations.length === 0) {
            return;
          }

          const hover =
            line.kind === 'assignment' || line.kind === 'continuation'
              ? getKeyHoverTarget(line.normalizedKey)
              : buildHoverTarget([], {
                  [environment.id]: [line.lineNumber],
                });

          interactions.set(line.lineNumber, {
            details: buildTooltipDetails(lineIssues, relatedLocations),
            hover,
          });
        });

        return [environment.id, interactions];
      }),
    );
  }

  function buildEnvironmentStatusInteraction(environmentId: string) {
    const environment = comparisonByEnvironmentId.get(environmentId);

    if (!environment) {
      return {
        details: [],
        hover: buildHoverTarget(),
      };
    }

    const templateLineSet = new Set<number>();
    const environmentLineSet = new Set<number>();
    const details: EditorTooltipDetail[] = [];

    environment.missingRequiredKeys.forEach((item) => {
      details.push({
        tone: 'error',
        label: 'Error',
        text: `Missing required: ${item.key}`,
      });
      templateLineSet.add(item.templateLineNumber);
    });

    environment.duplicateKeys.forEach((group) => {
      details.push({
        tone: 'error',
        label: 'Error',
        text: `Duplicate: ${group.key}`,
      });
      group.lines.forEach((line) => {
        environmentLineSet.add(line);
      });
      const linkedLocations = getRelatedLocationsForKey(
        group.key,
        'env',
        group.lines[0] ?? 0,
        environmentId,
      );

      if (linkedLocations.length > 0) {
        (templateLinesByKey.get(group.key) ?? []).forEach((line) => {
          templateLineSet.add(line);
        });
      }
    });

    environment.malformedLines.forEach((issue) => {
      details.push({
        tone: 'error',
        label: 'Error',
        text: `${issue.key ?? 'Line'} malformed on line ${issue.lineNumber}: ${issue.message}`,
      });
      environmentLineSet.add(issue.lineNumber);

      if (issue.key) {
        const linkedLocations = getRelatedLocationsForKey(
          issue.key,
          'env',
          issue.lineNumber,
          environmentId,
        );

        if (linkedLocations.length > 0) {
          (templateLinesByKey.get(issue.key) ?? []).forEach((line) => {
            templateLineSet.add(line);
          });
        }
      }
    });

    environment.undocumentedKeys.forEach((item) => {
      details.push({
        tone: 'warning',
        label: 'Warning',
        text: `Undocumented: ${item.key}`,
      });
      environmentLineSet.add(item.envLineNumber);
    });

    environment.warnings.forEach((issue) => {
      details.push({
        tone: 'warning',
        label: 'Warning',
        text: `${issue.key ?? 'Line'} warning on line ${issue.lineNumber}: ${issue.message}`,
      });
      environmentLineSet.add(issue.lineNumber);

      if (issue.key) {
        const linkedLocations = getRelatedLocationsForKey(
          issue.key,
          'env',
          issue.lineNumber,
          environmentId,
        );

        if (linkedLocations.length > 0) {
          (templateLinesByKey.get(issue.key) ?? []).forEach((line) => {
            templateLineSet.add(line);
          });
        }
      }
    });

    if (details.length === 0) {
      details.push({
        tone: 'warning',
        label: 'Warning',
                        text: 'No issues detected in this file.',
      });
    }

    return {
      details,
      hover: buildHoverTarget(
        Array.from(templateLineSet).sort((left, right) => left - right),
        environmentLineSet.size > 0
          ? {
              [environmentId]: Array.from(environmentLineSet).sort(
                (left, right) => left - right,
              ),
            }
          : undefined,
      ),
    };
  }

  const templateLineInteractions = buildTemplateLineInteractions();
  const environmentLineInteractions = buildEnvironmentLineInteractions();
  const hasAnyInput =
    templateText.trim().length > 0 ||
    environments.some((environment) => environment.text.trim().length > 0);

  const missingItems: ResultItem[] = groupEnvironmentItems(
    comparison.environments.flatMap((environment) =>
      environment.missingRequiredKeys.map((item) => ({
        groupKey: `missing-${item.normalizedKey}-${item.templateLineNumber}`,
        filename: environment.filename,
        buildTitle: (filenames) => `${item.key} is required in ${filenames.join(', ')}`,
        buildTitleHighlights: (filenames) => ({
          field: item.key,
          targets: filenames.join(', '),
        }),
        buildMeta: () => `Missing required key. Reference line ${item.templateLineNumber}.`,
        tone: 'danger' as const,
      })),
    ),
  );

  const undocumentedItems: ResultItem[] = groupEnvironmentItems(
    comparison.environments.flatMap((environment) =>
      environment.undocumentedKeys.map((item) => ({
        groupKey: `undocumented-${item.normalizedKey}`,
        filename: environment.filename,
        lineNumber: item.envLineNumber,
        buildTitle: (filenames) => `${item.key} is undocumented in ${filenames.join(', ')}`,
        buildTitleHighlights: (filenames) => ({
          field: item.key,
          targets: filenames.join(', '),
        }),
        buildMeta: (groupedEnvironments) =>
          groupedEnvironments
            .map((entry) => `${entry.filename} ${formatLineNumbers(entry.lines)}`)
            .join('; '),
        buildMetaHighlights: (groupedEnvironments) =>
          groupedEnvironments.map((entry) => entry.filename),
        tone: 'warning' as const,
      })),
    ),
  );

  const duplicateItems = [
    ...buildTemplateDuplicateItems(comparison.template.duplicateKeys),
    ...buildEnvironmentDuplicateItems(comparison.environments),
  ];
  const malformedItems = [
    ...buildTemplateIssueItems(comparison.template.malformedLines),
    ...buildEnvironmentMalformedItems(comparison.environments),
  ];
  const warningItems = [
    ...undocumentedItems,
    ...buildTemplateIssueItems(comparison.template.warnings),
    ...buildEnvironmentWarningItems(comparison.environments),
  ];
  const missingCount = comparison.summary.missingRequiredKeys;
  const duplicateCount =
    comparison.summary.duplicateGroupsInEnvironments +
    comparison.summary.duplicateGroupsInTemplate;
  const malformedCount =
    comparison.summary.malformedInEnvironments +
    comparison.summary.malformedInTemplate;
  const warningCount =
    comparison.summary.warningCount + comparison.summary.undocumentedKeys;

  const visibleResultSections = [
    {
      id: 'missing',
      preferredColumn: 'left' as const,
      count: missingCount,
      element: (
          <ResultSection
            title={pageConfig.missingSectionTitle}
            subtitle={pageConfig.missingSubtitle}
            items={missingItems}
            emptyLabel={pageConfig.missingEmptyLabel}
            count={missingCount}
            tone="danger"
          />
      ),
    },
    {
      id: 'duplicate',
      preferredColumn: 'left' as const,
      count: duplicateCount,
      element: (
          <ResultSection
            title={pageConfig.duplicateSectionTitle}
            subtitle={pageConfig.duplicateSubtitle}
            items={duplicateItems}
            emptyLabel="No duplicate keys were detected."
            count={duplicateCount}
          tone="danger"
        />
      ),
    },
    {
      id: 'malformed',
      preferredColumn: 'right' as const,
      count: malformedCount,
      element: (
          <ResultSection
            title={pageConfig.malformedSectionTitle}
            subtitle={pageConfig.malformedSubtitle}
            items={malformedItems}
            emptyLabel="No malformed lines were detected."
            count={malformedCount}
          tone="danger"
        />
      ),
    },
    {
      id: 'warnings',
      preferredColumn: 'right' as const,
      count: warningCount,
      element: (
          <ResultSection
            title={pageConfig.warningsSectionTitle}
            subtitle={pageConfig.warningsSubtitle}
            items={warningItems}
            emptyLabel="No warnings were detected."
            count={warningCount}
          tone="warning"
        />
      ),
    },
  ].filter((section) => section.count > 0);

  const resultColumns = visibleResultSections.reduce(
    (columns, section) => {
      if (columns.left.length === 0 && columns.right.length === 0) {
        columns.left.push(section);
        return columns;
      }

      if (section.preferredColumn === 'left') {
        columns.left.push(section);
        return columns;
      }

      if (columns.right.length === 0 && columns.left.length === 0) {
        columns.left.push(section);
        return columns;
      }

      columns.right.push(section);
      return columns;
    },
    {
      left: [] as typeof visibleResultSections,
      right: [] as typeof visibleResultSections,
    },
  );

  function handleHoverStart(hover?: HoverTarget) {
    setHoveredLines(hover ?? buildHoverTarget());
  }

  function applyTemplateFile(fileName: string, text: string) {
    startTransition(() => {
      setTemplateText(text);
      setTemplateLoadedName(fileName);
    });
    setStatusMessage(`${fileName} loaded as the reference template.`);
  }

  function applyEnvironmentFile(environmentId: string, fileName: string, text: string) {
    startTransition(() => {
      setEnvironments((current) =>
        current.map((environment) =>
          environment.id === environmentId
            ? {
                ...environment,
                text,
                filename: fileName,
                loadedName: fileName,
              }
            : environment,
        ),
      );
    });

    const environment = environments.find((item) => item.id === environmentId);
    setStatusMessage(`${fileName} loaded into ${environment?.label ?? 'environment file'}.`);
  }

  async function applyBulkFiles(files: File[]) {
    if (files.length > 4) {
      setDropState({
        kind: 'bulk-invalid',
        message: 'Up to 4 files only. Drop 4 or fewer files.',
      });
      setStatusMessage('You can drop or upload up to 4 files at once.');
      return;
    }

    const fileEntries = await readDroppedFiles(files);
    const templateIndex = fileEntries.findIndex((entry) =>
      isPreferredTemplateFilename(entry.file.name, pageConfig),
    );
    const selectedTemplateIndex = templateIndex >= 0 ? templateIndex : 0;
    const templateEntry = fileEntries[selectedTemplateIndex];
    const environmentEntries = fileEntries
      .filter((_, index) => index !== selectedTemplateIndex)
      .slice(0, 3);

    startTransition(() => {
      setTemplateText(templateEntry?.text ?? '');
      setTemplateLoadedName(templateEntry?.file.name ?? null);

      const nextEnvironments =
        environmentEntries.length > 0
          ? environmentEntries.map((entry, index) =>
              createEnvironment(index + 1, pageConfig, entry.text, entry.file.name),
            )
          : [createEnvironment(1, pageConfig)];

      setEnvironments(nextEnvironments);
    });

    setDropState({ kind: 'idle' });
    setStatusMessage(`Loaded ${fileEntries.length} file${fileEntries.length === 1 ? '' : 's'}.`);
  }

  async function handleTemplateUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    applyTemplateFile(file.name, await file.text());
    event.target.value = '';
  }

  async function handleEnvironmentUpload(
    event: ChangeEvent<HTMLInputElement>,
    environmentId: string,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    applyEnvironmentFile(environmentId, file.name, await file.text());
    event.target.value = '';
  }

  async function handleBulkUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    await applyBulkFiles(files);
    event.target.value = '';
  }

  async function handleCopyReport() {
    if (!hasAnyInput) {
      setStatusMessage('Paste or upload a template and at least one environment file first.');
      return;
    }

    try {
      await copyText(report);
      setStatusMessage('Comparison report copied to clipboard.');
    } catch {
      setStatusMessage('Clipboard permission was not available in this browser.');
    }
  }

  function handleStartEnvironmentRename(environment: EnvironmentTab) {
    setRenamingEnvironmentId(environment.id);
    setRenameDraft(getEnvironmentDisplayName(environment));
  }

  function handleCommitEnvironmentRename(environmentId: string) {
    const nextName = renameDraft.trim();

    if (nextName.length > 0) {
      setEnvironments((current) =>
        current.map((environment) =>
          environment.id === environmentId
            ? {
                ...environment,
                loadedName: nextName,
                filename: nextName,
              }
            : environment,
        ),
      );
    }

    setRenamingEnvironmentId(null);
    setRenameDraft('');
  }

  function handleCancelEnvironmentRename() {
    setRenamingEnvironmentId(null);
    setRenameDraft('');
  }

  function handleDownloadAll() {
    const filesToDownload = [];

    if (templateText.trim().length > 0) {
      filesToDownload.push({
        filename: getDownloadFilename(
          templateLoadedName ?? pageConfig.templateDefaultName,
          'template',
          pageConfig.templateDefaultName,
        ),
        text: templateText,
      });
    }

    environments.forEach((environment) => {
      if (environment.text.trim().length === 0) {
        return;
      }

      filesToDownload.push({
        filename: getDownloadFilename(
          environment.loadedName ?? environment.filename,
          environment.label,
          pageConfig.getDefaultEnvironmentDownloadName(environment.label),
        ),
        text: environment.text,
      });
    });

    if (filesToDownload.length === 0) {
      setStatusMessage('Paste or upload a template or environment file first.');
      return;
    }

    filesToDownload.forEach((file, index) => {
      window.setTimeout(() => {
        downloadTextFile(file.filename, file.text);
      }, index * 120);
    });
  }

  function handleAddEnvironment() {
    if (environments.length >= 3) {
      setStatusMessage('You can compare up to three environment widgets at once.');
      return;
    }

    const nextEnvironment = createEnvironment(environments.length + 1, pageConfig);

    setEnvironments((current) => [...current, nextEnvironment]);
    setStatusMessage(`${nextEnvironment.label} added.`);
  }

  function handleClearTemplate() {
    setTemplateText('');
    setTemplateLoadedName(null);
    setStatusMessage('Reference template cleared.');
  }

  function handleClearEnvironment(environmentId: string) {
    setEnvironments((current) =>
      current.map((environment) =>
        environment.id === environmentId
          ? {
              ...environment,
              text: '',
              filename: getEnvironmentFilename(
                Number.parseInt(environment.label.replace('Environment ', ''), 10),
                pageConfig,
              ),
              loadedName: undefined,
            }
          : environment,
      ),
    );
    const environment = environments.find((item) => item.id === environmentId);
    setStatusMessage(`${environment?.label ?? 'Environment'} cleared.`);
  }

  function handleRemoveEnvironment(environmentId: string) {
    const environmentIndex = environments.findIndex((item) => item.id === environmentId);

    if (environmentIndex < 1) {
      return;
    }

    setActiveFullscreenResizer(null);
    setEnvironments((current) =>
      resequenceEnvironments(
        current.filter((environment) => environment.id !== environmentId),
        pageConfig,
      ),
    );

    const environment = environments.find((item) => item.id === environmentId);
    setStatusMessage(`${environment?.loadedName ?? environment?.label ?? 'Environment'} removed.`);
  }

  function handleQuickFixAllProperties() {
    if (pageConfig.id !== 'properties') {
      return;
    }

    const canFixTemplate = canQuickFixPropertiesText(templateText, parsedTemplate);
    let fixedCount = canFixTemplate ? 1 : 0;
    const nextTemplateText = canFixTemplate
      ? quickFixPropertiesText(templateText, parsedTemplate)
      : templateText;

    const parsedEnvironmentMap = new Map(
      parsedEnvironments.map((environment) => [environment.id, environment] as const),
    );
    const nextEnvironments = environments.map((environment) => {
      const parsedEnvironment = parsedEnvironmentMap.get(environment.id);

      if (
        !parsedEnvironment ||
        !canQuickFixPropertiesText(environment.text, parsedEnvironment.parsed)
      ) {
        return environment;
      }

      fixedCount += 1;

      return {
        ...environment,
        text: quickFixPropertiesText(environment.text, parsedEnvironment.parsed),
      };
    });

    if (fixedCount === 0) {
      return;
    }

    startTransition(() => {
      setTemplateText(nextTemplateText);
      setEnvironments(nextEnvironments);
    });

    setStatusMessage(`Quick fix applied to ${fixedCount} file${fixedCount === 1 ? '' : 's'}.`);
  }

  function handleClearAll() {
    const resetEnvironments = [createEnvironment(1, pageConfig)];

    setTemplateText('');
    setTemplateLoadedName(null);
    setEnvironments(resetEnvironments);
    setHoveredLines(buildHoverTarget());
    setDropState({ kind: 'idle' });
    setStatusMessage('Template and environment files cleared.');
  }

  function handleLoadDemo() {
    const demoEnvironments = pageConfig.demoEnvironmentTexts.map((text, index) =>
      createEnvironment(index + 1, pageConfig, text, pageConfig.demoEnvironmentFilenames[index]),
    );

    setTemplateText(pageConfig.demoTemplate);
    setTemplateLoadedName(pageConfig.templateDefaultName);
    setEnvironments(demoEnvironments);
    setStatusMessage('Demo data loaded with three environment widgets.');
  }

  function clearDropState() {
    setDropState({ kind: 'idle' });
  }

  function handleWorkspaceDragOver(event: DragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    const fileCount = getDraggedFileCount(event);

    if (fileCount <= 1) {
      return;
    }

    event.dataTransfer.dropEffect = 'copy';

    if (fileCount > 4) {
      setDropState({
        kind: 'bulk-invalid',
        message: 'Too many files. Drop 4 or fewer.',
      });
      return;
    }

    setDropState({
      kind: 'bulk',
      message: `Drop files to auto-fill the template and ${pageConfig.id === 'properties' ? 'properties' : 'env'} widgets.`,
    });
  }

  function handleWorkspaceDragLeave(event: DragEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    clearDropState();
  }

  async function handleWorkspaceDrop(event: DragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);

    if (files.length <= 1) {
      setStatusMessage('Drop a single file on a specific widget, or drop multiple files here.');
      clearDropState();
      return;
    }
    await applyBulkFiles(files);
  }

  function handleTemplateDragOver(event: DragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event) || getDraggedFileCount(event) !== 1) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDropState({ kind: 'single-template' });
  }

  async function handleTemplateDrop(event: DragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) {
      return;
    }

    const files = Array.from(event.dataTransfer.files);

    if (files.length !== 1) {
      return;
    }

    event.preventDefault();
    applyTemplateFile(files[0].name, await files[0].text());
    clearDropState();
  }

  function handleEnvironmentDragOver(
    event: DragEvent<HTMLElement>,
    environmentId: string,
  ) {
    if (!hasDraggedFiles(event) || getDraggedFileCount(event) !== 1) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDropState({
      kind: 'single-environment',
      environmentId,
    });
  }

  async function handleEnvironmentDrop(
    event: DragEvent<HTMLElement>,
    environmentId: string,
  ) {
    if (!hasDraggedFiles(event)) {
      return;
    }

    const files = Array.from(event.dataTransfer.files);

    if (files.length !== 1) {
      return;
    }

    event.preventDefault();
    applyEnvironmentFile(environmentId, files[0].name, await files[0].text());
    clearDropState();
  }

  function handleWorkspaceModalWheel(event: WheelEvent<HTMLDivElement>) {
    const modal = workspaceModalRef.current;

    if (!modal) {
      return;
    }

    const target = event.target instanceof HTMLElement ? event.target : null;
    const editorTextarea = target?.closest('.editor-textarea');

    if (editorTextarea instanceof HTMLElement && canScrollVertically(editorTextarea, event.deltaY)) {
      return;
    }

    if (!canScrollVertically(modal, event.deltaY)) {
      return;
    }

    event.preventDefault();
    modal.scrollTop += event.deltaY;
  }

  function handleOpenPrivacyChoices() {
    window.googlefc?.showRevocationMessage?.();
  }

  function renderWorkspace(fullscreen = false) {
    const widgetCount = parsedEnvironments.length + 1;
    const workspaceHintText = pageConfig.workspaceHint.replace(/\.$/, '');
    const fullscreenGridStyle = {
      gridTemplateColumns:
        widgetCount > 1
          ? buildResizableTrackTemplate([fullscreenColumnRatio, 100 - fullscreenColumnRatio])
          : 'minmax(0, 1fr)',
      gridTemplateRows:
        widgetCount > 2
          ? buildResizableTrackTemplate([fullscreenRowRatio, 100 - fullscreenRowRatio])
          : 'minmax(0, 1fr)',
    } as CSSProperties;
    const fullscreenRowPercents = getNormalizedTrackPercents(
      fullscreenRowColumnRatios,
      widgetCount,
    );
    const fullscreenRowStyle = {
      gridTemplateColumns: buildResizableTrackTemplate(fullscreenRowPercents),
    } as CSSProperties;

    function renderTemplateCard(extraClassName = '') {
      return (
        <article
          className={`editor-card editor-card--template ${extraClassName} ${
            dropState.kind === 'single-template' ? 'editor-card--drop-target' : ''
          }`}
          onDragOver={handleTemplateDragOver}
          onDragLeave={handleWorkspaceDragLeave}
          onDrop={(event) => {
            void handleTemplateDrop(event);
          }}
        >
          <div className="editor-card__header">
            <div className="editor-card__title-wrap">
              <h2>{templateLoadedName ?? pageConfig.templateDefaultName}</h2>
            </div>
            <div className="editor-card__actions">
              <label className="button button--ghost">
                {pageConfig.templateUploadLabel}
                <input
                  type="file"
                  accept={pageConfig.fileInputAccept}
                  className="sr-only"
                  onChange={(event) => {
                    void handleTemplateUpload(event);
                  }}
                />
              </label>
              <button
                type="button"
                className="button button--ghost"
                onClick={handleClearTemplate}
              >
                Clear
              </button>
            </div>
          </div>
          {dropState.kind === 'single-template' ? (
            <div className="editor-card__drop-hint">Drop one file here</div>
          ) : null}
          <EnvTextEditor
            value={templateText}
            parsed={parsedTemplate}
            highlightedLines={hoveredLines.template}
            lineInteractions={templateLineInteractions}
            onHoverTargetChange={handleHoverStart}
            onChange={setTemplateText}
            placeholder={pageConfig.templatePlaceholder}
            ariaLabel="Reference template content"
          />
          <div className="editor-card__helper editor-card__helper--bottom">
            {pageConfig.templateHelperText(comparison)}
          </div>
        </article>
      );
    }

    function renderEnvironmentCard(
      environment: (typeof parsedEnvironments)[number],
      environmentIndex: number,
      extraClassName = '',
    ) {
      const canRemoveEnvironment = environmentIndex >= 1;
      const environmentComparison = comparisonByEnvironmentId.get(environment.id);
      const statusTone = getEnvironmentStatusTone(environmentComparison);
      const statusInteraction = buildEnvironmentStatusInteraction(environment.id);
      const isRenaming = renamingEnvironmentId === environment.id;
      const displayName = getEnvironmentDisplayName(environment);

      return (
        <article
          key={environment.id}
          className={`editor-card editor-card--environment-widget ${extraClassName} ${
            dropState.kind === 'single-environment' &&
            dropState.environmentId === environment.id
              ? 'editor-card--drop-target'
              : ''
          }`}
          onDragOver={(event) => {
            handleEnvironmentDragOver(event, environment.id);
          }}
          onDragLeave={handleWorkspaceDragLeave}
          onDrop={(event) => {
            void handleEnvironmentDrop(event, environment.id);
          }}
        >
          <div className="editor-card__header">
            <div className="editor-card__title-wrap">
              <h2 className="editor-card__heading">
                {isRenaming ? (
                  <input
                    autoFocus
                    className="editor-card__title-input"
                    value={renameDraft}
                    onChange={(event) => {
                      setRenameDraft(event.target.value);
                    }}
                    onBlur={() => {
                      handleCommitEnvironmentRename(environment.id);
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleCommitEnvironmentRename(environment.id);
                        return;
                      }

                      if (event.key === 'Escape') {
                        event.preventDefault();
                        handleCancelEnvironmentRename();
                      }
                    }}
                    aria-label={`Rename ${displayName}`}
                  />
                ) : (
                  <button
                    type="button"
                    className="editor-card__title-button"
                    onClick={() => {
                      handleStartEnvironmentRename(environment);
                    }}
                    title={`Rename ${displayName}`}
                  >
                    {displayName}
                  </button>
                )}
                {statusTone ? (
                  <span
                    className="editor-card__status-indicator"
                    onMouseEnter={() => {
                      handleHoverStart(statusInteraction.hover);
                    }}
                    onMouseLeave={() => {
                      handleHoverStart(undefined);
                    }}
                  >
                    <span
                      className={`editor-card__status-dot editor-card__status-dot--${statusTone}`}
                      aria-hidden="true"
                    />
                    <div className="editor-tooltip editor-card__status-tooltip" aria-hidden="true">
                      {statusInteraction.details.length === 1 &&
                      statusInteraction.details[0]?.text === 'No issues detected in this file.' ? (
                        <div className="editor-card__status-tooltip-empty">
                          No issues detected in this file.
                        </div>
                      ) : (
                        statusInteraction.details.map((detail, index) => (
                          <div
                            key={`${detail.label}-${index}`}
                            className={`editor-tooltip__row editor-tooltip__row--${detail.tone}`}
                          >
                            <span
                              className={`editor-tooltip__badge editor-tooltip__badge--${detail.tone}`}
                            >
                              {detail.label}
                            </span>
                            <span>{detail.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </span>
                ) : null}
              </h2>
            </div>
            <div className="editor-card__actions">
              <label className="button button--ghost">
                Upload
                <input
                  type="file"
                  accept={pageConfig.fileInputAccept}
                  className="sr-only"
                  onChange={(event) => {
                    void handleEnvironmentUpload(event, environment.id);
                  }}
                />
              </label>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => handleClearEnvironment(environment.id)}
              >
                Clear
              </button>
              {canRemoveEnvironment ? (
                <IconButton
                  label="x"
                  title={`Remove ${environment.loadedName ?? environment.label}`}
                  onClick={() => handleRemoveEnvironment(environment.id)}
                />
              ) : null}
            </div>
          </div>
          {dropState.kind === 'single-environment' &&
          dropState.environmentId === environment.id ? (
            <div className="editor-card__drop-hint">Drop one file here</div>
          ) : null}
          <EnvTextEditor
            value={environment.text}
            parsed={environment.parsed}
            highlightedLines={hoveredLines.environments?.[environment.id] ?? []}
            lineInteractions={environmentLineInteractions.get(environment.id)}
            onHoverTargetChange={handleHoverStart}
            onChange={(nextValue) => {
              setEnvironments((current) =>
                current.map((environmentItem) =>
                  environmentItem.id === environment.id
                    ? {
                        ...environmentItem,
                        text: nextValue,
                      }
                    : environmentItem,
                ),
              );
            }}
            placeholder={pageConfig.environmentPlaceholder}
            ariaLabel={`${environment.label} content`}
          />
        </article>
      );
    }

    const fullscreenGridCards =
      widgetCount <= 1
        ? [renderTemplateCard('fullscreen-grid__card fullscreen-grid__card--single')]
        : [
            renderTemplateCard('fullscreen-grid__card fullscreen-grid__card--template'),
            ...parsedEnvironments.map((environment, index) => {
              if (widgetCount === 2) {
                return renderEnvironmentCard(
                  environment,
                  index,
                  'fullscreen-grid__card fullscreen-grid__card--top-right',
                );
              }

              if (widgetCount === 3 && index === 1) {
                return renderEnvironmentCard(
                  environment,
                  index,
                  'fullscreen-grid__card fullscreen-grid__card--bottom-full',
                );
              }

              if (index === 0) {
                return renderEnvironmentCard(
                  environment,
                  index,
                  'fullscreen-grid__card fullscreen-grid__card--top-right',
                );
              }

              if (index === 1) {
                return renderEnvironmentCard(
                  environment,
                  index,
                  'fullscreen-grid__card fullscreen-grid__card--bottom-left',
                );
              }

              return renderEnvironmentCard(
                environment,
                index,
                'fullscreen-grid__card fullscreen-grid__card--bottom-right',
              );
            }),
          ];
    const fullscreenRowCards = [
      renderTemplateCard('fullscreen-row__card'),
      ...parsedEnvironments.flatMap((environment, index) => [
        <button
          key={`fullscreen-row-resizer-${environment.id}`}
          type="button"
          className={`fullscreen-row__resizer ${
            activeFullscreenResizer?.kind === 'row-column' &&
            activeFullscreenResizer.index === index
              ? 'fullscreen-row__resizer--active'
              : ''
          }`}
          aria-label={`Resize columns between ${
            index === 0 ? 'template and first environment' : `environment ${index} and ${index + 1}`
          }`}
          onPointerDown={(event) => {
            event.preventDefault();
            setActiveFullscreenResizer({
              kind: 'row-column',
              index,
            });
          }}
        />,
        renderEnvironmentCard(environment, index, 'fullscreen-row__card'),
      ]),
    ];

    return (
      <section
        className={`workspace ${fullscreen ? 'workspace--fullscreen' : ''} ${
          dropState.kind === 'bulk' || dropState.kind === 'bulk-invalid'
            ? 'workspace--drop-active'
            : ''
        } ${dropState.kind === 'bulk-invalid' ? 'workspace--drop-invalid' : ''}`}
        onDragOver={handleWorkspaceDragOver}
        onDragLeave={handleWorkspaceDragLeave}
        onDrop={(event) => {
          void handleWorkspaceDrop(event);
        }}
      >
        <div className="workspace-toolbar">
          <div className="workspace-toolbar__lead">
            <label className="workspace-toolbar__upload-link">
              {pageConfig.bulkUploadLabel}
              <input
                type="file"
                multiple
                accept={pageConfig.fileInputAccept}
                className="sr-only"
                onChange={(event) => {
                  void handleBulkUpload(event);
                }}
              />
            </label>
            <span className="workspace-toolbar__hint-text">or {workspaceHintText}.</span>
          </div>
          <div className="workspace-toolbar__actions">
            <IconButton
              label="+"
              title="Add environment"
              onClick={handleAddEnvironment}
              disabled={environments.length >= 3}
            />
            {fullscreen ? (
              <div className="layout-toggle" role="group" aria-label="Fullscreen layout mode">
                <button
                  type="button"
                  className={`layout-toggle__button ${
                    fullscreenLayout === 'grid' ? 'layout-toggle__button--active' : ''
                  }`}
                  onClick={() => {
                    setActiveFullscreenResizer(null);
                    setFullscreenLayout('grid');
                  }}
                >
                  Grid
                </button>
                <button
                  type="button"
                  className={`layout-toggle__button ${
                    fullscreenLayout === 'row' ? 'layout-toggle__button--active' : ''
                  }`}
                  onClick={() => {
                    setActiveFullscreenResizer(null);
                    setFullscreenLayout('row');
                  }}
                >
                  Row
                </button>
              </div>
            ) : null}
            <IconButton
              label={fullscreen ? 'x' : '[]'}
              title={fullscreen ? 'Close expanded workspace' : 'Expand workspace'}
              onClick={() => {
                setActiveFullscreenResizer(null);
                setIsWorkspaceExpanded((current) => !current);
              }}
            />
          </div>
        </div>

        {dropState.kind === 'bulk' || dropState.kind === 'bulk-invalid' ? (
          <div
            className={`workspace-drop-hint ${
              dropState.kind === 'bulk-invalid' ? 'workspace-drop-hint--invalid' : ''
            }`}
          >
            {dropState.message}
          </div>
        ) : null}

        {fullscreen && fullscreenLayout === 'grid' ? (
          <div
            ref={fullscreenGridRef}
            className={`fullscreen-grid ${
              widgetCount > 2 ? 'fullscreen-grid--two-rows' : 'fullscreen-grid--one-row'
            }`}
            style={fullscreenGridStyle}
          >
            {fullscreenGridCards}
            {widgetCount > 1 ? (
              <button
                type="button"
                className={`fullscreen-grid__col-resizer ${
                  activeFullscreenResizer?.kind === 'grid-column'
                    ? 'fullscreen-grid__col-resizer--active'
                    : ''
                }`}
                aria-label="Resize fullscreen columns"
                onPointerDown={(event) => {
                  event.preventDefault();
                  setActiveFullscreenResizer({
                    kind: 'grid-column',
                  });
                }}
              />
            ) : null}
            {widgetCount > 2 ? (
              <button
                type="button"
                className={`fullscreen-grid__row-resizer ${
                  activeFullscreenResizer?.kind === 'grid-row'
                    ? 'fullscreen-grid__row-resizer--active'
                    : ''
                }`}
                aria-label="Resize fullscreen rows"
                onPointerDown={(event) => {
                  event.preventDefault();
                  setActiveFullscreenResizer({
                    kind: 'grid-row',
                  });
                }}
              />
            ) : null}
          </div>
        ) : fullscreen && fullscreenLayout === 'row' ? (
          <div ref={fullscreenRowRef} className="fullscreen-row" style={fullscreenRowStyle}>
            {fullscreenRowCards}
          </div>
        ) : (
          <div className="widget-grid">
            {renderTemplateCard()}
            {parsedEnvironments.map((environment, index) =>
              renderEnvironmentCard(environment, index),
            )}
          </div>
        )}
      </section>
    );
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: pageConfig.softwareApplicationName,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: pageConfig.faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {isWorkspaceExpanded ? (
        <div
          ref={workspaceModalRef}
          className="workspace-modal"
          role="dialog"
          aria-modal="true"
          onWheelCapture={handleWorkspaceModalWheel}
        >
          {renderWorkspace(true)}
        </div>
      ) : null}

      <div className="page-shell">
        <header className="hero">
          <div className="hero__headline">
              <div className="hero__title-wrap">
              <h1>{pageConfig.heroTitle}</h1>
              <p className="hero__lede">
                {pageConfig.heroLede}
              </p>
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

        <AdSlot
          label="Top banner"
          slotId={import.meta.env.VITE_ADSENSE_SLOT_A}
          minHeight={44}
        />

        <main className="tool-layout">
          {!isWorkspaceExpanded ? renderWorkspace() : null}

          <section className="action-bar">
            <div className="action-bar__group">
              <button type="button" className="button button--demo" onClick={handleLoadDemo}>
                Load demo
              </button>
              <button type="button" className="button button--ghost" onClick={handleClearAll}>
                Clear all
              </button>
            </div>
            <div className="action-bar__group">
              {canQuickFixAllProperties ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={handleQuickFixAllProperties}
                >
                  Quick fix
                </button>
              ) : null}
              <button type="button" className="button button--secondary" onClick={handleCopyReport}>
                Copy text report
              </button>
              <button type="button" className="button button--secondary" onClick={handleDownloadAll}>
                Download all
              </button>
            </div>
          </section>

          <section className="summary-grid" aria-label="Validation summary">
            <SummaryCard
              label={pageConfig.summaryEnvironmentCountLabel}
              value={comparison.summary.environmentCount}
              tone="success"
            />
            <SummaryCard
              label={pageConfig.summaryMissingLabel}
              value={comparison.summary.missingRequiredKeys}
              tone={comparison.summary.missingRequiredKeys > 0 ? 'danger' : 'success'}
            />
            <SummaryCard
              label={pageConfig.summaryUndocumentedLabel}
              value={comparison.summary.undocumentedKeys}
              tone={comparison.summary.undocumentedKeys > 0 ? 'warning' : 'success'}
            />
            <SummaryCard
              label={pageConfig.summaryDuplicateLabel}
              value={
                comparison.summary.duplicateGroupsInEnvironments +
                comparison.summary.duplicateGroupsInTemplate
              }
              tone={
                comparison.summary.duplicateGroupsInEnvironments +
                  comparison.summary.duplicateGroupsInTemplate >
                0
                  ? 'danger'
                  : 'success'
              }
            />
            <SummaryCard
              label={pageConfig.summaryMalformedLabel}
              value={
                comparison.summary.malformedInEnvironments +
                comparison.summary.malformedInTemplate
              }
              tone={
                comparison.summary.malformedInEnvironments +
                  comparison.summary.malformedInTemplate >
                0
                  ? 'danger'
                  : 'success'
              }
            />
            <SummaryCard
              label={pageConfig.summaryWarningsLabel}
              value={warningCount}
              tone={warningCount > 0 ? 'warning' : 'success'}
            />
          </section>

          {!hasAnyInput ? (
            <section className="empty-state">
              <h3>{pageConfig.emptyStateTitle}</h3>
              <p>{pageConfig.emptyStateBody}</p>
            </section>
          ) : visibleResultSections.length === 0 ? (
            <section className="empty-state">
              <h3>{pageConfig.noIssuesTitle}</h3>
              <p>{pageConfig.noIssuesBody}</p>
            </section>
          ) : (
            <section
              className={`results-stack ${
                resultColumns.left.length === 0 || resultColumns.right.length === 0
                  ? 'results-stack--single'
                  : ''
              }`.trim()}
            >
              <div className="results-stack__column">
                {resultColumns.left.map((section) => (
                  <div key={section.id}>{section.element}</div>
                ))}
              </div>
              {resultColumns.right.length > 0 ? (
                <div className="results-stack__column">
                  {resultColumns.right.map((section) => (
                    <div key={section.id}>{section.element}</div>
                  ))}
                </div>
              ) : null}
            </section>
          )}
        </main>

        <AdSlot
          label="Results banner"
          slotId={import.meta.env.VITE_ADSENSE_SLOT_B}
          minHeight={52}
        />

        <section className="content-grid">
          <section className="faq-section">
            <div className="section-heading">
                <span className="section-heading__eyebrow">FAQ</span>
                <h2>{pageConfig.faqHeading}</h2>
            </div>
            <div className="faq-list">
              {pageConfig.faqItems.map((item) => (
                <article key={item.question} className="faq-item">
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
          </section>

          <AdSlot
            className="ad-slot--sidebar"
            label="Sidebar slot"
            slotId={import.meta.env.VITE_ADSENSE_SLOT_C}
            minHeight={132}
          />
        </section>

        <footer className="site-footer">
          <a
            className="site-footer__link"
            href={pageConfig.id === 'properties' ? '/' : '/properties-file-validator'}
          >
            {pageConfig.id === 'properties' ? 'Env validator' : 'Properties validator'}
          </a>
          <a className="site-footer__link" href="/privacy-policy">
            Privacy Policy
          </a>
          <a className="site-footer__link" href="/contact">
            Contact
          </a>
          {isPrivacyChoicesAvailable ? (
            <button
              type="button"
              className="site-footer__link"
              onClick={handleOpenPrivacyChoices}
            >
              Privacy &amp; cookie settings
            </button>
          ) : null}
        </footer>
      </div>
    </>
  );
}

function App({ pathname }: { pathname?: string }) {
  const resolvedPathname = pathname ?? getCurrentPathname();
  const staticPage = getStaticPage(resolvedPathname);

  if (staticPage) {
    return <StaticPage page={staticPage} />;
  }

  return <ValidatorApp pageConfig={getActiveValidatorPage(resolvedPathname)} />;
}

export default App;
