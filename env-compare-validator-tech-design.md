# Технический дизайн — `.env Compare / Validator` Web MVP

**Версия:** 1.0  
**Дата:** 2026-03-28  
**Источник требований:** `env-compare-validator-brd.md`  
**Статус:** Draft / MVP-ready

---

## 1. Цель документа

Зафиксировать минимальную техническую реализацию browser-first MVP для сравнения `.env` и `.env.example` без серверной обработки содержимого файлов.

Документ покрывает:
- выбранный стек,
- архитектуру приложения,
- модель данных,
- правила парсинга,
- логику сравнения и генерации шаблона,
- UI-структуру,
- требования к privacy, ads, SEO и тестированию.

Документ сознательно не расширяет продуктовый scope за пределы BRD.

---

## 2. Границы MVP

### Входит в MVP
- Вставка текста для двух файлов: `.env` и `.env.example`
- Upload файлов для обоих источников
- Парсинг dotenv-подобного синтаксиса
- Выявление:
  - missing keys,
  - extra keys,
  - duplicate keys,
  - malformed lines,
  - empty values,
  - простых whitespace issues
- Генерация очищенного `.env.example` из `.env`
- Copy/download действий для отчёта и шаблона
- Полностью client-side обработка
- SEO-блок и FAQ
- До двух ad slots без вмешательства в основной workflow

### Не входит в MVP
- Бэкенд и хранение файлов
- Авторизация
- История изменений
- CI/GitHub/IDE интеграции
- Secret scanning
- Value-level semantic validation
- Поддержка сложных dotenv-диалектов
- AI-fix функциональность

---

## 3. Технический подход

## 3.1 Архитектурное решение

MVP реализуется как статическое SPA-приложение с полностью локальной обработкой данных в браузере.

Ключевые решения:
- `Frontend-only`
- `No backend`
- `No file upload to server`
- `Static hosting`
- `Pure functions` для parser/compare/template generation

Это соответствует BRD по privacy, cost и скорости запуска.

## 3.2 Рекомендуемый стек

- `React`
- `TypeScript`
- `Vite`
- `CSS Modules` или простой scoped CSS без тяжёлой UI-библиотеки
- `Vitest` для unit-тестов
- `Testing Library` для базовых component/integration тестов

Причины выбора:
- минимальный setup time,
- быстрый local dev,
- простой деплой на static hosting,
- удобно изолировать бизнес-логику в чистые функции.

## 3.3 Деплой

Подходящие варианты:
- `Cloudflare Pages`
- `Netlify`
- `Vercel`

Для MVP достаточно любого static hosting, который:
- отдаёт один frontend bundle,
- поддерживает HTTPS,
- позволяет добавить meta tags / redirects / headers,
- не требует server runtime.

---

## 4. Высокоуровневая архитектура

Приложение состоит из 5 логических слоёв:

1. `Input layer`
   - textarea для `.env`
   - textarea для `.env.example`
   - загрузка файлов

2. `Parsing layer`
   - нормализация ввода
   - разбор строк
   - классификация ошибок и warning-ов

3. `Comparison layer`
   - сравнение ключей
   - агрегирование duplicates/malformed/empty values

4. `Output layer`
   - summary cards
   - подробные result panels
   - generated template
   - copy/download actions

5. `Content/Monetization layer`
   - hero
   - privacy note
   - FAQ
   - ad slots

Вычислительная схема:

`raw text -> parsed file model -> compare result -> UI panels / report / generated template`

---

## 5. Предлагаемая структура проекта

```text
src/
  app/
    App.tsx
    routes/
  components/
    TextInputCard/
    FileUploadButton/
    SummaryCards/
    ResultPanel/
    GeneratedTemplatePanel/
    ActionBar/
    PrivacyNote/
    AdSlot/
    FaqSection/
  features/envCompare/
    parser/
      parseEnv.ts
      normalizeInput.ts
      parserTypes.ts
    compare/
      compareEnvFiles.ts
      compareTypes.ts
    template/
      generateTemplate.ts
    report/
      buildPlainTextReport.ts
    selectors/
      buildSummary.ts
  lib/
    downloadTextFile.ts
    clipboard.ts
    fileReader.ts
  styles/
  tests/
```

Принцип:
- UI отдельно от бизнес-логики
- parser/compare/template не зависят от React
- всё, что связано с `.env` логикой, лежит в одном feature-модуле

---

## 6. Модель данных

## 6.1 Parsed line

