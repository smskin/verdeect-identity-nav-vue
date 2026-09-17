import type { ComputedRef, Ref } from 'vue';
import type { NavItem } from '../cross-service';
import type { CrossServiceData } from '../identity';

/**
 * Типы входа `./public` — режим «Лендинг без бэкенда».
 *
 * Лендинг не может держать секрет клиента и получает гостевой состав рейла
 * публичной операцией установки `GET /api/public/navigation` прямо
 * из браузера (PRD навигации 5.8). Компоненты при этом те же, что у продукта
 * установки: вход отдаёт данные, а не разметку.
 *
 * Индексных сигнатур здесь нет по доводу `src/cross-service/types.ts`:
 * она заглушила бы обращение к несуществующему полю.
 */

/**
 * Опции `usePublicNavigation`.
 *
 * **Язык и путь приходят функциями, а не значениями** — по доводу ядра
 * (`IdentityViewSource`): значение, вычисленное однажды, застыло бы, и смена
 * языка или маршрута лендинга до рейла не дошла бы.
 */
export interface PublicNavigationOptions {
    /**
     * Адрес установки identity — origin без завершающей косой.
     *
     * Путь и строка запроса адреса не используются: адрес операции
     * собирается из origin, и лишнее в опции ничего не меняет.
     */
    readonly baseUrl: string;
    /** Язык подписей; неизвестный компонент отдаёт запасным. */
    readonly locale: () => string;
    /**
     * Путь открытой страницы, например `/pricing`.
     *
     * Необязателен, но лендингу с маршрутизатором передавать его следует:
     * без опции путь читается из окна, а чтение окна реактивным источником
     * не является, и подсветка не заметит переход внутри SPA.
     */
    readonly path?: () => string;
}

/**
 * Почему рейла нет.
 *
 * - `disabled` — публичная операция выключена в установке (`404`): включить
 *   её переменной `IDENTITY_NAVIGATION_PUBLIC_ENABLED`;
 * - `rate_limited` — превышена частота с адреса посетителя (`429`);
 * - `unavailable` — сеть недоступна либо код ответа вне перечисленных;
 * - `malformed` — тело не JSON либо не по контракту ответа;
 * - `misconfigured` — непригодный адрес установки в опциях; запроса не было.
 *
 * Пустой рейл при любой причине — штатное поведение: страница лендинга
 * работает и без него.
 */
export type PublicNavigationFailure =
    | 'disabled'
    | 'rate_limited'
    | 'unavailable'
    | 'malformed'
    | 'misconfigured';

/** Ответ операции, переложенный в форму компонентов. */
export interface PublicNavigationData {
    readonly items: readonly NavItem[];
    readonly logoUrl: string;
}

/**
 * Исход загрузки.
 *
 * Прерывание при размонтировании — отдельный исход, а не отказ: страница
 * ушла, и сообщать о «недоступности» некому.
 */
export type PublicNavigationLoadResult =
    | { readonly status: 'loaded'; readonly data: PublicNavigationData }
    | { readonly status: 'failed'; readonly failure: PublicNavigationFailure }
    | { readonly status: 'aborted' };

/**
 * Возвращаемое значение `usePublicNavigation`.
 *
 * Состав, язык, признак непустого рейла и адрес страницы выводит ядро
 * `useIdentityView`; профиля в значении нет — в этом режиме его не бывает.
 */
export interface PublicNavigationView {
    crossService: ComputedRef<CrossServiceData>;
    locale: ComputedRef<string>;
    hasRail: ComputedRef<boolean>;
    currentUrl: ComputedRef<string>;
    /** Истина, пока ответ не получен; при отказе становится ложью. */
    loading: Ref<boolean>;
    /** Причина отсутствия рейла либо `null`. */
    failure: Ref<PublicNavigationFailure | null>;
}
