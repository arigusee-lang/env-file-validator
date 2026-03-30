import { useRef, useState, type MouseEvent } from 'react';
import type { ParsedEnvFile } from '../features/envCompare';

export type EditorHoverTarget = {
  template: number[];
  environments?: Record<string, number[]>;
};

export type EditorTooltipDetail = {
  tone: 'error' | 'warning' | 'linked';
  label: string;
  text: string;
};

export type EditorLineInteraction = {
  details: EditorTooltipDetail[];
  hover?: EditorHoverTarget;
};

type EnvTextEditorProps = {
  value: string;
  parsed: ParsedEnvFile;
  placeholder: string;
  ariaLabel: string;
  highlightedLines?: number[];
  readOnly?: boolean;
  lineInteractions?: Map<number, EditorLineInteraction>;
  onHoverTargetChange?: (hover?: EditorHoverTarget) => void;
  onChange?: (value: string) => void;
};

type TooltipState = {
  x: number;
  y: number;
  details: EditorTooltipDetail[];
};

function getLineState(codes: string[], source: ParsedEnvFile['source']) {
  if (
    codes.includes('malformed_line') ||
    codes.includes('invalid_key_name') ||
    codes.includes('empty_unquoted_value')
  ) {
    return 'error';
  }

  if (codes.includes('duplicate_key')) {
    return 'error';
  }

  if (source === 'env' && codes.includes('empty_value')) {
    return 'empty';
  }

  if (codes.includes('whitespace_issue')) {
    return 'warning';
  }

  return 'default';
}

function getAssignmentParts(raw: string) {
  const separatorIndex = raw.indexOf('=');

  if (separatorIndex === -1) {
    return {
      keyPart: raw,
      separator: '',
      valuePart: '',
      commentPart: '',
    };
  }

  const rawValuePart = raw.slice(separatorIndex + 1);
  const trimmedStart = rawValuePart.trimStart();
  const leadingWhitespaceLength = rawValuePart.length - trimmedStart.length;
  let commentHashIndex = -1;

  if (trimmedStart.startsWith('"') || trimmedStart.startsWith("'") || trimmedStart.startsWith('`')) {
    const quote = trimmedStart[0];
    let closingQuoteIndex = -1;

    for (let index = 1; index < trimmedStart.length; index += 1) {
      if (trimmedStart[index] === quote && trimmedStart[index - 1] !== '\\') {
        closingQuoteIndex = index;
        break;
      }
    }

    if (closingQuoteIndex !== -1) {
      const trailingText = trimmedStart.slice(closingQuoteIndex + 1);
      const hashIndex = trailingText.indexOf('#');

      if (hashIndex !== -1 && trailingText.slice(0, hashIndex).trim().length === 0) {
        commentHashIndex =
          leadingWhitespaceLength + closingQuoteIndex + 1 + hashIndex;
      }
    }
  } else {
    const hashIndex = rawValuePart.indexOf('#');

    if (hashIndex !== -1) {
      commentHashIndex = hashIndex;
    }
  }

  const commentStartIndex =
    commentHashIndex === -1
      ? -1
      : (() => {
          let startIndex = commentHashIndex;

          while (
            startIndex > 0 &&
            /\s/.test(rawValuePart[startIndex - 1] ?? '')
          ) {
            startIndex -= 1;
          }

          return startIndex;
        })();

  const valuePart =
    commentStartIndex === -1
      ? rawValuePart
      : rawValuePart.slice(0, commentStartIndex);
  const commentPart =
    commentStartIndex === -1 ? '' : rawValuePart.slice(commentStartIndex);

  return {
    keyPart: raw.slice(0, separatorIndex),
    separator: '=',
    valuePart,
    commentPart,
  };
}

