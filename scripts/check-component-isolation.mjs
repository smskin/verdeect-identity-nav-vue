#!/usr/bin/env node
/**
 * Проверка изоляции каталога компонентов и ядра вывода состояния.
 *
 * Каталог `src/cross-service` — эталон, из которого продукты установки
 * получают рейл и блок пользователя. Правила ниже держат его переносимым:
 * данные приходят только props, зависимость ровно одна — `vue`, а решения,
 * принадлежащие продукту (пороги ширины, адреса, хранилища), внутрь
 * не проникают. Без этой проверки первая же «мелкая правка» разошлась бы
 * с эталоном незаметно.
 *
 * Переносимость касается и рантайма: каталог не пишет в консоль и не трогает
 * `import.meta` (условия 6 и 6a). Конструкции бандлера вроде `import.meta.env`
 * существуют только внутри его сборки, и вне её обращение к ним роняет ветку,
 * в которой стоит, — у потребителя, который собирает пакет не тем, чем мы
 * предполагали.
 *
 * Отдельным условием проверяется ядро `src/identity`: оно обязано
 * разбираться без установленного `@inertiajs/vue3`. Ради этого ядро
 * и отделено от адаптера — утечка импорта обнаружилась бы иначе только
 * у потребителя, собравшего продукт не на Inertia.
 *
 * Условиями 11 и 12 проверяется адаптер `src/public` — вход режима «Лендинг
 * без бэкенда». **Ему одному в пакете разрешён сетевой запрос**: лендинг
 * не имеет серверной части, и данные рейла некому получить, кроме браузера.
 * Компоненты при этом по-прежнему получают данные props — запрос живёт
 * в адаптере, как `usePage()` живёт в `src/inertia`. Всё прочее, что
 * запрещено каталогу, адаптеру тоже запрещено: хранилища, консоль,
 * `import.meta`, зашитые адреса. Ядро об адаптере знать не должно.
 *
 * Условием 13 проверяется вход `src/element` — пользовательский элемент для
 * продуктов не на Vue. **Ему одному в пакете разрешена сборка**: у такого
 * продукта нет Vite, и исходники `.vue` ему взять нечем. Остальные запреты
 * каталога действуют и там. Условие 14 держит исключение узким: входы,
 * поставляемые исходниками, о собираемом входе не знают.
 *
 * Исходники проверяются чтением, как и в наборе, из которого проверка
 * перенесена: поведение с перехватом проверяют браузерные сценарии
 * продуктов.
 *
 * Код возврата 0 — нарушений нет; 1 — есть.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');
const CATALOG = 'src/cross-service';
const CORE = 'src/identity';
const PUBLIC_ADAPTER = 'src/public';
const ELEMENT = 'src/element';
/**
 * Визуальный слой: вход и файлы, которые он импортирует.
 *
 * Перечнем **не задаётся**, а вычисляется обходом: правила разъехались
 * по видам навигации, и забытый в перечне файл выпал бы из условий 8 и 10
 * молча — а именно они держат пороги ширины и шрифт иконок вне пакета.
 */
const STYLE_DIR = 'src';

/**
 * Файлы каталога, которым разрешено обращаться к `document`, и основание.
 *
 * `UserMenu.vue` — слушатели закрытия меню, живущие только пока меню раскрыто.
 * Правка перечня обязана сопровождаться доводом здесь же: иначе он перестанет
 * что-либо значить.
 *
 * `barHeight.ts` — переменная оформления с высотой плашки внизу экрана.
 * Переменная видна только потомкам узла, на котором объявлена, а адресована
 * она **чужой оболочке**: отступ содержимому отводит продукт, и другого общего
 * предка, кроме корня документа, у плашки с его прокручиваемым узлом нет.
 * Прежде высоту записывали числом в каждом продукте, и три источника одной
 * величины разошлись. Обращение сведено в один модуль намеренно: компоненты
 * каталога к `document` по-прежнему не обращаются, и `CrossServiceBar.vue`
 * в перечне не стоит.
 *
 * **`CrossServiceNav.vue` из перечня убран.** Он стоял здесь ради чтения
 * псевдоэлемента собственного узла — так выяснялось, нарисован ли глиф иконки.
 * С переходом на загружаемые иконки (PRD навигации 9.4) выяснять нечего:
 * о неудаче сообщает событие `error` самой картинки. Возвращать запись
 * не следует — рейл обращений к DOM больше не делает.
 */
const DOCUMENT_ALLOWED = [
    `${CATALOG}/UserMenu.vue`,
    `${CATALOG}/barHeight.ts`,
];

