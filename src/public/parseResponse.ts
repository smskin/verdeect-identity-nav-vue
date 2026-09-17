import type { NavItem } from '../cross-service';
import type { PublicNavigationData } from './types';

/**
 * Разбор ответа публичной операции навигации (PRD навигации 5.3, 5.8).
 *
 * **Разбор, а не приведение типа.** Ответ приходит из сети, и приведение
 * заглушило бы расхождение контракта: пункт без `id` дошёл бы до компонента
 * и сломал бы ключ списка молча.
 *
 * **Непригодный пункт пропускается, а не роняет ответ** — правило пакета:
 * одна кривая запись реестра не гасит навигацию по всей установке. Отказом
 * (`null`) считается только ответ, у которого нет самого перечня.
 *
 * Функция чистая: ни окна, ни сети.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Имена по языкам: только непустые строки.
 *
 * Пустой набор означает пункт без подписи — такой не рисуется вовсе, иначе
 * на месте имени осталась бы пустота, неотличимая от отсутствия пункта.
 */
function parseName(value: unknown): Record<string, string> | null {
    if (!isRecord(value)) {
        return null;
    }

    const name: Record<string, string> = {};

    for (const [locale, text] of Object.entries(value)) {
        if (typeof text === 'string' && text !== '') {
            name[locale] = text;
        }
    }

    return Object.keys(name).length === 0 ? null : name;
}

function parseItem(value: unknown): NavItem | null {
    if (!isRecord(value)) {
        return null;
    }

    const { id, url, order } = value;
    const name = parseName(value.name);

    if (typeof id !== 'string' || id === '') {
        return null;
    }

    if (typeof url !== 'string' || typeof order !== 'number' || name === null) {
        return null;
    }

    return {
        id,
        name,
        url,
        // Пустая ссылка законна: компонент рисует первую букву имени.
        iconUrl: typeof value.icon_url === 'string' ? value.icon_url : '',
        order,
    };
}

/**
 * Перекладывает разобранный JSON ответа в форму компонентов.
 *
 * Порядок пунктов сохраняется как пришёл — его задаёт реестр установки.
 * Посторонние поля (`profile_url` и всё неизвестное) игнорируются.
 *
 * @returns Разобранный ответ либо `null`, если перечня пунктов нет
 */
export function parsePublicNavigationResponse(
    body: unknown,
): PublicNavigationData | null {
    if (!isRecord(body) || !Array.isArray(body.items)) {
        return null;
    }

    const items: NavItem[] = [];

    for (const raw of body.items) {
        const item = parseItem(raw);

        if (item !== null) {
            items.push(item);
        }
    }

    return {
        items,
        logoUrl: typeof body.logo_url === 'string' ? body.logo_url : '',
    };
}
