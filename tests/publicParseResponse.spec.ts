import { expect, test } from '@playwright/test';
import { parsePublicNavigationResponse } from '../src/public/parseResponse';

/**
 * Разбор ответа публичной операции — прямыми вызовами.
 *
 * Ответ приходит из сети, и набор закрепляет обе стороны правила: пункт
 * по контракту доходит до компонента в его форме, а непригодный пункт
 * пропускается, не гася остальные.
 */

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: '01K7AD',
        name: { ru: 'О нас', en: 'About' },
        url: 'https://about.example.test/',
        icon_url: 'https://storage.example.test/navigation/icons/01K7AD.svg?X-Amz-Signature=1',
        order: 0,
        ...overrides,
    };
}

test('ответ по контракту разбирается в форму компонентов', () => {
    const parsed = parsePublicNavigationResponse({
        items: [item()],
        logo_url: 'https://id.example.test/installation/logo',
    });

    expect(parsed).toEqual({
        items: [
            {
                id: '01K7AD',
                name: { ru: 'О нас', en: 'About' },
                url: 'https://about.example.test/',
                iconUrl: 'https://storage.example.test/navigation/icons/01K7AD.svg?X-Amz-Signature=1',
                order: 0,
            },
        ],
        logoUrl: 'https://id.example.test/installation/logo',
    });
});

test('порядок пунктов сохраняется, даже если order не возрастает', () => {
    const parsed = parsePublicNavigationResponse({
        items: [item({ id: 'b', order: 10 }), item({ id: 'a', order: 0 })],
        logo_url: '',
    });

    expect(parsed?.items.map((entry) => entry.id)).toEqual(['b', 'a']);
});

test('пункт без id, с пустым id или нечисловым order пропускается', () => {
    const parsed = parsePublicNavigationResponse({
        items: [
            item({ id: undefined }),
            item({ id: '' }),
            item({ id: 'bad-order', order: '1' }),
            item({ id: 'kept' }),
        ],
        logo_url: '',
    });

    expect(parsed?.items.map((entry) => entry.id)).toEqual(['kept']);
});

test('пункт без единого непустого имени пропускается', () => {
    const parsed = parsePublicNavigationResponse({
        items: [item({ id: 'empty', name: { ru: '', en: 7 } }), item({ id: 'kept' })],
        logo_url: '',
    });

    expect(parsed?.items.map((entry) => entry.id)).toEqual(['kept']);
});

test('нестроковые значения имени отбрасываются, строковые остаются', () => {
    const parsed = parsePublicNavigationResponse({
        items: [item({ name: { ru: 'О нас', en: null } })],
        logo_url: '',
    });

    expect(parsed?.items[0].name).toEqual({ ru: 'О нас' });
});

test('отсутствующий или нестроковый icon_url даёт пустую строку', () => {
    const parsed = parsePublicNavigationResponse({
        items: [item({ id: 'none', icon_url: undefined }), item({ id: 'number', icon_url: 5 })],
        logo_url: '',
    });

    expect(parsed?.items.map((entry) => entry.iconUrl)).toEqual(['', '']);
});

test('отсутствующий logo_url даёт пустую строку', () => {
    expect(parsePublicNavigationResponse({ items: [] })?.logoUrl).toBe('');
});

test('profile_url в ответе игнорируется', () => {
    const parsed = parsePublicNavigationResponse({
        items: [],
        logo_url: '',
        profile_url: 'https://id.example.test/profile',
    });

    expect(parsed).toEqual({ items: [], logoUrl: '' });
});

test('ответ без перечня пунктов — null', () => {
    expect(parsePublicNavigationResponse(null)).toBeNull();
    expect(parsePublicNavigationResponse('items')).toBeNull();
    expect(parsePublicNavigationResponse([])).toBeNull();
    expect(parsePublicNavigationResponse({ logo_url: '' })).toBeNull();
});

test('пустой перечень — разобранный ответ, а не null', () => {
    expect(parsePublicNavigationResponse({ items: [], logo_url: '' })).toEqual({
        items: [],
        logoUrl: '',
    });
});