export function EnvTextEditor({
  value,
  parsed,
  placeholder,
  ariaLabel,
  highlightedLines = [],
  readOnly = false,
  lineInteractions,
  onHoverTargetChange,
  onChange,
}: EnvTextEditorProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const issuesByLine = new Map<number, string[]>();

  parsed.issues.forEach((issue) => {
    const existing = issuesByLine.get(issue.lineNumber) ?? [];
    existing.push(issue.code);
    issuesByLine.set(issue.lineNumber, existing);
  });

  const highlightedSet = new Set(highlightedLines);

  function syncScroll() {
    if (!textareaRef.current || !highlightRef.current) {
      return;
    }

    highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }

  function clearEditorHover() {
    setTooltip(null);
    onHoverTargetChange?.(undefined);
  }

  function handleMouseMove(event: MouseEvent<HTMLTextAreaElement>) {
    if (!textareaRef.current || !surfaceRef.current || !lineInteractions) {
      clearEditorHover();
      return;
    }

    const textarea = textareaRef.current;
    const surface = surfaceRef.current;
    const rect = textarea.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 17;
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const relativeY = event.clientY - rect.top + textarea.scrollTop - paddingTop;
    const lineNumber = Math.max(
      1,
      Math.min(parsed.lines.length, Math.floor(relativeY / lineHeight) + 1),
    );
    const interaction = lineInteractions.get(lineNumber);

    if (!interaction) {
      clearEditorHover();
      return;
    }

    const tooltipWidth = Math.min(340, Math.max(surfaceRect.width - 24, 180));
    const nextX = Math.min(
      Math.max(event.clientX - surfaceRect.left + 12, 12),
      Math.max(12, surfaceRect.width - tooltipWidth - 12),
    );
    const nextY = Math.min(
      Math.max(event.clientY - surfaceRect.top + 16, 12),
      Math.max(12, surfaceRect.height - 84),
    );

    setTooltip({
      x: nextX,
      y: nextY,
      details: interaction.details,
    });
    onHoverTargetChange?.(interaction.hover);
  }

  return (
    <div className="editor-surface" ref={surfaceRef}>
      <div className="editor-highlight" ref={highlightRef} aria-hidden="true">
        <div className="editor-highlight__content">
          {value.length === 0 ? (
            <div className="editor-placeholder">{placeholder}</div>
          ) : (
            parsed.lines.map((line) => {
              const issueCodes = issuesByLine.get(line.lineNumber) ?? [];
              const lineState = getLineState(issueCodes, parsed.source);
              const isHighlighted = highlightedSet.has(line.lineNumber);

              if (line.kind === 'blank') {
                return (
                  <div
                    key={line.lineNumber}
                    className={`editor-line editor-line--${lineState} ${
                      isHighlighted ? 'editor-line--linked' : ''
                    }`}
                  >
                    {' '}
                  </div>
                );
              }

              if (line.kind === 'comment') {
                return (
                  <div
                    key={line.lineNumber}
                    className={`editor-line editor-line--${lineState} ${
                      isHighlighted ? 'editor-line--linked' : ''
                    }`}
                  >
                    <span className="editor-token editor-token--comment">{line.raw}</span>
                  </div>
                );
              }

              if (line.kind === 'malformed') {
                return (
                  <div
                    key={line.lineNumber}
                    className={`editor-line editor-line--${lineState} ${
                      isHighlighted ? 'editor-line--linked' : ''
                    }`}
                  >
                    <span className="editor-token editor-token--invalid">{line.raw}</span>
                  </div>
                );
              }

              if (line.kind === 'continuation') {
                return (
                  <div
                    key={line.lineNumber}
                    className={`editor-line editor-line--${lineState} ${
                      isHighlighted ? 'editor-line--linked' : ''
                    }`}
                  >
                    <span className="editor-token editor-token--value">
                      {line.raw.length === 0 ? ' ' : line.raw}
                    </span>
                  </div>
                );
              }

              const { keyPart, separator, valuePart, commentPart } = getAssignmentParts(line.raw);

              return (
                <div
                  key={line.lineNumber}
                  className={`editor-line editor-line--${lineState} ${
                    isHighlighted ? 'editor-line--linked' : ''
                  }`}
                >
                  <span className="editor-token editor-token--key">{keyPart}</span>
                  <span className="editor-token editor-token--separator">{separator}</span>
                  <span
                    className={`editor-token ${
                      parsed.source === 'env' && valuePart.trim().length === 0
                        ? 'editor-token--empty-value'
                        : 'editor-token--value'
                    }`}
                  >
                    {valuePart.length === 0 ? ' ' : valuePart}
                  </span>
                  {commentPart ? (
                    <span className="editor-token editor-token--comment">{commentPart}</span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className="editor-textarea"
        spellCheck={false}
        readOnly={readOnly}
        value={value}
        onScroll={() => {
          syncScroll();
          clearEditorHover();
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={clearEditorHover}
        onChange={
          onChange
            ? (event) => {
                onChange(event.target.value);
              }
            : undefined
        }
        aria-label={ariaLabel}
      />

      {tooltip ? (
        <div
          className="editor-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
          aria-hidden="true"
        >
          {tooltip.details.map((detail, index) => (
            <div
              key={`${detail.label}-${index}`}
              className={`editor-tooltip__row editor-tooltip__row--${detail.tone}`}
            >
              <span className={`editor-tooltip__badge editor-tooltip__badge--${detail.tone}`}>
                {detail.label}
              </span>
              <span>{detail.text}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
