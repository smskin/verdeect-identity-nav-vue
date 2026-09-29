import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Палитра навигации в двух вариантах — чтением файлов стилей, без браузера.
 *
 * **Ловится то, чего глазами не видно до первой тёмной темы.** Цвет, записанный
 * литералом в правиле вида, или токен без тёмной пары в светлой теме ничем
 * себя не выдают: пятно появляется только у продукта, переключившего тему.
 *
 * Разбор — регулярными выражениями по объявлениям: стороннего разборщика CSS
 * пакет не заводит, а объявления токенов устроены однообразно.
 */

const STYLES = resolve(import.meta.dirname, '..', 'src/styles');

const VIEW_FILES = [
    'nav-shared.css',
    'nav-rail.css',
    'nav-menu.css',
    'nav-bar.css',
] as const;

const COLOR_TOKEN = /(--cross-service-color-[a-z-]+)\s*:/g;

function read(name: string): string {
    return readFileSync(resolve(STYLES, name), 'utf8');
}

function withoutComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function colorTokens(css: string): string[] {
    return [...withoutComments(css).matchAll(COLOR_TOKEN)]
        .map((match) => match[1])
        .sort();
}

/**
 * Блок тёмной палитры — правило, которое переопределяет токены.
 * Правила ниже него (тени) токенов не объявляют и в сверку не входят.
 */
function darkPaletteRule(): { selector: string; body: string } {
    const css = withoutComments(read('dark.css'));
    const match = /([^{}]+)\{([^{}]*--cross-service-color-[^{}]*)\}/.exec(css);

    if (match === null) {
        throw new Error(
            '[theme] в dark.css нет правила, переопределяющего --cross-service-color-*',
        );
    }

    return { selector: match[1].trim(), body: match[2] };
}

test('у каждого цветового токена есть тёмная пара, и лишних пар нет', () => {
    const light = colorTokens(read('tokens.css'));

    expect(light.length).toBeGreaterThan(0);
    expect(colorTokens(darkPaletteRule().body)).toEqual(light);
});

test('тёмная палитра включается и классом продукта, и атрибутом элемента', () => {
    const selectors = darkPaletteRule()
        .selector.split(',')
        .map((selector) => selector.trim());

    expect(selectors).toContain('.app-dark');
    expect(selectors).toContain(":host([theme='dark'])");
});

for (const file of VIEW_FILES) {
    test(`в ${file} нет цветовых литералов — только токены палитры`, () => {
        const css = withoutComments(read(file));

        expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
        expect(css).not.toMatch(/\b(?:rgba?|hsla?)\(/i);
    });
}
