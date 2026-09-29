import { expect, test } from '@playwright/test';
import { loadIcon } from '../src/cross-service/iconSource';

/**
 * Загрузка файла иконки — прямыми вызовами с подменённым `fetch`.
 *
 * Перечень загрузок общий на модуль, поэтому каждый случай берёт свой адрес:
 * иначе случаи зависели бы от порядка прогона.
 */

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

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

function svg(status = 200, type = 'image/svg+xml'): Promise<Response> {
    return Promise.resolve(new Response(SVG, { status, headers: { 'Content-Type': type } }));
}

let counter = 0;

function address(): string {
    counter += 1;

    return `https://storage.example.test/icons/${counter}.svg?X-Amz-Signature=abc`;
}

function decoded(content: string): string {
    return Buffer.from(content.split(',')[1], 'base64').toString('utf8');
}

test('файл отдаётся адресом data: с типом из ответа', async () => {
    const { fetcher } = recorder(() => svg(200, 'image/svg+xml; charset=utf-8'));

    const content = await loadIcon(address(), false, fetcher);

    expect(content.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(decoded(content)).toBe(SVG);
});

test('тип не изображения — файл считается SVG', async () => {
    const { fetcher } = recorder(() => svg(200, 'binary/octet-stream'));

    const content = await loadIcon(address(), false, fetcher);

    expect(content.startsWith('data:image/svg+xml;base64,')).toBe(true);
});

test('запрос уходит CORS без учётных данных; повтор — в обход кэша', async () => {
    const url = address();
    const { fetcher, calls } = recorder(() => svg());

    await loadIcon(url, false, fetcher);
    await loadIcon(url, true, fetcher);

    expect(calls.map((call) => call.url)).toEqual([url, url]);
    expect(calls[0].init).toMatchObject({ mode: 'cors', credentials: 'omit', cache: 'default' });
    expect(calls[1].init?.cache).toBe('reload');
});

test('виды с одним адресом делят одну загрузку', async () => {
    const url = address();
    const { fetcher, calls } = recorder(() => svg());

    const [first, second] = await Promise.all([
        loadIcon(url, false, fetcher),
        loadIcon(url, false, fetcher),
    ]);

    expect(first).toBe(second);
    expect(calls).toHaveLength(1);
});

test('ответ не из 2xx отклоняется', async () => {
    const { fetcher } = recorder(() => svg(403));

    await expect(loadIcon(address(), false, fetcher)).rejects.toThrow();
});

test('неудача не запоминается: следующий вызов идёт в хранилище заново', async () => {
    const url = address();
    let failing = true;
    const { fetcher, calls } = recorder(() => (failing ? Promise.reject(new TypeError('CORS')) : svg()));

    await expect(loadIcon(url, false, fetcher)).rejects.toThrow('CORS');

    failing = false;

    await expect(loadIcon(url, false, fetcher)).resolves.toContain('data:image/svg+xml');
    expect(calls).toHaveLength(2);
});