/**
 * Файлы каталога, которым разрешён `fetch`, и основание.
 *
 * `iconSource.ts` — файл иконки пункта по адресу, пришедшему props. Данных
 * рейла он не запрашивает: прежде тот же файл забирал обозреватель по `src`
 * картинки и по адресу маски. Два пути грузили один адрес в разных режимах
 * CORS, и Safari портил ими общую запись кэша — иконки пропадали. Один запрос
 * в одном режиме, а маске — `data:`, и портить нечего. Обращение сведено
 * в один модуль намеренно: компоненты каталога в сеть не ходят, и `NavIcon.vue`
 * в перечне не стоит.
 */
const FETCH_ALLOWED = [`${CATALOG}/iconSource.ts`];

function sources(directory) {
    return readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap(
        (entry) => {
            const path = join(directory, entry.name);

            if (entry.isDirectory()) {
                return sources(path);
            }

            return ['.ts', '.vue'].includes(extname(entry.name)) ? [path] : [];
        },
    );
}

/**
 * Исходник без комментариев.
 *
 * Запрет относится к коду, а не к его объяснению: ссылка на адрес либо
 * упоминание понятия в докблоке полезны и правилу не противоречат.
 * Строчный комментарий распознаётся только в начале строки или после
 * пробела — иначе выражение вида `https://` съело бы половину строки.
 */
