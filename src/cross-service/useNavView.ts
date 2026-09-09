import { computed, onMounted, ref, watch, type ComputedRef } from 'vue';
import { currentItemId } from './currentItem';
import type { NavItem } from './types';

/**
 * Общая часть трёх видов навигации (PRD навигации 7.1–7.4, 9.2).
 *
 * Рейл, блок меню и нижняя панель — три разных компонента: их разметка
 * разошлась настолько, что общий файл с ветвлением был бы тремя
 * компонентами, слипшимися вместе. Но правила у них **одни**: какой пункт
 * текущий, на каком языке его имя, что показать вместо не загрузившейся
 * иконки и показывать ли шестерёнку.
 *
 * **Правила живут здесь, а не копией в каждом виде.** Копия — это то,
 * из-за чего пакет и существует: компоненты уже жили в трёх местах, совпадали
 * кодом и разъехались документацией и стилями (`docs/contributing.md`).
 * Три копии внутри одного каталога разойдутся так же, только быстрее.
 *
 * Вызовов словаря здесь нет намеренно: `check-component-strings.mjs` ищет
 * ключи только в `.vue`, и переезд `t('…')` сюда вывел бы ключ из-под
 * проверки молча.
 */
export interface NavViewSource {
    readonly items: readonly NavItem[];
    readonly locale: string;
    readonly currentUrl?: string;
    readonly profileUrl?: string;
}

export interface NavView {
    /** Идентификатор текущего пункта либо `null`. */
    currentId: ComputedRef<string | null>;
    /** Показывать ли шестерёнку настроек. */
    hasSettings: ComputedRef<boolean>;
    /** Имя пункта на языке пользователя. */
    nameOf: (item: NavItem) => string;
    /** Первая буква имени — заглушка вместо иконки. */
    initialOf: (item: NavItem) => string;
    /** Показывать ли заглушку вместо изображения. */
    stubbed: (item: NavItem) => boolean;
    /** Пометить пункт, изображение которого браузер не загрузил. */
    onIconError: (item: NavItem) => void;
}

export function useNavView(source: NavViewSource): NavView {
    /**
     * Адрес открытой страницы, когда его не передал продукт.
     *
     * Вычисляется при монтировании, а не при загрузке модуля: значение,
     * посчитанное однажды на уровне модуля, застыло бы на первой странице.
     * При отрисовке на сервере обработчик не выполняется вовсе, и обращения
     * к отсутствующему окну не происходит.
     */
    const openedAtMount = ref('');

    /** Пункты, иконка которых не загрузилась (PRD 9.4). */
    const failed = ref<ReadonlySet<string>>(new Set());

    const openedUrl = computed<string>(
        () => source.currentUrl ?? openedAtMount.value,
    );

    const currentId = computed<string | null>(() =>
        currentItemId(source.items, openedUrl.value),
    );

    /**
     * Шестерёнка показывается по непустому адресу профиля.
     *
     * Признак входа выражен адресом, а не отдельным полем: гостю установка
     * адреса не отдаёт, и пустое значение означает «страницы профиля
     * у смотрящего нет» (`CrossServiceData.profileUrl`). Непереданный проп
     * равнозначен пустому — продукт прежней версии ведёт себя как прежде.
     */
    const hasSettings = computed<boolean>(
        () => source.profileUrl !== undefined && source.profileUrl !== '',
    );

    /**
     * Имя пункта на языке пользователя.
     *
     * При неизвестном языке берётся первое имеющееся, а не пустая строка:
     * подпись обязана быть — пустая неотличима от отсутствия пункта.
     */
    function nameOf(item: NavItem): string {
        return item.name[source.locale] ?? Object.values(item.name)[0] ?? '';
    }

    function initialOf(item: NavItem): string {
        return nameOf(item).slice(0, 1).toUpperCase();
    }

    /** Заглушка нужна, если ссылки нет либо изображение не загрузилось. */
    function stubbed(item: NavItem): boolean {
        return item.iconUrl === '' || failed.value.has(item.id);
    }

    function onIconError(item: NavItem): void {
        failed.value = new Set(failed.value).add(item.id);
    }

    onMounted(() => {
        openedAtMount.value = window.location.href;
    });

    watch(
        () => source.items,
        () => {
            // Новый состав пунктов — новая попытка загрузки: прежние неудачи
            // относились к прежним ссылкам, а те уже сменились.
            failed.value = new Set();
        },
    );

    return { currentId, hasSettings, nameOf, initialOf, stubbed, onIconError };
}
