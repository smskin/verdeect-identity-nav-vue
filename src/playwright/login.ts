import { expect, type Page } from '@playwright/test';

/**
 * Вход в продукт установки через **реальную установку** identity.
 *
 * Против двойника это не проверяется: PKCE, `state`, `nonce`, проверка
 * подписи и точное совпадение адреса возврата имеют смысл только при
 * настоящем сервере авторизации.
 *
 * Форма входа принадлежит установке, а не продукту: собственной формы
 * с паролем у продукта нет и быть не может.
 */
export type Role = 'admin' | 'user';

interface Credentials {
    readonly email: string;
    readonly password: string;
}

export interface LoginOptions {
    /**
     * Признак того, что продукт отрисовался и вход завершён.
     *
     * Умолчание — оболочка Sakai, на которой собраны продукты установки.
     * Продукт с другой оболочкой передаёт свой селектор: библиотека
     * не вправе знать разметку каждого потребителя.
     */
    readonly readySelector?: string;
}

const DEFAULT_READY_SELECTOR = '.layout-wrapper';

/**
 * Адрес установки.
 *
 * Запасного значения нет намеренно: адрес разработчика, зашитый
 * умолчанием, увёл бы прогон на чужую установку молча — сценарии
 * начали бы проверять не ту систему, и разбираться пришлось бы по трассе.
 */
function identityBaseUrl(): string {
    const baseUrl = process.env.IDENTITY_BASE_URL;

    if (!baseUrl) {
        throw new Error(
            '[identity] не задан IDENTITY_BASE_URL — адрес установки, ' +
                'против которой идёт вход. Заполните его в окружении прогона.',
        );
    }

    return baseUrl;
}

export function credentialsFor(role: Role): Credentials {
    const prefix = role === 'admin' ? 'E2E_ADMIN' : 'E2E_USER';

    const email = process.env[`${prefix}_EMAIL`];
    const password = process.env[`${prefix}_PASSWORD`];

    if (!email || !password) {
        throw new Error(
            `[identity] учётная запись «${role}» не задана: заполните ` +
                `${prefix}_EMAIL и ${prefix}_PASSWORD в окружении прогона.`,
        );
    }

    return { email, password };
}

/**
 * Проходит вход и возвращает управление уже на странице продукта.
 */
export async function loginAs(
    page: Page,
    role: Role,
    options: LoginOptions = {},
): Promise<void> {
    const { email, password } = credentialsFor(role);
    const identity = identityBaseUrl();
    const readySelector = options.readySelector ?? DEFAULT_READY_SELECTOR;

    await page.goto('/auth/login');

    // Установка показывает свою форму входа; если сессия там уже есть,
    // она возвращает в продукт сразу, и формы не будет.
    if (page.url().startsWith(identity)) {
        await page.locator('#email').fill(email);

        /*
         * Поле пароля адресуется по типу, а не по идентификатору: установка
         * рисует его компонентом PrimeVue, и `id` стоит на обёртке, а не
         * на самом поле ввода.
         */
        await page.locator('input[type="password"]').fill(password);
        await page.getByTestId('login-submit').click();

        await awaitHandoff(page, identity);
    }

    await page.waitForURL((url) => !url.href.startsWith(identity), {
        timeout: 30_000,
    });

    await expect(page.locator(readySelector)).toBeVisible();
}

/**
 * Сколько ждать, пока после отправки формы обозреватель уйдёт с установки.
 * С запасом на обмен кода под параллельной нагрузкой прогонов.
 */
export const HANDOFF_TIMEOUT_MS = 30_000;

/**
 * Дожидается передачи управления продукту после отправки формы установки.
 *
 * Установка отвечает на вход ответом Inertia с внешним адресом (409), и
 * обозреватель сам переходит на `/authorize`, а оттуда — на `/auth/callback`
 * продукта. Уход с установки ловится по началу навигации (`commit`), а не
 * по загрузке: колбэк продукта обменивает код и может идти секунды.
 *
 * Поток начинается заново, только если обозреватель так и не ушёл
 * с установки (старое поведение: цепочка перенаправлений внутри запроса
 * Inertia обрывалась правилом общего происхождения, сессия установки уже
 * создана, а поток кода не завершён). Прежний короткий порог (5 с)
 * перезапускал поток, пока первый колбэк ещё шёл: второй флоу затирал
 * первый в сессии продукта, колбэк стирал флоу, и второй возврат получал
 * 400 «поток входа не начат» при уже созданной сессии.
 */
export async function awaitHandoff(
    page: Pick<Page, 'waitForURL' | 'goto'>,
    identity: string,
    timeout: number = HANDOFF_TIMEOUT_MS,
): Promise<void> {
    const handedOff = await page
        .waitForURL((url) => !url.href.startsWith(identity), {
            timeout,
            waitUntil: 'commit',
        })
        .then(
            () => true,
            () => false,
        );

    if (!handedOff) {
        await page.goto('/auth/login');
    }
}

/**
 * Выход из продукта.
 *
 * Через блок пользователя, а не прямым запросом: проверяется именно тот путь,
 * которым пользуется человек. Селекторы принадлежат компонентам пакета,
 * поэтому знания о продукте здесь не требуется.
 */
export async function logout(page: Page): Promise<void> {
    await page.locator('.cross-service-user__trigger').click();
    await page.locator('.cross-service-user__entry').last().click();
}