function code(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

const catalog = sources(CATALOG)
    .sort()
    .map((path) => ({ path, code: code(readFileSync(join(ROOT, path), 'utf8')) }));

const violations = [];

function forbid(needles, message) {
    for (const { path, code: contents } of catalog) {
        for (const needle of needles) {
            if (contents.includes(needle)) {
                violations.push(`${path}: ${needle} — ${message}`);
            }
        }
    }
}

// --- Условие 1: данные приходят props, а не запросом ---------------------------

forbid(
    ['XMLHttpRequest', 'axios', 'navigator.sendBeacon', 'EventSource', 'WebSocket'],
    'данные приходят props, а не запросом',
);

/*
 * `fetch` ищется словом, а не вызовом `fetch(`: разрешённый модуль передаёт
 * его параметром, и вызов под другим именем прошёл бы мимо иголки.
 */
for (const { path, code: contents } of catalog) {
    if (/\bfetch\b/.test(contents) && !FETCH_ALLOWED.includes(path)) {
        violations.push(`${path}: fetch — данные приходят props; файлы иконок забирает только iconSource.ts`);
    }
}

// --- Условие 2: кэш живёт на бэкенде продукта ----------------------------------

forbid(
    ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie'],
    'кэш живёт на бэкенде продукта, а не в браузере',
);

// --- Условие 3: допустимы только vue и файлы каталога --------------------------

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;

for (const { path, code: contents } of catalog) {
    for (const [, specifier] of contents.matchAll(IMPORT)) {
        if (specifier !== 'vue' && !specifier.startsWith('./')) {
            violations.push(
                `${path}: ${specifier} — допустимы только vue и файлы каталога`,
            );
        }
    }
}

// --- Условие 4: адреса приходят в данных ---------------------------------------

for (const { path, code: contents } of catalog) {
    if (/https?:\/\//i.test(contents)) {
        violations.push(`${path}: адреса приходят в данных, а не зашиты в код`);
    }
}

// --- Условие 5: ключей доступа в браузере не бывает ----------------------------

for (const { path, code: contents } of catalog) {
    if (contents.toLowerCase().includes('token')) {
        violations.push(`${path}: ключей доступа в браузере не бывает`);
    }
}

// --- Условие 6: в консоль каталог не пишет вовсе -------------------------------

for (const { path, code: contents } of catalog) {
    const count = contents.split('console.').length - 1;

    if (count > 0) {
        violations.push(`${path}: обращений к консоли ${count}, разрешено 0`);
    }
}

/*
 * Условие 6a: каталог не зависит от рантайма бандлера.
 *
 * `import.meta.env` подставляет Vite при сборке. Каталог поставляется
 * исходниками и не вправе предполагать, чем собран потребитель: вне сборки
 * Vite — при отрисовке на сервере либо у другого бандлера — обращение к ней
 * даёт `TypeError` и роняет ветку, в которой стоит. Так и было: под этой
 * проверкой жило предупреждение о неизвестном языке, и неизвестный язык
 * ронял рейл вместо того, чтобы отступить к запасной строке.
 */
for (const { path, code: contents } of catalog) {
    if (contents.includes('import.meta')) {
        violations.push(
            `${path}: import.meta — каталог не зависит от рантайма бандлера`,
        );
    }
}

// --- Условие 7: перечень мест обращения к document закреплён -------------------

for (const { path, code: contents } of catalog) {
    if (contents.includes('document.') && !DOCUMENT_ALLOWED.includes(path)) {
        violations.push(
            `${path}: обращение к document вне перечня, закреплённого константой`,
        );
    }
}

// --- Условие 8: порог принадлежит навигации продукта ---------------------------

const THRESHOLDS = ['991', '992', '1024', 'matchMedia', 'innerWidth'];
function stylesheets(directory) {
    return readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap(
        (entry) => {
            const path = join(directory, entry.name);

            if (entry.isDirectory()) {
                return stylesheets(path);
            }

            return extname(entry.name) === '.css' ? [path] : [];
        },
    );
}

const styled = [
    ...catalog,
    ...stylesheets(STYLE_DIR)
        .sort()
        .map((path) => ({
            path,
            code: code(readFileSync(join(ROOT, path), 'utf8')),
        })),
];

for (const { path, code: contents } of styled) {
    for (const needle of THRESHOLDS) {
        if (contents.includes(needle)) {
            violations.push(
                `${path}: ${needle} — порог принадлежит навигации продукта`,
            );
        }
    }
}

// --- Условие 9: ядро вывода состояния обходится без Inertia --------------------

for (const path of sources(CORE).sort()) {
    const contents = code(readFileSync(join(ROOT, path), 'utf8'));

    for (const [, specifier] of contents.matchAll(IMPORT)) {
        const allowed = specifier === 'vue' || specifier.startsWith('./') || specifier.startsWith('../cross-service');

        if (!allowed) {
            violations.push(
                `${path}: ${specifier} — ядро обязано разбираться без Inertia и прочих зависимостей`,
            );
        }
    }
}

// --- Условие 10: шрифта иконок каталог не требует ------------------------------

/*
 * Глифы рисуются встроенным SVG, и это не вкусовое решение: класс `pi pi-*`
 * обязывает продукт подключить шрифт PrimeIcons. Продукты о нём не знают
 * и подключать не обязаны, а без шрифта глиф не отрисовывается **молча** —
 * на его месте пустота, и разметка при этом выглядит исправной.
 *
 * Проверка нужна потому, что нарушение этого правила не даёт ни отказа
 * сборки, ни красного теста: в identity-service шрифт есть, и правка
 * выглядела бы работающей у того, кто её внёс. Так уже было — рейл рисовал
 * иконки глифами полгода, и цена выяснилась при первом же продукте без
 * шрифта.
 *
 * `\b` перед `pi-` обязателен: без него правило спотыкалось бы о `api-`
 * и `spi-`.
 */
const ICON_FONT = /\bpi-[a-z]|primeicons/i;

for (const { path, code: contents } of styled) {
    if (ICON_FONT.test(contents)) {
        violations.push(
            `${path}: шрифта иконок каталог не требует — глиф рисуется встроенным SVG`,
        );
    }
}

// --- Условие 11: адаптер публичной навигации ----------------------------------

/*
 * Сетевой запрос здесь разрешён — ради него адаптер и существует. Остальные
 * запреты каталога действуют: кэш ответа живёт в установке и в браузере
 * по `Cache-Control`, а не в хранилище страницы; журнала в пакете нет;
 * адрес установки приходит опцией.
 */
const PUBLIC_ALLOWED_IMPORTS = ['vue', '../identity', '../cross-service'];

for (const path of sources(PUBLIC_ADAPTER).sort()) {
    const contents = code(readFileSync(join(ROOT, path), 'utf8'));

    for (const [, specifier] of contents.matchAll(IMPORT)) {
        if (!specifier.startsWith('./') && !PUBLIC_ALLOWED_IMPORTS.includes(specifier)) {
            violations.push(
                `${path}: ${specifier} — адаптер публичной навигации зависит только от vue и ядра`,
            );
        }
    }

    for (const needle of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
        if (contents.includes(needle)) {
            violations.push(`${path}: ${needle} — кэш ответа живёт в установке и в браузере, а не в хранилище`);
        }
    }

    if (contents.includes('console.')) {
        violations.push(`${path}: console — журнала в пакете нет, причина отказа возвращается данными`);
    }

    if (contents.includes('import.meta')) {
        violations.push(`${path}: import.meta — адаптер не зависит от рантайма бандлера`);
    }

    if (/https?:\/\//i.test(contents)) {
        violations.push(`${path}: адрес установки приходит опцией, а не зашит в код`);
    }
}

// --- Условие 12: ядро не знает об адаптере публичной навигации -----------------

for (const path of [...sources(CATALOG), ...sources(CORE)].sort()) {
    const contents = code(readFileSync(join(ROOT, path), 'utf8'));

    for (const [, specifier] of contents.matchAll(IMPORT)) {
        if (specifier.includes('/public')) {
            violations.push(`${path}: ${specifier} — ядро об адаптере публичной навигации не знает`);
        }
    }
}

// --- Условие 13: вход пользовательского элемента --------------------------------

/*
 * `src/element` — единственный собираемый вход: его собирает Vite пакета,
 * а не потребителя, и Vue уходит внутрь бандла. Разрешение касается только
 * сборки. Всё, что запрещено каталогу, запрещено и здесь: данные приходят
 * свойствами элемента, журнала нет, адреса и ключи не зашиты, а вид выбирает
 * продукт атрибутом — порог ширины в элементе был бы тем же дефектом,
 * что и в каталоге. `document` не нужен: переменную высоты плашки пишет
 * `barHeight.ts` каталога.
 *
 * Разрешённые импорты — `vue`, файлы входа, компоненты каталога и визуальный
 * слой (`@import` в стилях `.ce.vue`, разворачивается при сборке).
 */
const ELEMENT_ALLOWED_IMPORTS = ['vue', '../cross-service', '../style.css'];

const ELEMENT_FORBIDDEN = [
    ['fetch(', 'данные приходят свойствами элемента, а не запросом'],
    ['XMLHttpRequest', 'данные приходят свойствами элемента, а не запросом'],
    ['localStorage', 'кэш живёт на бэкенде продукта'],
    ['sessionStorage', 'кэш живёт на бэкенде продукта'],
    ['indexedDB', 'кэш живёт на бэкенде продукта'],
    ['console.', 'журнала в пакете нет'],
    ['import.meta', 'рантайм бандлера коду входа не нужен — сборка его подставила бы молча'],
    ['document.', 'к документу обращается только barHeight.ts каталога'],
    ...THRESHOLDS.map((needle) => [needle, 'вид выбирает продукт атрибутом placement, порог принадлежит ему']),
];

const element = sources(ELEMENT).sort();

for (const path of element) {
    const contents = code(readFileSync(join(ROOT, path), 'utf8'));

    for (const [, specifier] of contents.matchAll(IMPORT)) {
        if (!specifier.startsWith('./') && !ELEMENT_ALLOWED_IMPORTS.includes(specifier)) {
            violations.push(
                `${path}: ${specifier} — вход элемента зависит только от vue, каталога и визуального слоя`,
            );
        }
    }

    for (const [needle, message] of ELEMENT_FORBIDDEN) {
        if (contents.includes(needle)) {
            violations.push(`${path}: ${needle} — ${message}`);
        }
    }

    if (/https?:\/\//i.test(contents)) {
        violations.push(`${path}: адреса приходят свойствами элемента, а не зашиты в код`);
    }

    if (contents.toLowerCase().includes('token')) {
        violations.push(`${path}: ключей доступа в браузере не бывает`);
    }
}

// --- Условие 14: прочие входы о сборке не знают --------------------------------

/*
 * Исключение для сборки не должно расползтись: каталог, ядро и адаптеры
 * поставляются исходниками, и ссылка из них на вход элемента притащила бы
 * рантайм бандлера туда, где его нет. Импорт с суффиксом `?inline` —
 * конструкция Vite и вне собираемого входа не нужен вовсе.
 */
for (const path of [...sources('src')].filter((path) => !path.startsWith(ELEMENT)).sort()) {
    const contents = code(readFileSync(join(ROOT, path), 'utf8'));

    for (const [, specifier] of contents.matchAll(IMPORT)) {
        if (specifier.includes('/element') || specifier.includes('?')) {
            violations.push(`${path}: ${specifier} — входы из исходников о собираемом входе не знают`);
        }
    }
}

// --- Отчёт ---------------------------------------------------------------------

if (violations.length > 0) {
    console.error(`Нарушений: ${violations.length}`);

    for (const violation of violations.sort()) {
        console.error(`  ${violation}`);
    }

    process.exit(1);
}

console.log(
    `Каталог компонентов изолирован: ${catalog.length} файлов, ` +
        `${styled.length - catalog.length} таблиц стилей, ядро без Inertia, ` +
        `адаптер публичной навигации: ${sources(PUBLIC_ADAPTER).length} файлов, ` +
        `вход элемента: ${element.length} файлов.`,
);
