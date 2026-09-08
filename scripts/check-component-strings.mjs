#!/usr/bin/env node
/**
 * Проверка полноты словаря переносимого каталога (PRD навигации 9.1).
 *
 * Строки компонентов `CrossServiceNav` и `UserMenu` объявлены не в `lang/`
 * продукта, а внутри каталога компонентов: словарь принадлежит пакету
 * и переезжает вместе с ним. Требование полноты от этого не отменяется —
 * его и проверяет этот скрипт, повторяя для одного каталога то,
 * что `check-translations.mjs` установки делает для всего приложения.
 *
 * Условие 1: состав ключей строк совпадает между всеми языками словаря.
 * Условие 2: все ключи, используемые компонентами каталога, объявлены.
 * Условие 3: перечень языков словаря совпадает с языками установки.
 *            Разошедшись, словарь оставил бы компонент без языка,
 *            который установка уже отдаёт.
 *
 * Ключ, собираемый из переменной, проверить нечем: такие места печатаются
 * отдельным перечнем как непроверяемые и сборку не роняют — то же поведение,
 * что у `check-translations.mjs`.
 *
 * Словарь читается текстом, а не ввозится: скрипт исполняется в Node, а файл
 * написан на TypeScript. Отсюда требование к формату — словарь обязан
 * оставаться плоским; вложенность роняет проверку явной ошибкой, а не молча.
 *
 * Код возврата 0 — все три условия выполнены; 1 — есть нарушения.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');
const CATALOG = 'src/cross-service';
const STRINGS = join(ROOT, CATALOG, 'strings.ts');
/**
 * Языки установки (справка identity 4.1: `ui_locales` принимает `ru` и `en`).
 *
 * В репозитории identity этот перечень читался из подкаталогов `lang/`
 * самого сервиса. У продукта установки их нет: его интерфейс одноязычен,
 * а язык подписей рейла приходит из `locale` в `/userinfo` и принадлежит
 * установке, а не продукту. Поэтому перечень задан здесь явно.
 */
const INSTALLATION_LOCALES = ['en', 'ru'];

// --- Разбор словаря ------------------------------------------------------------

/** Индекс закрывающей скобки блока, начатого сразу после `open`. */
function closingBrace(source, open) {
    let depth = 1;

    for (let index = open; index < source.length; index += 1) {
        if (source[index] === '{') {
            depth += 1;
        }

        if (source[index] === '}') {
            depth -= 1;

            if (depth === 0) {
                return index;
            }
        }
    }

    return -1;
}

/** Тело объекта `STRINGS` без охватывающих скобок. */
function stringsBody(source) {
    const declaration = source.indexOf('export const STRINGS');

    if (declaration === -1) {
        console.error(`${CATALOG}/strings.ts: объявление STRINGS не найдено`);
        process.exit(1);
    }

    const open = source.indexOf('{', source.indexOf('=', declaration));
    const close = closingBrace(source, open + 1);

    if (open === -1 || close === -1) {
        console.error(`${CATALOG}/strings.ts: объект STRINGS не разобран`);
        process.exit(1);
    }

    return source.slice(open + 1, close);
}

const LINE = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*'((?:[^'\\]|\\.)*)'\s*,?\s*$/;

/** Плоский состав ключей одного языка. */
function keysOf(locale, block) {
    const keys = new Set();

    for (const line of block.split('\n')) {
        if (line.trim() === '') {
            continue;
        }

        if (line.includes('{')) {
            console.error(`${CATALOG}/strings.ts: словарь языка «${locale}» не плоский — вложенные объекты проверке недоступны`);
            process.exit(1);
        }

        const match = LINE.exec(line);

        if (match !== null) {
            keys.add(match[1]);
        }
    }

    return keys;
}

/** Словарь по языкам: код языка → состав ключей. */
function parseCatalog(body) {
    const catalog = {};
    const pattern = /([A-Za-z][A-Za-z0-9_-]*)\s*:\s*\{/g;
    let match;

    while ((match = pattern.exec(body)) !== null) {
        const open = match.index + match[0].length;
        const close = closingBrace(body, open);

        if (close === -1) {
            console.error(`${CATALOG}/strings.ts: блок языка «${match[1]}» не закрыт`);
            process.exit(1);
        }

        catalog[match[1]] = keysOf(match[1], body.slice(open, close));
        pattern.lastIndex = close;
    }

    return catalog;
}

let source;

try {
    source = readFileSync(STRINGS, 'utf8');
} catch {
    console.error(`Словарь компонентов не прочитан: нет ${STRINGS}`);
    process.exit(1);
}

const catalog = parseCatalog(stringsBody(source));
const locales = Object.keys(catalog);

if (locales.length === 0) {
    console.error(`${CATALOG}/strings.ts: словарь пуст либо не разобран`);
    process.exit(1);
}

const violations = [];
const unverifiable = [];

// --- Условие 1: состав ключей совпадает между языками --------------------------

for (const locale of locales) {
    for (const other of locales.filter((candidate) => candidate !== locale)) {
        for (const key of catalog[locale]) {
            if (!catalog[other].has(key)) {
                violations.push(`strings.ts: у языка «${other}» нет ключа «${key}» (есть у «${locale}»)`);
            }
        }
    }
}

// --- Условие 2: используемые компонентами ключи объявлены ----------------------

const declared = new Set(locales.flatMap((locale) => [...catalog[locale]]));

function components(directory) {
    return readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) {
            return components(path);
        }

        return extname(entry.name) === '.vue' ? [path] : [];
    });
}

const CALLS = [/\bt\(\s*'([^']+)'/g, /\bt\(\s*"([^"$]+)"/g];
const DYNAMIC = /\bt\(\s*[A-Za-z_$`]/g;

for (const path of components(CATALOG)) {
    const contents = readFileSync(join(ROOT, path), 'utf8');

    for (const pattern of CALLS) {
        for (const [, key] of contents.matchAll(pattern)) {
            if (!declared.has(key)) {
                violations.push(`${path}: ключ «${key}» используется, но в словаре его нет`);
            }
        }
    }

    if (DYNAMIC.test(contents)) {
        unverifiable.push(path);
    }

    DYNAMIC.lastIndex = 0;
}

// --- Условие 3: языки словаря совпадают с языками установки --------------------

for (const locale of INSTALLATION_LOCALES) {
    if (!locales.includes(locale)) {
        violations.push(`strings.ts: нет языка «${locale}», который отдаёт установка`);
    }
}

for (const locale of locales) {
    if (!INSTALLATION_LOCALES.includes(locale)) {
        violations.push(`strings.ts: язык «${locale}» установке неизвестен`);
    }
}

// --- Отчёт ---------------------------------------------------------------------

if (unverifiable.length > 0) {
    console.warn('Непроверяемые обращения (ключ собирается из переменной):');

    for (const path of [...new Set(unverifiable)].sort()) {
        console.warn(`  ${path}`);
    }
}

if (violations.length > 0) {
    console.error(`\nНарушений: ${violations.length}`);

    for (const violation of violations.sort()) {
        console.error(`  ${violation}`);
    }

    process.exit(1);
}

console.log(`Словарь компонентов полон: ${catalog[locales[0]].size} строк в каждом из ${locales.length} языков.`);
