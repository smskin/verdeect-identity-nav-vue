import { computed, type ComputedRef } from 'vue';
import type { CrossServiceData, IdentityProfile, IdentityProps } from './types';

/**
 * Источник данных: сырые свойства identity и путь открытой страницы.
 *
 * Оба передаются **функциями**, а не значениями: вычисленные на момент
 * вызова, они замерли бы навсегда, и подсветка текущего пункта застряла
 * бы на первой открытой странице.
 */
export interface IdentityViewSource {
    /** Свойства с бэкенда продукта; `undefined` — их ещё нет. */
    readonly props: () => IdentityProps | null | undefined;
    /** Путь открытой страницы, например `/directory`. */
    readonly path: () => string;
}

export interface IdentityView {
    profile: ComputedRef<IdentityProfile | null>;
    crossService: ComputedRef<CrossServiceData>;
    locale: ComputedRef<string>;
    hasRail: ComputedRef<boolean>;
    currentUrl: ComputedRef<string>;
}

const EMPTY_CROSS_SERVICE: CrossServiceData = {
    items: [],
    profileUrl: '',
    logoUrl: '',
};

/**
 * Состояние рейла и профиля, выведенное из свойств продукта.
 *
 * Знания о том, откуда свойства взялись, здесь нет: продукт на Inertia
 * пользуется адаптером входа `./inertia`, любой другой — вызывает эту
 * функцию сам. Компоненты кросс-сервисной навигации в сеть не ходят
 * ни при каком способе доставки: данные приходят только props.
 */
export function useIdentityView(source: IdentityViewSource): IdentityView {
    const profile = computed<IdentityProfile | null>(
        () => source.props()?.profile ?? null,
    );

    const crossService = computed<CrossServiceData>(
        () => source.props()?.crossService ?? EMPTY_CROSS_SERVICE,
    );

    /**
     * Язык подписей рейла берётся из профиля: `locale` приходит
     * из `/userinfo` установки и относится к отображению интерфейса
     * своему владельцу.
     */
    const locale = computed<string>(() => profile.value?.locale ?? 'ru');

    /**
     * Пустой `items` — рейла нет вовсе, включая логотип. Оболочка продукта
     * по этому же признаку решает, резервировать ли под него место.
     */
    const hasRail = computed<boolean>(() => crossService.value.items.length > 0);

    /**
     * Адрес открытой страницы — **абсолютный**.
     *
     * Правило текущего пункта сравнивает схему и хост; путь без адреса оно
     * просто не разбирает — переданный как есть, он не подсветит ничего
     * и никогда. Отсюда сборка из `origin` окна.
     *
     * При отрисовке на сервере окна нет: тогда возвращается путь как есть.
     * Подсветка на сервере всё равно не видна — она проявляется после
     * подключения обработчиков, — а обращение к отсутствующему объекту
     * уронило бы отрисовку целиком.
     */
    const currentUrl = computed<string>(() => {
        const path = source.path();

        if (typeof window === 'undefined') {
            return path;
        }

        return `${window.location.origin}${path}`;
    });

    return { profile, crossService, locale, hasRail, currentUrl };
}
