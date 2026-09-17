import { expect, test } from '@playwright/test';
import { loadPublicNavigation } from '../src/public/loadPublicNavigation';

/**
 * Загрузчик публичной навигации — прямыми вызовами с подменённым `fetch`.
 *
 * Сеть не используется: подменная реализация отдаёт заданный ответ либо
 * бросает, и набор проверяет перевод каждого исхода в результат.
 */

const BASE_URL = 'https://id.example.test';

interface RecordedCall {
    readonly url: string;
    readonly init: RequestInit | undefined;
}

function recorder(respond: () => Promise<Response>): {
    fetcher: typeof fetch;
    calls: RecordedCall[];
} {
    const calls: RecordedCall[] = [];

    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        calls.push({ url: String(input), init });

        return respond();
    }) as typeof fetch;

    return { fetcher, calls };
}

function json(body: unknown, status = 200): Promise<Response> {
    return Promise.resolve(
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        }),
    );
}

function signal(): AbortSignal {
    return new AbortController().signal;
}

test('200 с телом по контракту — успех с разобранными пунктами', async () => {
    const { fetcher } = recorder(() =>
        json({
            items: [{ id: 'a', name: { ru: 'О нас' }, url: 'https://about.example.test/', icon_url: '', order: 0 }],
            logo_url: 'https://id.example.test/installation/logo',
        }),
    );

    const result = await loadPublicNavigation(BASE_URL, fetcher, signal());

    expect(result).toEqual({
        status: 'loaded',
        data: {
            items: [{ id: 'a', name: { ru: 'О нас' }, url: 'https://about.example.test/', iconUrl: '', order: 0 }],
            logoUrl: 'https://id.example.test/installation/logo',
        },
    });
});

test('запрос уходит GET без учётных данных и параметров на адрес операции', async () => {
    const { fetcher, calls } = recorder(() => json({ items: [] }));

    await loadPublicNavigation(BASE_URL, fetcher, signal());

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://id.example.test/api/public/navigation');
    expect(calls[0].init?.method).toBe('GET');
    expect(calls[0].init?.credentials).toBe('omit');
    expect(calls[0].init?.headers).toEqual({ Accept: 'application/json' });
});

test('из адреса установки берётся только origin', async () => {
    const { fetcher, calls } = recorder(() => json({ items: [] }));

    await loadPublicNavigation('https://id.example.test:8443/some/path/?x=1', fetcher, signal());

    expect(calls[0].url).toBe('https://id.example.test:8443/api/public/navigation');
});

test('непригодный адрес установки — misconfigured без запроса', async () => {
    for (const baseUrl of ['', 'not a url', 'ftp://id.example.test']) {
        const { fetcher, calls } = recorder(() => json({ items: [] }));

        const result = await loadPublicNavigation(baseUrl, fetcher, signal());

        expect(result).toEqual({ status: 'failed', failure: 'misconfigured' });
        expect(calls).toHaveLength(0);
    }
});

test('404 — операция выключена', async () => {
    const { fetcher } = recorder(() => json({ error: 'not_found' }, 404));

    expect(await loadPublicNavigation(BASE_URL, fetcher, signal())).toEqual({
        status: 'failed',
        failure: 'disabled',
    });
});

test('429 — превышена частота', async () => {
    const { fetcher } = recorder(() => json({ error: 'rate_limit_exceeded' }, 429));

    expect(await loadPublicNavigation(BASE_URL, fetcher, signal())).toEqual({
        status: 'failed',
        failure: 'rate_limited',
    });
});

test('прочие коды вне 2xx — unavailable', async () => {
    for (const status of [400, 500]) {
        const { fetcher } = recorder(() => json({ error: 'x' }, status));

        expect(await loadPublicNavigation(BASE_URL, fetcher, signal())).toEqual({
            status: 'failed',
            failure: 'unavailable',
        });
    }
});

test('исключение сети — unavailable', async () => {
    const { fetcher } = recorder(() => Promise.reject(new TypeError('Failed to fetch')));

    expect(await loadPublicNavigation(BASE_URL, fetcher, signal())).toEqual({
        status: 'failed',
        failure: 'unavailable',
    });
});

test('прерывание сигналом — исход прерывания, а не отказ', async () => {
    const { fetcher } = recorder(() =>
        Promise.reject(new DOMException('The operation was aborted.', 'AbortError')),
    );

    expect(await loadPublicNavigation(BASE_URL, fetcher, signal())).toEqual({
        status: 'aborted',
    });
});

test('тело не JSON — malformed', async () => {
    const { fetcher } = recorder(() => Promise.resolve(new Response('<html>', { status: 200 })));

    expect(await loadPublicNavigation(BASE_URL, fetcher, signal())).toEqual({
        status: 'failed',
        failure: 'malformed',
    });
});

test('JSON не по контракту — malformed', async () => {
    const { fetcher } = recorder(() => json({ rail: [] }));

    expect(await loadPublicNavigation(BASE_URL, fetcher, signal())).toEqual({
        status: 'failed',
        failure: 'malformed',
    });
});
