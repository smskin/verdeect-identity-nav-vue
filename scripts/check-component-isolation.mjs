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
 * Отдельным условием проверяется ядро `src/identity`: оно обязано
 * разбираться без установленного `@inertiajs/vue3`. Ради этого ядро
 * и отделено от адаптера — утечка импорта обнаружилась бы иначе только
 * у потребителя, собравшего продукт не на Inertia.
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
const STYLE = 'src/style.css';

/**
 * Файлы каталога, которым разрешено обращаться к `document`, и основание.
 *
 * `UserMenu.vue` — слушатели закрытия меню, живущие только пока меню раскрыто.
 * Правка перечня обязана сопровождаться доводом здесь же: иначе он перестанет
 * что-либо значить.
 *
 * **`CrossServiceNav.vue` из перечня убран.** Он стоял здесь ради чтения
 * псевдоэлемента собственного узла — так выяснялось, нарисован ли глиф иконки.
 * С переходом на загружаемые иконки (PRD навигации 9.4) выяснять нечего:
 * о неудаче сообщает событие `error` самой картинки. Возвращать запись
 * не следует — рейл обращений к DOM больше не делает.
 */
const DOCUMENT_ALLOWED = [`${CATALOG}/UserMenu.vue`];

/** Единственное допустимое обращение к консоли и его место. */
const CONSOLE_ALLOWED = { [`${CATALOG}/strings.ts`]: 1 };

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
    ['fetch(', 'XMLHttpRequest', 'axios', 'navigator.sendBeacon', 'EventSource', 'WebSocket'],
    'данные приходят props, а не запросом',
);

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

// --- Условие 6: консоль — только предупреждение о неизвестном языке ------------

for (const { path, code: contents } of catalog) {
    const count = contents.split('console.').length - 1;

    if (count === 0) {
        continue;
    }

    if (CONSOLE_ALLOWED[path] !== count) {
        violations.push(
            `${path}: обращений к консоли ${count}, разрешено ${CONSOLE_ALLOWED[path] ?? 0}`,
        );
    }
}

const strings = readFileSync(join(ROOT, CATALOG, 'strings.ts'), 'utf8');

if (!/import\.meta\.env\.DEV\s*\)\s*\{\s*console\./.test(strings)) {
    violations.push(
        `${CATALOG}/strings.ts: обращение к консоли не обёрнуто проверкой режима разработки`,
    );
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
const styled = [
    ...catalog,
    { path: STYLE, code: code(readFileSync(join(ROOT, STYLE), 'utf8')) },
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

// --- Отчёт ---------------------------------------------------------------------

if (violations.length > 0) {
    console.error(`Нарушений: ${violations.length}`);

    for (const violation of violations.sort()) {
        console.error(`  ${violation}`);
    }

    process.exit(1);
}

console.log(
    `Каталог компонентов изолирован: ${catalog.length} файлов, ядро без Inertia.`,
);
