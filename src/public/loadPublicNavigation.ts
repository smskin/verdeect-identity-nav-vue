import { parsePublicNavigationResponse } from './parseResponse';
import type {
    PublicNavigationFailure,
    PublicNavigationLoadResult,
} from './types';

/**
 * Загрузка гостевого состава рейла публичной операцией установки
 * (PRD навигации 5.8).
 *
 * **Единственное место пакета, где выполняется сетевой запрос.** Компоненты
 * по-прежнему получают данные только props: запрос делает адаптер входа
 * `./public`, как `./inertia` читает `usePage()`. Ограничение закреплено
 * условием 11 `check:isolation`.
 *
 * **Отказы не бросаются** — функция всегда возвращает исход. Рейл есть
 * оформление, и отказ его загрузки не должен ронять страницу лендинга.
 * Журнала нет по правилу пакета: причина отказа возвращается данными.
 *
 * Реализация `fetch` приходит параметром ради прямых вызовов в наборах:
 * композиция передаёт глобальную.
 */

/** Путь операции относительно origin установки. */
const PUBLIC_NAVIGATION_PATH = '/api/public/navigation';

function failed(failure: PublicNavigationFailure): PublicNavigationLoadResult {
    return { status: 'failed', failure };
}

/**
 * Адрес операции либо `null` для непригодного адреса установки.
 *
 * Берётся только origin: путь и строка запроса в опции ничего не значат,
 * а любой параметр в адресе операции установка отклоняет `400`.
 */
function endpointOf(baseUrl: string): string | null {
    let base: URL;

    try {
        base = new URL(baseUrl);
    } catch {
        return null;
    }

    if (base.protocol !== 'https:' && base.protocol !== 'http:') {
        return null;
    }

    return base.origin + PUBLIC_NAVIGATION_PATH;
}

function isAbort(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

/**
 * Загружает и разбирает ответ публичной операции.
 *
 * **`404` означает выключенную операцию, а не ошибку адреса**: так отвечает
 * установка, в которой публичная операция не включена развёртыванием.
 *
 * **Учётные данные не отправляются**: CORS установки разрешает любой origin
 * именно без них, а куки сервиса лендингу не нужны.
 */
export async function loadPublicNavigation(
    baseUrl: string,
    fetcher: typeof fetch,
    signal: AbortSignal,
): Promise<PublicNavigationLoadResult> {
    const endpoint = endpointOf(baseUrl);

    if (endpoint === null) {
        return failed('misconfigured');
    }

    let response: Response;

    try {
        response = await fetcher(endpoint, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            credentials: 'omit',
            signal,
        });
    } catch (error) {
        return isAbort(error) ? { status: 'aborted' } : failed('unavailable');
    }

    if (response.status === 404) {
        return failed('disabled');
    }

    if (response.status === 429) {
        return failed('rate_limited');
    }

    if (!response.ok) {
        return failed('unavailable');
    }

    let body: unknown;

    try {
        body = await response.json();
    } catch (error) {
        return isAbort(error) ? { status: 'aborted' } : failed('malformed');
    }

    const data = parsePublicNavigationResponse(body);

    return data === null ? failed('malformed') : { status: 'loaded', data };
}
