import { expect, test } from '@playwright/test';
import { currentItemId } from '../src/cross-service/currentItem';
import type { NavItem } from '../src/cross-service/types';

/**
 * Правило текущего пункта рейла (PRD навигации 7.3) — прямыми вызовами.
 *
 * **Файл лежит в `tests/Browser`, но браузера не поднимает.** Фикстура `page`
 * здесь не запрашивается, и Playwright выполняет тело теста в Node:
 * `@playwright/test` — полноценный прогонщик со своим `expect`, а не только
 * драйвер браузера. Новой зависимости это не заводит.
 *
 * **Почему браузером этого не сделать.** В браузерном прогоне продукта адрес
 * открытой страницы всегда принадлежит самому продукту, поэтому случаи с чужой
 * схемой и чужим портом невоспроизводимы в принципе, а случай «непригодный
 * адрес пункта» — тем более: установка не даст записать такой адрес в реестр,
 * тогда как именно эта ветка защищает рейл от кривой записи.
 *
 * **Набор живёт в пакете, а не в продукте.** Правило подсветки принадлежит
 * компонентам, и проверять его через приватные пути каталога из чужого
 * репозитория значит проверять чужую библиотеку её же внутренностями.
 * Браузерные сценарии продуктов сохраняются отдельно: они проверяют, что
 * правило подключено к рейлу, а не что оно верно само по себе.
 */
function item(id: string, url: string): NavItem {
    return { id, name: { ru: id, en: id }, url, icon: 'pi-user', order: 1 };
}

test('подсвечивается пункт с самым длинным совпавшим путём', () => {
    const items = [
        item('root', 'https://id.test/'),
        item('users', 'https://id.test/users'),
    ];

    expect(currentItemId(items, 'https://id.test/users/01K')).toBe('users');
});

test('пункт на корень установки подсвечивается на любой её странице', () => {
    const items = [item('root', 'https://id.test/')];

    expect(currentItemId(items, 'https://id.test/anything')).toBe('root');
});

test('путь сравнивается посегментно, а не построчно', () => {
    const items = [
        item('user', 'https://id.test/user'),
        item('users', 'https://id.test/users'),
    ];

    expect(currentItemId(items, 'https://id.test/users')).toBe('users');
});

test('завершающий слэш страницы совпадению не мешает', () => {
    const items = [item('users', 'https://id.test/users')];

    expect(currentItemId(items, 'https://id.test/users/')).toBe('users');
});

test('завершающий слэш пункта совпадению не мешает', () => {
    const items = [item('users', 'https://id.test/users/')];

    expect(currentItemId(items, 'https://id.test/users')).toBe('users');
});

test('чужой хост пункт не подсвечивает', () => {
    const items = [item('users', 'https://id.test/users')];

    expect(currentItemId(items, 'https://a.test/users')).toBeNull();
});

test('другая схема пункт не подсвечивает', () => {
    const items = [item('users', 'http://id.test/users')];

    expect(currentItemId(items, 'https://id.test/users')).toBeNull();
});

test('порт — часть хоста и обязан совпадать', () => {
    const items = [item('u', 'https://id.test:8443/u')];

    expect(currentItemId(items, 'https://id.test/u')).toBeNull();
});

test('строка запроса и якорь в сравнении не участвуют', () => {
    const items = [item('users', 'https://id.test/users')];
    const opened = 'https://id.test/users?page=2#top';

    expect(currentItemId(items, opened)).toBe('users');
});

test('непригодный адрес пункта пропускается без отказа', () => {
    const items = [item('broken', 'не адрес')];

    expect(currentItemId(items, 'https://id.test/')).toBeNull();
});

test('пустой перечень даёт отсутствие текущего пункта', () => {
    expect(currentItemId([], 'https://id.test/users')).toBeNull();
});

/*
 * Запасной ярус: пока человек на домене сервиса, рейл показывает, где он.
 * Раздел, на который пункта нет, — случай обычный, и гасить в нём подсветку
 * значило бы сообщать, что человек ушёл с сервиса.
 */
test('единственный пункт домена горит и в разделе, которого нет в перечне', () => {
    const items = [item('users', 'https://id.test/users')];

    expect(currentItemId(items, 'https://id.test/settings')).toBe('users');
});

test('в чужом разделе домена горит первый пункт этого домена', () => {
    const items = [
        item('users', 'https://id.test/users'),
        item('profile', 'https://id.test/profile'),
    ];

    expect(currentItemId(items, 'https://id.test/settings')).toBe('users');
});

test('точное совпадение пути побеждает запасной ярус', () => {
    const items = [
        item('users', 'https://id.test/users'),
        item('profile', 'https://id.test/profile'),
    ];

    expect(currentItemId(items, 'https://id.test/profile')).toBe('profile');
    expect(currentItemId(items, 'https://id.test/profile/edit')).toBe(
        'profile',
    );
    expect(currentItemId(items, 'https://id.test/users/01K')).toBe('users');
});

/*
 * Запасной ярус смягчает требование к пути, а не к адресу: чужой хост и чужая
 * схема не подсвечивают ничего и на нём.
 */
test('запасной ярус не переступает через хост и схему', () => {
    expect(
        currentItemId(
            [item('users', 'https://id.test/users')],
            'https://a.test/settings',
        ),
    ).toBeNull();

    expect(
        currentItemId(
            [item('users', 'http://id.test/users')],
            'https://id.test/settings',
        ),
    ).toBeNull();

    expect(
        currentItemId(
            [item('users', 'https://id.test:8443/users')],
            'https://id.test/settings',
        ),
    ).toBeNull();
});

test('непригодный адрес не становится запасным ответом', () => {
    const items = [item('broken', 'не адрес')];

    expect(currentItemId(items, 'https://id.test/settings')).toBeNull();
});
