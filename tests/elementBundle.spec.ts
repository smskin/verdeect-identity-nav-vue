import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Собранный файл входа `./element` — чтением, без браузера.
 *
 * **Проверяется то, что уедет потребителю, а не исходник.** Условие 13
 * `check:isolation` держит исходники входа; здесь ловятся ошибки сборки,
 * которых в исходниках не видно: Vue, оставшийся внешним импортом, визуальный
 * слой, не попавший в теневой корень, порог ширины, притянутый зависимостью.
 *
 * **Что остаётся продукту.** Что элемент отрисовывается, что плашка ставит
 * переменную высоты и снимает её под атрибутом `hidden`, проверяет браузерный
 * сценарий встраивающего продукта: наборы пакета браузер не поднимают.
 *
 * Файл собирает `npm run build:element`; в `npm test` сборка идёт перед
 * наборами.
 */

const ROOT = resolve(import.meta.dirname, '..');
const BUNDLE = resolve(ROOT, 'dist/element.js');

function bundle(): string {
    if (!existsSync(BUNDLE)) {
        throw new Error(
            '[element] dist/element.js нет — соберите вход: npm run build:element',
        );
    }

    return readFileSync(BUNDLE, 'utf8');
}

test('собранный файл существует и не пуст', () => {
    expect(bundle().length).toBeGreaterThan(0);
});

test('файл регистрирует тег verdeect-identity-nav', () => {
    expect(bundle()).toContain('verdeect-identity-nav');
    expect(bundle()).toContain('customElements');
});

test('внешних импортов нет: Vue внутри бандла, потребителю ставить нечего', () => {
    expect(bundle()).not.toMatch(/(?:^|[;\s}])import\s*[^(]/m);
    expect(bundle()).not.toMatch(/\bfrom\s*["'][^"'./][^"']*["']/);
});

test('визуальный слой встроен в файл вместе с правилами хоста', () => {
    const contents = bundle();

    expect(contents).toContain('cross-service-nav--rail');
    expect(contents).toContain('cross-service-nav--bar');
    expect(contents).toContain('--cross-service-rail-width');
    expect(contents).toContain(':host([hidden])');
});

test('тёмная палитра включается атрибутом хоста theme', () => {
    // Сборщик снимает кавычки со значения атрибута — сверяется любая запись.
    expect(bundle()).toMatch(/:host\(\[theme=['"]?dark['"]?\]\)/);
});

test('подсказка полосы переносится в слой теневого корня, а не в body', () => {
    const contents = bundle();

    // Слой, который элемент отдаёт NavTip; без него подсказка ушла бы в body
    // и осталась без стилей теневого корня.
    expect(contents).toContain('cross-service-nav__tip-layer');
    // Оформление подсказки — в тех же стилях теневого корня, куда она попадает.
    expect(contents).toMatch(/\.cross-service-nav__tip\{/);
});

test('порога ширины в файле нет: вид выбирает продукт атрибутом', () => {
    expect(bundle()).not.toContain('matchMedia');
    expect(bundle()).not.toContain('innerWidth');
});

test('обращений к process в файле нет: в браузере такого объекта нет', () => {
    expect(bundle()).not.toContain('process.env');
});

test('package.json объявляет вход и включает собранный каталог в архив', () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
        readonly exports: Readonly<Record<string, string>>;
        readonly files: readonly string[];
    };

    expect(manifest.exports['./element']).toBe('./dist/element.js');
    expect(manifest.files).toContain('dist');
});
