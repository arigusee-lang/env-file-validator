# Техдиз — `properties-file-validator`

**Версия:** 0.1  
**Дата:** 2026-04-01  
**Статус:** Draft / planned  
**Базовый сайт:** `https://envvalidator.com/`  
**Целевая страница:** `https://envvalidator.com/properties-file-validator`

---

## 1. Цель

Добавить на текущий домен отдельную SEO-страницу и отдельный режим валидации для Java-style `.properties` файлов, не размывая главный `.env`-tool.

Важно:
- не превращать главную в generic config validator
- не добавлять selector формата на главную страницу
- использовать максимум уже существующего UI и parser/comparison pipeline

Итоговая модель:
- `/` — `.env` validator
- `/properties-file-validator` — `.properties` validator

---

## 2. Продуктовое позиционирование

Новая страница должна быть отдельным, узким инструментом:
- `Properties File Validator`
- `Compare .properties files against a reference template`
- `Validate application.properties / config.properties against a template`

Это отдельный SEO intent, а не generic extension текущего H1.

---

## 3. High-level решение

### 3.1 Что реюзаем

Из текущего `.env` инструмента можно почти без изменений переиспользовать:
- side-by-side / multi-file editor UI
- drag-and-drop / bulk upload
- rename env/file widgets
- hover tooltips и linked line highlighting
- summary cards
- grouped issue panels
- copy text report
- download all
- fullscreen / row / grid режимы
- ad layout
- privacy / footer / SEO shell

### 3.2 Что меняем

Нужно заменить только format-specific слой:
- parser
- compare labeling / wording
- demo files
- hero / FAQ / metadata
- file detection hints

### 3.3 Архитектурный подход

Вместо второго полностью отдельного SPA лучше сделать:
- `validator configs`
- `format adapter`

Примерно так:

```ts
type ValidatorFormat = 'env' | 'properties';

type ValidatorConfig = {
  id: ValidatorFormat;
  routePath: string;
  pageTitle: string;
  pageDescription: string;
  parser: (input: string, source: SourceFile) => ParsedConfigFile;
  compare: (...) => CompareResult;
  buildReport: (...) => string;
  demoData: ...;
  fileNameSuggestions: string[];
  seo: ...;
};
```

Главный `App` или легковесный pathname-router выбирает config по `window.location.pathname`.

Для MVP достаточно:
- без `react-router`
- с простым route switch по pathname

---

## 4. Route strategy

### 4.1 URL

Новая страница:
- `/properties-file-validator`

Почему так:
- понятный exact intent
- хороший match под SEO query
- не конфликтует с главной `.env` страницей

### 4.2 Sitemap

Теперь sitemap уже нужен.

Минимальный `sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://envvalidator.com/</loc>
  </url>
  <url>
    <loc>https://envvalidator.com/properties-file-validator</loc>
  </url>
</urlset>
```

И `robots.txt` потом нужно обновить:

```txt
User-agent: *
Allow: /

Sitemap: https://envvalidator.com/sitemap.xml
```

---

## 5. Специфика `.properties`

### 5.1 Что считаем supported syntax

Для первой версии стоит поддержать common Java properties syntax:
- `key=value`
- `key:value`
- `key value`
- optional leading whitespace
- comments starting with `#` or `!`
- escaped separators like `\=` / `\:`
- line continuation через trailing backslash `\`

### 5.2 Что НЕ нужно в первой версии

Не надо пытаться покрыть все экзотические кейсы Java parser behavior:
- Unicode escape decoding как feature UI
- value-level semantic validation
- nested schema validation
- interpolation/expansion

### 5.3 Key normalization

Для `.properties` ключи обычно case-sensitive.

Значит:
- `db.host` и `DB.HOST` — разные ключи
- `spring.datasource.url` и `spring.datasource.url ` после trim — один и тот же

### 5.4 Empty values

Для `.properties` пустое значение само по себе не всегда ошибка.

Нужна такая политика:
- `key=` в **template**: нормальный placeholder
- `key=` в **runtime file**:
  - warning по умолчанию
  - не malformed

Почему:
- в `.env` пустой secret обычно реально плох
- в `.properties` пустые значения встречаются заметно чаще как допустимый config state

### 5.5 Duplicates

Дубли считаем ошибкой, как и в `.env`.

Effective policy:
- last valid value wins
- duplicate group показываем отдельно

### 5.6 Continuation lines

Нужно поддержать:

```properties
banner.message=Hello \
world
```

и

```properties
long.value=first line\
second line\
third line
```

UI должен:
- подсвечивать continuation lines
- уметь linked highlight по всей multiline group

---

## 6. Proposed validation model

### 6.1 Template vs environments

Как и в `.env`, левая панель:
- reference template `.properties`

Правая зона:
- один или несколько `.properties` runtime files

### 6.2 Types of issues

Для первой версии:

**Errors**
- missing required keys
- duplicate keys
- malformed lines

**Warnings**
- undocumented keys
- empty runtime values
- whitespace normalization issues

### 6.3 Missing rules

Тут желательно не тащить `.env` модель один-в-один.

Предлагаю:
- если template key имеет пустое значение, это **не значит optional**
- в `.properties` template почти всегда просто reference file
- значит missing key считаем по наличию key в template, независимо от default value

То есть в `.properties`:
- все template keys участвуют в required comparison

Это одно из главных отличий от `.env`.

### 6.4 Undocumented keys

Как и сейчас:
- ключ есть в runtime `.properties`
- ключа нет в template
- это warning

---

## 7. UI strategy

### 7.1 Общий layout

Оставляем почти без изменений:
- верхняя hero
- workspace
- action bar
- summary
- result sections
- FAQ
- footer

### 7.2 Page-specific copy

Нужен отдельный текст:
- H1
- lede
- FAQ
- empty-state text
- demo labels

### 7.3 Demo files

Нужно дать demo, показывающий реальные `.properties` кейсы:
- `application.properties`
- `application-dev.properties`
- `application-qa.properties`
- `application-prod.properties`

С примерами:
- missing required property
- undocumented property
- duplicate property
- malformed property
- multiline continuation
- comment lines with `#` and `!`

