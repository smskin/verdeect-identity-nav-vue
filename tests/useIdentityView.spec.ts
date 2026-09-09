import { expect, test } from '@playwright/test';
import { useIdentityView } from '../src/identity/useIdentityView';
import type {
    CrossServiceData,
    IdentityProfile,
    IdentityProps,
} from '../src/identity/types';

/**
 * Порядок разрешения языка подписей — прямыми вызовами.
 *
 * **Браузера набор не поднимает.** Фикстура `page` не запрашивается, и
 * Playwright выполняет тело в Node: правило живёт в вычисляемом значении,
 * а не в разметке, и проверяется вызовом.
 *
 * **Почему правило вообще есть.** Язык вошедшего приходит в профиле, а язык
 * гостя установка не знает — его определяет продукт. До появления порядка
 * гость получал жёсткий `'ru'`, и на англоязычной установке рейл выходил
 * русским. Набор закрепляет обе стороны: профиль главнее свойств продукта,
 * но при отсутствии профиля свойства главнее запасного значения.
 */
const EMPTY_CROSS_SERVICE: CrossServiceData = {
    items: [],
    profileUrl: '',
    logoUrl: '',
};

function profile(locale: string): IdentityProfile {
    return {
        sub: '01K',
        name: 'Сергей Михайлов',
        givenName: 'Сергей',
        familyName: 'Михайлов',
        middleName: '',
        locale,
        shortName: 'Сергей М.',
        initials: 'СМ',
        email: '',
    };
}

function localeOf(props: IdentityProps | null | undefined): string {
    return useIdentityView({ props: () => props, path: () => '/' }).locale.value;
}

test('язык вошедшего берётся из профиля', () => {
    const props: IdentityProps = {
        profile: profile('en'),
        crossService: EMPTY_CROSS_SERVICE,
    };

    expect(localeOf(props)).toBe('en');
});

test('профиль главнее языка, присланного продуктом', () => {
    const props: IdentityProps = {
        profile: profile('en'),
        crossService: EMPTY_CROSS_SERVICE,
        locale: 'ru',
    };

    expect(localeOf(props)).toBe('en');
});

test('без профиля язык берётся у продукта', () => {
    const props: IdentityProps = {
        profile: null,
        crossService: EMPTY_CROSS_SERVICE,
        locale: 'en',
    };

    expect(localeOf(props)).toBe('en');
});

test('без профиля и без языка продукта остаётся запасной', () => {
    const props: IdentityProps = {
        profile: null,
        crossService: EMPTY_CROSS_SERVICE,
    };

    expect(localeOf(props)).toBe('ru');
});

test('свойств ещё нет — язык запасной, а не отказ', () => {
    expect(localeOf(undefined)).toBe('ru');
});
