# План реализации: подсказка полосы внутри теневого корня пользовательского элемента

Ветка: `feature/element-tip-in-shadow-root`
Создан: 2026-09-29

## Original Request

Подсказка пункта полосы не оформлена в пользовательском элементе ./element (репозиторий /Users/smskin/PhpstormProjects/verdeect/verdeect-identity-nav-vue): NavTip выносит узел в body через Teleport, стили теневого корня на него не действуют, тёмная палитра :host([theme='dark']) не наследуется. В режиме элемента выносить подсказку в контейнер внутри теневого корня рядом с полосой (provide/inject цели Teleport, по умолчанию body), для Vue-входов без изменений.

## Settings

- Testing: yes — проверка собранного файла в `tests/elementBundle.spec.ts` (браузер наборы пакета не поднимают, `.ai-factory/rules/base.md`, «Прогоны»); поведение в браузере — вручную на Open WebUI (`../owui`, контур разработки монтирует `dist/`)
- Logging: нет — журналирование в пакете запрещено (`base.md`, «Журналирование»; условия 6 и 13 `check:isolation`)
- Docs: yes — докблоки, `src/cross-service/CLAUDE.md`, `docs/web-component.md`, `docs/styling.md`, контракт в `.claude/skills/verdeect-cross-service/references/ENTRIES.md`, CHANGELOG
- Release: подготовить 0.4.9 (версия в `package.json`/`package-lock.json`, раздел CHANGELOG); тег и публикацию делает владелец

## Диагноз (проверено)

- `NavTip.vue` рендерит `<Teleport to="body">`. У продуктов на Vue стили пакета глобальные — подсказка оформлена.
- У элемента `./element` весь визуальный слой — в теневом корне (`IdentityNav.ce.vue`, `@import '../style.css'`). Узел в `body` его не получает: в Open WebUI с 0.4.8 — `position: static`, прозрачный фон, чёрный текст, в светлой и тёмной теме одинаково. Токены `--cross-service-color-tip-*` из `:host([theme='dark'])` до `body` не наследуются.
- Вернуть подсказку внутрь полосы нельзя: `overflow-y: auto` обрезает её по краю (`src/cross-service/CLAUDE.md`, п. про `NavTip`).
- `Teleport` принимает `to: string | HTMLElement` (документация Vue); цель обязана существовать при монтировании содержимого — подсказка монтируется только по наведению, после монтирования элемента.

## Решения

- **Ключ `NAV_TIP_TARGET`** — `InjectionKey<Readonly<Ref<HTMLElement | null>>>` в новом файле `src/cross-service/tipTarget.ts`, экспортируется входом `.`. Иначе нельзя: условие 13 `check:isolation` разрешает входу элемента импорт каталога только как `'../cross-service'`.
- **`NavTip` берёт цель из `inject(NAV_TIP_TARGET, null)`**; нет ключа или слой ещё не смонтирован — `'body'`, как сейчас. Продукты на Vue ничего не замечают. `document` компонент по-прежнему не трогает (условие 7).
- **Элемент отдаёт слой подсказок** — пустой `div.cross-service-nav__tip-layer` в теневом корне **рядом** с видом, не внутри полосы (иначе обрежет `overflow`). `display: contents`: слой не занимает места, а `position: fixed` подсказки отсчитывается от окна, как и в `body`. Предков с `transform`/`filter`/`contain` у слоя нет — хост `display: contents`.
- Внутри теневого корня подсказка получает стили `nav-shared.css`, шрифт и сброс `:host`, токены темы — от хоста (`:host([theme='dark'])`).
- В плашке (`placement="bottom"`) подсказок нет — слой пустует, вреда нет.
- Версия — patch 0.4.9: контракт данных не меняется, добавляется только ключ во входе `.` (правило нумерации — CHANGELOG, шапка).

## Requirements Reconciliation

Источники: `src/cross-service/CLAUDE.md` (подсказка обязана выходить из прокручиваемой полосы), `.ai-factory/rules/base.md` и `scripts/check-component-isolation.mjs` (условия 7, 13: без `document`, импорт каталога элементом только через индекс), `docs/styling.md` «Тёмная тема» (палитра подсказки). Противоречий нет.