```ts
type ParsedLine =
  | {
      kind: 'blank' | 'comment';
      lineNumber: number;
      raw: string;
    }
  | {
      kind: 'assignment';
      lineNumber: number;
      raw: string;
      key: string;
      value: string;
      normalizedKey: string;
      warnings: LineIssue[];
    }
  | {
      kind: 'malformed';
      lineNumber: number;
      raw: string;
      issues: LineIssue[];
    };
```

## 6.2 Issue model

```ts
type IssueSeverity = 'error' | 'warning';

type LineIssueCode =
  | 'malformed_line'
  | 'invalid_key_name'
  | 'duplicate_key'
  | 'empty_value'
  | 'whitespace_issue';

type LineIssue = {
  code: LineIssueCode;
  severity: IssueSeverity;
  message: string;
  lineNumber: number;
};
```

## 6.3 Parsed file

```ts
type ParsedEnvFile = {
  source: 'env' | 'template';
  originalText: string;
  lines: ParsedLine[];
  validEntries: EnvEntry[];
  effectiveEntries: EnvEntry[];
  issues: LineIssue[];
  keyMap: Map<string, EnvEntry>;
  duplicateMap: Map<string, EnvEntry[]>;
};

type EnvEntry = {
  key: string;
  normalizedKey: string;
  value: string;
  lineNumber: number;
  raw: string;
};
```

## 6.4 Compare result

```ts
type CompareResult = {
  missingInEnv: string[];
  extraInEnv: string[];
  missingInTemplate: string[];
  duplicateKeysInEnv: DuplicateGroup[];
  duplicateKeysInTemplate: DuplicateGroup[];
  malformedInEnv: LineIssue[];
  malformedInTemplate: LineIssue[];
  emptyValuesInEnv: EnvEntry[];
  emptyValuesInTemplate: EnvEntry[];
  warnings: LineIssue[];
  summary: CompareSummary;
};
```

Примечание:
- `extraInEnv` и `missingInTemplate` вычислительно эквивалентны, но хранятся отдельно для понятного UI.

---

## 7. Спецификация парсинга

## 7.1 Нормализация входа

Перед парсингом:
- приводим переносы строк к `\n`
- убираем UTF-8 BOM, если присутствует
- сохраняем исходный текст для copy/report

## 7.2 Поддерживаемые типы строк

Поддерживаются:
- пустая строка
- комментарий, если после optional leading whitespace строка начинается с `#`
- assignment в виде `KEY=value`
- optional compatibility mode: `export KEY=value`

## 7.3 Правила разбора assignment

MVP-правило:
- строка считается assignment, если содержит первый символ `=`
- часть слева от первого `=` трактуется как key segment
- часть справа трактуется как raw value

Упрощения MVP:
- inline comments не вырезаются из значения
- quoting не интерпретируется глубоко
- variable interpolation не вычисляется
- multiline values не поддерживаются

Это снижает риск ложной “магической” обработки и упрощает browser-only реализацию.

## 7.4 Правила имени ключа

Рекомендуемое MVP-правило:

```regex
^[A-Za-z_][A-Za-z0-9_]*$
```

Решение:
- lowercase допускается
- ключи, не прошедшие regex, помечаются как `invalid_key_name`
- строка остаётся в `malformed`, если key segment невалиден после trim

Причина:
- правило достаточно строгое для типичного `.env`
- не навязывает uppercase-only конвенцию

## 7.5 Whitespace rules

Если просто реализуется, считаем warning-ом:
- пробелы вокруг имени ключа
- пробелы непосредственно до `=`
- ключ, изменившийся после trim

Пример:
- `KEY =value` -> warning
- ` KEY=value` -> warning

Такие строки можно всё ещё парсить после нормализации key segment.

## 7.6 Empty value

Warning `empty_value` ставится, если после первого `=` значение:
- пустое,
- или состоит только из whitespace после trim.

Пример:
- `API_KEY=`
- `API_KEY=   `

## 7.7 Duplicate keys

Duplicate определяется по `normalizedKey`.

MVP-стратегия:
- все дубликаты сохраняются в `duplicateMap`
- для сравнения key set используется `effectiveEntries`
- effective entry берётся по последнему валидному вхождению, так как это ближе к реальному поведению многих dotenv-парсеров

При этом в UI дубликаты показываются отдельным блоком с line numbers.

---

## 8. Логика сравнения

## 8.1 Канонический набор ключей

Для сравнения используются только валидные effective keys:
- malformed lines не участвуют в set comparison
- duplicates не дублируют результат

## 8.2 Вычисления

Пусть:
- `envKeys` — ключи из `.env`
- `templateKeys` — ключи из `.env.example`

Тогда:
- `missingInEnv = templateKeys - envKeys`
- `extraInEnv = envKeys - templateKeys`
- `missingInTemplate = envKeys - templateKeys`

