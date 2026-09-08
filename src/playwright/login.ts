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

        /*
         * Отправка формы установки — запрос Inertia, а не переход страницы.
         * Цепочка перенаправлений после успешного входа заканчивается
         * на чужом источнике (`/auth/callback` продукта), и обозреватель
         * обрывает её правилом общего происхождения: сессия установки при
         * этом уже создана, а поток кода не завершён.
         *
         * Поэтому поток начинается заново обычным переходом: установка видит
         * созданную сессию, выдаёт код сразу и возвращает в продукт.
         *
         * Это поведение самой установки, а не продукта: обрыв происходит
         * внутри её страницы входа, до того как продукт получает управление.
         */
        await page
            .waitForURL((url) => !url.href.startsWith(identity), {
                timeout: 5_000,
            })
            .catch(() => page.goto('/auth/login'));
    }

    await page.waitForURL((url) => !url.href.startsWith(identity), {
        timeout: 30_000,
    });

    await expect(page.locator(readySelector)).toBeVisible();
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