| Вход | Тема | Где узел подсказки | Ожидаемое оформление | Проверка |
|---|---|---|---|---|
| Vue (`.`) | светлая / `.app-dark` | `body` (как прежде) | глобальные стили, токены от `<html>` | статически: без `provide` ветка `'body'`; `npm test` |
| `./element`, `rail` | `theme` не задан / `light` | слой в теневом корне | фон `#1b1b1b`, текст `#fff`, `position: fixed` | Open WebUI, светлая тема |
| `./element`, `rail` | `theme="dark"` | слой в теневом корне | фон `#f2f2f2`, текст `#1b1b1b` | Open WebUI, тёмная тема |
| `./element`, `bottom` | любая | подсказок нет | — | Open WebUI, узкий экран |

## Tasks

### Фаза 1: цель переноса

- [x] **Задача 1. Ключ цели подсказки в каталоге**
  - Новый файл `src/cross-service/tipTarget.ts`: `export const NAV_TIP_TARGET: InjectionKey<Readonly<Ref<HTMLElement | null>>> = Symbol('cross-service-nav-tip-target');` с докблоком (почему существует: элемент не может отдать узел строкой — селектор разрешается в документе, а не в теневом корне; кто отдаёт; что без него — `body`).
  - `src/cross-service/index.ts`: экспорт `NAV_TIP_TARGET` и абзац в докблоке.
  - Журнал: нет (запрещён).

- [x] **Задача 2. `NavTip` переносит подсказку в отданную цель** (после 1)
  - `src/cross-service/NavTip.vue`: `const target = inject(NAV_TIP_TARGET, null);` и `const to = computed((): string | HTMLElement => target?.value ?? 'body');`, в шаблоне `<Teleport :to="to">`.
  - Докблок: «узел уезжает в `body`» → «из полосы наружу: в `body` либо в слой, отданный хозяином (элемент)»; условие 7 по-прежнему соблюдено.
  - Журнал: нет.

- [x] **Задача 3. Элемент отдаёт слой подсказок в теневом корне** (после 1)
  - `src/element/IdentityNav.ce.vue`: `const tipLayer = ref<HTMLElement | null>(null); provide(NAV_TIP_TARGET, tipLayer);`, в шаблоне после видов `<div ref="tipLayer" class="cross-service-nav__tip-layer" />`; в `<style>` правило `.cross-service-nav__tip-layer { display: contents; }` с объяснением.
  - Докблок элемента: пункт о подсказке (почему не `body`, почему рядом с видом, а не в полосе).
  - Журнал: нет.

### Фаза 2: проверки и документация

- [x] **Задача 4. Набор собранного файла** (после 3)
  - `tests/elementBundle.spec.ts`: тест «подсказка переносится в слой теневого корня» — бандл содержит `cross-service-nav__tip-layer` и правило `.cross-service-nav__tip` (оформление подсказки внутри теневого корня).
  - Прогнать `npm test` целиком.

- [ ] **Задача 5. Документация, контракт и версия 0.4.9** (после 2–3)
  - `src/cross-service/CLAUDE.md` (п. про подсказку), комментарии `src/styles/nav-shared.css` (~235) и `src/styles/dark.css` (~19): «в `body` или в слой элемента».
  - `docs/web-component.md`: подсказка живёт в теневом корне и следует `theme`; `docs/styling.md` «Тёмная тема»: оговорка про `body` — только для Vue-входов.
  - `.claude/skills/verdeect-cross-service/references/ENTRIES.md`: `NAV_TIP_TARGET` в составе входа `.`.
  - `CHANGELOG.md`: раздел `## 0.4.9` (Исправлено / Добавлено / Почему patch / Миграция), `package.json` и `package-lock.json` → `0.4.9` (`npm version 0.4.9 --no-git-tag-version`).
  - `AGENTS.md`: только если изменилось описание наборов.

- [x] **Задача 6. Проверка в браузере на Open WebUI** (после 3)
  - `npm run build:element`; контур `../owui` монтирует `dist/` (`OWUI_IDENTITY_NAV_DIST`), обновить страницу.
  - Светлая тема: наведение на пункт полосы — подсказка оформлена, справа от пункта, узел `.cross-service-nav__tip` в `nav.shadowRoot`, в `document.body` узлов пакета нет.
  - Тёмная тема: фон подсказки `#f2f2f2`, текст `#1b1b1b`.
  - Шестерёнка (`SettingsLink`) — та же подсказка.
  - Уход указателя — узел исчезает.

## Commit Plan

- **Коммит 1** (задачи 1–4): `fix(element): keep the rail tooltip inside the shadow root`
- **Коммит 2** (задача 5, релизная часть): `chore(release): 0.4.9` — документация уходит в коммит 1, если правится вместе с кодом