### 7.4 File detection

Bulk upload heuristics для route `/properties-file-validator`:
- template candidate:
  - `application.properties`
  - `config.properties`
  - `reference.properties`
- остальные:
  - `application-dev.properties`
  - `application-qa.properties`
  - `application-prod.properties`
  - `application-local.properties`

Fallback:
- если template candidate не найден, первый файл становится template

---

## 8. Ads strategy

### 8.1 Нужно ли делать новые слоты?

Технически можно использовать те же AdSense ad units на нескольких страницах.

Но для продукта лучше заложить такую политику:
- **на старте можно реюзнуть текущие slot IDs**
- **если later нужен отдельный reporting / RPM analysis по страницам, лучше завести отдельные ad units или custom channels**

Итоговое решение для MVP:
- не блокировать запуск новой страницы ожиданием новых ad units
- оставить те же `VITE_ADSENSE_SLOT_A/B/C`

Later optimization:
- либо отдельные slots на properties page
- либо custom channels для page-level performance tracking

### 8.2 Почему это решение нормальное

Это уменьшает:
- setup friction
- количество обязательных действий до релиза

И оставляет путь для дальнейшей аналитики.

### 8.3 Layout

Ad placement на `/properties-file-validator` должен остаться тем же, что и на главной:
- top banner
- results/banner area
- sidebar ad

Чтобы:
- не проектировать второй ad layout
- не ломать UX consistency

---

## 9. SEO plan

### 9.1 New page metadata

Для `/properties-file-validator` нужны отдельные:
- `title`
- `meta description`
- `canonical`
- `og:title`
- `og:description`
- `og:url`
- `og:image`
- `twitter:*`

### 9.2 Suggested SEO copy

**Title**
- `Properties File Validator - Compare .properties Files Against a Template`

**H1**
- `Validate multiple .properties files against one reference template.`

**Meta description**
- `Validate application.properties, application-dev.properties, application-qa.properties, and application-prod.properties against a reference template. Find missing keys, extra keys, duplicates, malformed lines, and warnings in the browser.`

### 9.3 FAQ candidate topics

Нужны 3-4 узких вопроса:
- Does this tool upload any .properties files?
- What counts as a missing property?
- Are duplicate and malformed lines validated in the template too?
- Which .properties syntax is supported?

### 9.4 Structured data

Нужно переиспользовать текущий JSON-LD подход:
- `SoftwareApplication`
- `FAQPage`

Но name/description должны быть route-specific.

---

## 10. AdSense meta tag

Текущий:

```html
<meta name="google-adsense-account" content="ca-pub-..." />
```

Нужно сохранить на уровне общего HTML shell.

Отдельный тег для `/properties-file-validator` не нужен, если страница живёт внутри того же сайта и того же shell.

---

## 11. Implementation plan

### Этап 1. Internal architecture split
- выделить route-specific config
- сделать `env` и `properties` page configs
- вынести route-aware metadata builder

### Этап 2. Properties parser/comparer
- добавить `parseProperties`
- добавить `comparePropertiesFiles`
- отдельные tests для syntax specifics

### Этап 3. Route page
- route `/properties-file-validator`
- отдельный hero/FAQ/demo/metadata
- отдельный page copy

### Этап 4. SEO and crawlability
- добавить `sitemap.xml`
- обновить `robots.txt` со ссылкой на sitemap
- проверить canonical/og:url на обеих страницах

### Этап 5. Ads and QA
- подключить existing ad slots
- убедиться, что page renders without layout regressions
- manual QA for light/dark, mobile, fullscreen, drag/drop

---

## 12. Risks

### 12.1 Main product risk

Если просто “натянуть” `.env` semantics на `.properties`, получится неправильная логика missing/default handling.

Главное отличие:
- `.env` template defaults => optional semantics
- `.properties` template defaults чаще остаются частью required contract

### 12.2 SEO risk

Если сделать generic page instead of dedicated route:
- размоется intent
- просядет relevance both for `.env` and `.properties`

### 12.3 UX risk

Если добавить selector формата прямо на главную:
- ухудшится clarity
- вырастет cognitive load
- снизится conversion into the `.env` tool

---

## 13. Recommended decision

Идти так:
- оставить `/` строго `.env`-focused
- сделать `/properties-file-validator` как отдельную страницу на том же домене
- реюзнуть общий UI shell, ad layout и page mechanics
- сделать отдельный parser/comparison adapter для `.properties`
- добавить `sitemap.xml`
- на старте использовать текущие AdSense slots, а separate slots решать уже по данным

Это минимизирует:
- продуктовый риск
- SEO dilution
- количество новой инфраструктуры

И даёт лучший баланс между:
- reuse текущего кода
- чистым positioning
- скоростью выпуска второй страницы