## 8.3 Сопутствующие результаты

Отдельно агрегируются:
- `duplicateKeysInEnv`
- `duplicateKeysInTemplate`
- `malformedInEnv`
- `malformedInTemplate`
- `emptyValuesInEnv`
- `emptyValuesInTemplate`
- `whitespace warnings`

## 8.4 Порядок вывода

Для читаемости:
- missing/extra сортируются по алфавиту
- duplicate groups сортируются по ключу
- issues внутри секции сортируются по `lineNumber`

---

## 9. Генерация `.env.example`

## 9.1 Источник генерации

Шаблон генерируется из `.env`, потому что это основной use case из BRD.

## 9.2 Правила генерации

Берём:
- только валидные ключи,
- без malformed lines,
- без комментариев в MVP,
- по одному ключу на запись,
- в порядке первого валидного появления в `.env`

Формат строки:

```text
KEY=
```

## 9.3 Duplicate policy

Если ключ повторяется:
- в шаблон попадает одна запись
- duplicates не копируются
- факт дублей остаётся в отчёте и UI

## 9.4 Download format

Имя файла по умолчанию:
- `.env.example`

MIME:
- `text/plain;charset=utf-8`

---

## 10. Формирование отчёта

## 10.1 Plain text report

Кнопка `Copy report` формирует текстовый отчёт вида:

```text
Env Compare Report

Summary
- Missing in .env: 3
- Extra in .env: 2
- Duplicates in .env: 1
- Duplicates in .env.example: 0
- Malformed lines in .env: 2
- Malformed lines in .env.example: 1
- Empty values warnings: 4

Missing in .env
- DB_HOST
- REDIS_URL

Extra in .env
- LOCAL_ONLY_FLAG

Duplicates in .env
- API_KEY (lines 3, 18)
```

## 10.2 Принципы отчёта

- без содержимого secret values
- только ключи, counts и line references
- формат легко вставляется в issue / чат / PR comment

---

## 11. UI/UX реализация

## 11.1 Структура страницы

Один экран в следующем порядке:

1. Hero
2. Privacy note
3. Ad Slot A
4. Input area: `.env` и `.env.example`
5. Action row
6. Summary cards
7. Result panels
8. Generated template panel
9. Ad Slot B
10. FAQ
11. Optional desktop-only Ad Slot C

## 11.2 Input section

Для каждого файла:
- label
- short helper text
- textarea
- upload button
- clear button

Обязательная маркировка:
- `.env` как potentially sensitive
- `.env.example` как reference/template

## 11.3 Result panels

Минимальный набор панелей:
- Missing in `.env`
- Extra in `.env`
- Duplicates
- Malformed lines
- Warnings

Каждая панель должна уметь:
- показать count,
- показать empty state,
- отрисовать компактный список.

## 11.4 Responsive behavior

На desktop:
- inputs рядом в 2 колонки

На mobile/small laptop:
- inputs стеком
- actions переносятся на несколько строк
- result panels идут одним столбцом

## 11.5 UX-поведение

Рекомендуемое поведение:
- перерасчёт результатов при каждом изменении текста
- без отдельной кнопки `Compare`

Если появится заметный lag на больших файлах:
- добавить debounce `150-250ms`

Для MVP debounce не обязателен.

---

## 12. State management

Для MVP достаточно локального state без внешнего store.

Рекомендуемая схема:

```ts
type AppState = {
  envText: string;
  templateText: string;
  envFilename?: string;
  templateFilename?: string;
};
```

Derived state вычисляется чистыми функциями:
- `parseEnv(envText)`
- `parseEnv(templateText)`
- `compareEnvFiles(parsedEnv, parsedTemplate)`
- `generateTemplate(parsedEnv)`
- `buildPlainTextReport(compareResult)`

Преимущества:
- меньше runtime complexity,
- бизнес-логика легко тестируется,
- React-слой остаётся тонким.

---

## 13. Ads и monetization implementation notes

## 13.1 Принципы интеграции

Ads не должны:
- вставляться между editors,
- перекрывать controls,
- маскироваться под tool actions,
- вызывать layout shift во время ввода.

## 13.2 Технические требования

Для каждого ad slot:
- фиксированный контейнер с зарезервированной высотой
- визуальное отделение от tool UI
- lazy-load, где это поддерживается ad stack

## 13.3 MVP-подход

Интеграция через компонент `AdSlot`, который:
- рендерит безопасный placeholder при отсутствии ad provider
- позволяет быстро включить/выключить slot через env/config

Это даст возможность сначала выпустить чистый tool UI, а затем подключить ads без переписывания layout.

---

## 14. Privacy, security, compliance

