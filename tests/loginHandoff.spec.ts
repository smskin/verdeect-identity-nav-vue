import { expect, test } from '@playwright/test';
import { awaitHandoff } from '../src/playwright/login';

/**
 * Передача управления продукту после отправки формы установки — прямыми
 * вызовами на двойнике страницы.
 *
 * **Что проверяется.** Поток входа начинается заново только тогда, когда
 * обозреватель так и не ушёл с установки. Медленный уход (колбэк продукта
 * обменивает код секундами) повторного потока не вызывает: он затёр бы флоу
 * в сессии продукта, и возврат получил бы 400 при уже созданной сессии.
 *
 * **Что остаётся продуктам.** Настоящий вход против установки проверяют
 * браузерные сценарии продукта: браузер в наборах пакета не поднимается.
 */

const IDENTITY = 'https://id.example.test';

interface FakePage {
    readonly gotoCalls: string[];
    waitForURL(
        predicate: (url: URL) => boolean,
        options: { timeout: number; waitUntil?: string },
    ): Promise<void>;
    goto(url: string): Promise<null>;
}

/**
 * Двойник страницы: адрес меняется на `leaveTo` через `leaveAfterMs`
 * (`null` — не меняется никогда); ожидание адреса — опросом.
 */
function fakePage(leaveTo: string, leaveAfterMs: number | null): FakePage {
    const startedAt = Date.now();
    const currentUrl = (): string =>
        leaveAfterMs !== null && Date.now() - startedAt >= leaveAfterMs
            ? leaveTo
            : `${IDENTITY}/login`;
    const gotoCalls: string[] = [];

    return {
        gotoCalls,
        async waitForURL(predicate, { timeout }) {
            const deadline = Date.now() + timeout;

            while (!predicate(new URL(currentUrl()))) {
                if (Date.now() >= deadline) {
                    throw new Error('timeout');
                }

                await new Promise((resolve) => setTimeout(resolve, 5));
            }
        },
        async goto(url) {
            gotoCalls.push(url);

            return null;
        },
    };
}

test('медленный уход с установки дожидается, поток не начинается заново', async () => {
    const page = fakePage('http://localhost/auth/callback?code=x', 150);

    await awaitHandoff(page as never, IDENTITY, 1_000);

    expect(page.gotoCalls).toEqual([]);
});

test('обозреватель не ушёл с установки — поток начинается заново один раз', async () => {
    const page = fakePage('http://localhost/', null);

    await awaitHandoff(page as never, IDENTITY, 50);

    expect(page.gotoCalls).toEqual(['/auth/login']);
});