## 14.1 Privacy guarantees

Приложение должно явно соблюдать:
- содержимое `.env` не отправляется на сервер приложением
- содержимое не сохраняется в local storage по умолчанию
- аналитика не получает file contents

## 14.2 Security posture

Так как `.env` может содержать secrets:
- не логировать текст в console в production
- не включать crash reporting, который может сериализовать input
- избегать telemetry SDK, перехватывающих DOM/input content

## 14.3 Consent/compliance

Если ad provider требует consent:
- cookie/privacy banner должен касаться ad tech, а не core parsing logic
- tool должен оставаться usable даже до принятия consent

---

## 15. SEO и content implementation

Для MVP на tool page должны быть:
- `title`
- `meta description`
- `canonical`
- видимый intro copy
- FAQ section

Рекомендуется добавить:
- `FAQPage` schema markup
- `SoftwareApplication` schema markup
- H1 c ключевой формулировкой вокруг `.env compare` / `.env validator`

Маршрут для MVP:
- `/env-compare`

Альтернатива:
- `/env-validator`

Если route один, в metadata можно покрыть обе intent-группы.

---

## 16. Производительность

Ожидаемый профиль нагрузки:
- файлы малого и среднего размера
- десятки или сотни строк, а не тысячи

Для этого достаточно:
- линейного прохода по строкам `O(n)`
- set/map операций `O(n)`
- без web workers в MVP

Web Worker не нужен на первом релизе, если только не появятся реальные perf-проблемы.

---

## 17. Обработка ошибок и empty states

Приложение не должно падать при:
- пустом input
- полностью malformed input
- очень коротком input
- загрузке не-`.env` файла с plain text contents

Empty states:
- если оба поля пустые, показывать helper state
- если заполнено только одно поле, показывать частичные parse results и подсказку добавить второй файл
- если parser нашёл ошибки, результаты сравнения всё равно строятся по валидным ключам

---

## 18. Тестовая стратегия

## 18.1 Unit tests

Покрыть:
- парсинг blank/comment/assignment/malformed lines
- invalid key detection
- duplicate detection
- empty value detection
- whitespace warnings
- compare result correctness
- template generation
- plain text report generation

## 18.2 Component tests

Проверить:
- загрузку файла в textarea
- обновление summary после изменения input
- copy/download actions
- responsive-safe rendering critical sections

## 18.3 Manual QA checklist

- Вставка текста в оба textarea
- Upload двух файлов
- Clear для каждого input
- Корректность counts
- Отображение line numbers
- Download `.env.example`
- Copy report
- Mobile layout
- Ads не ломают layout
- Privacy note заметен без скролла на типичном desktop

---

## 19. Реализация по этапам

## Этап 1. Core logic

- parser
- compare engine
- template generator
- plain text report builder
- unit tests

## Этап 2. UI shell

- page layout
- two input cards
- summary cards
- result panels
- generated template panel
- action buttons

## Этап 3. Content and release layer

- privacy note
- FAQ
- metadata
- ad slots
- manual QA

---

## 20. Release checklist

MVP готов к релизу, если:
- два input-канала работают: paste и file upload
- missing/extra keys вычисляются корректно
- duplicates и malformed lines показываются по каждому файлу
- generated `.env.example` копируется и скачивается
- отчёт копируется одним действием
- privacy note виден
- минимум 2 ad slots интегрированы безопасно для UX
- mobile layout usable
- title/meta/FAQ присутствуют

---

## 21. Ограничения и допущения

### Ограничения MVP
- не поддерживаются multiline dotenv values
- не гарантируется полная совместимость со всеми dotenv dialects
- comments не сохраняются в generated template
- semantic validation значений отсутствует

### Осознанные допущения
- last valid duplicate wins для effective comparison
- template generation идёт из `.env`
- всё вычисляется в main thread
- достаточно одного tool page без сложной навигации

---

## 22. Открытые вопросы на будущее

Эти вопросы не блокируют MVP, но могут стать Phase 2:
- Нужен ли режим `keys-only compare` для повышения trust?
- Нужна ли поддержка `sort output`?
- Нужна ли опция preserve comments при генерации шаблона?
- Нужна ли отдельная страница `/generate-env-example` под SEO intent?
- Нужен ли optional `export KEY=value` toggle вместо always-on compatibility?

---

## 23. Итоговое решение

Для данного BRD оптимален простой frontend-only MVP:
- `React + TypeScript + Vite`
- client-side parser/compare engine
- static hosting
- zero backend dependency
- аккуратно изолированные ads

Такой дизайн покрывает все release criteria из BRD, остаётся дешёвым в поддержке и подходит под быстрый запуск micro-tool.
