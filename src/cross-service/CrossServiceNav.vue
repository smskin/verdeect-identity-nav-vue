<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { currentItemId } from './currentItem';
import { translate } from './strings';
import type { CrossServiceNavProps, NavItem } from './types';

/**
 * Рейл кросс-сервисной навигации (PRD навигации 7.1–7.4, 9.2).
 *
 * Данные приходят только props: ни сетевых обращений, ни браузерных хранилищ,
 * ни адресов сервиса внутри нет. Логотип загружает браузер по атрибуту `src`,
 * а не код компонента.
 *
 * **`placement` — единственное поле сверх таблицы PRD 9.2, и умолчания у него
 * нет намеренно.** Умолчание `rail` при забытой передаче отрисовало бы второй
 * рейл внутри бокового меню продукта, и проверка типов этого не заметила бы.
 * Тот, кто монтирует компонент, всегда знает, куда он его смонтировал.
 *
 * **Порядок пунктов не пересортировывается.** Он задан реестром и приходит
 * готовым; сортировка «на всякий случай» разошлась бы с тем, как сервер
 * упорядочивает пункты с равным `order`.
 *
 * **Обращение к отрисованному узлу здесь допустимо.** Известна ли иконка,
 * выясняется чтением псевдоэлемента `::before` собственного элемента рейла:
 * перечень идентификаторов компонент не ведёт, а рассинхрон версий набора
 * иконок PRD 9.4 называет штатным случаем. Это чтение своего же вывода,
 * а не сетевой запрос и не хранилище.
 *
 * Порогов ширины здесь нет: какое из двух представлений показать, решает
 * таблица стилей продукта по атрибуту `data-placement`.
 */
const props = defineProps<CrossServiceNavProps>();

/**
 * Адрес открытой страницы, когда его не передал продукт.
 *
 * Вычисляется при монтировании, а не при загрузке модуля: значение,
 * посчитанное однажды на уровне модуля, застыло бы на первой странице.
 */
const openedAtMount = ref('');

/** Логотип показывается по факту загрузки; места под него не резервируется. */
const logoShown = ref(false);

/** Пункты, для иконок которых шрифт не даёт глифа (PRD 9.4). */
const glyphless = ref<ReadonlySet<string>>(new Set());

const root = ref<HTMLElement | null>(null);

const t = (key: string): string => translate(props.locale, key);

const openedUrl = computed<string>(
    () => props.currentUrl ?? openedAtMount.value,
);

const currentId = computed<string | null>(() =>
    currentItemId(props.items, openedUrl.value),
);

/**
 * Имя пункта на языке пользователя.
 *
 * При неизвестном языке берётся первое имеющееся, а не пустая строка:
 * подпись в рейле обязана быть.
 */
function nameOf(item: NavItem): string {
    return item.name[props.locale] ?? Object.values(item.name)[0] ?? '';
}

/** Заглушка вместо неизвестной иконки — первая буква имени (PRD 9.4). */
function initialOf(item: NavItem): string {
    return nameOf(item).slice(0, 1).toUpperCase();
}

/**
 * Отмечает пункты, чья иконка не нарисована.
 *
 * Признак отсутствия глифа — пустое либо отсутствующее `content`
 * псевдоэлемента: правило `.pi-<имя>:before` объявлено таблицей стилей
 * набора, и для незнакомого идентификатора его просто нет.
 */
function detectGlyphless(): void {
    const host = root.value;

    if (host === null) {
        return;
    }

    const missing = new Set<string>();

    for (const item of props.items) {
        const icon = host.querySelector(`[data-icon-for="${item.id}"]`);

        if (icon === null) {
            continue;
        }

        const glyph = getComputedStyle(icon, '::before').content;

        if (glyph === '' || glyph === 'none' || glyph === 'normal') {
            missing.add(item.id);
        }
    }

    glyphless.value = missing;
}

onMounted(() => {
    openedAtMount.value = window.location.href;
    detectGlyphless();
});

watch(
    () => props.items,
    async () => {
        glyphless.value = new Set();
        await nextTick();
        detectGlyphless();
    },
);
</script>

<template>
    <nav
        v-if="items.length > 0"
        ref="root"
        class="cross-service-nav"
        :class="`cross-service-nav--${placement}`"
        :data-placement="placement"
        :aria-label="t('services')"
        data-testid="cross-service-nav"
    >
        <img
            v-if="placement === 'rail'"
            v-show="logoShown"
            class="cross-service-nav__logo"
            :src="logoUrl"
            :alt="t('logoAlt')"
            data-testid="cross-service-logo"
            @load="logoShown = true"
            @error="logoShown = false"
        />

        <p v-if="placement === 'overlay'" class="cross-service-nav__heading">
            {{ t('services') }}
        </p>

        <ul class="cross-service-nav__list">
            <li
                v-for="item in items"
                :key="item.id"
                class="cross-service-nav__entry"
                :data-testid="`cross-service-item-${item.id}`"
            >
                <a
                    class="cross-service-nav__link"
                    :class="{
                        'cross-service-nav__link--current':
                            item.id === currentId,
                    }"
                    :href="item.url"
                    :title="nameOf(item)"
                    :aria-current="item.id === currentId ? 'page' : undefined"
                    :data-testid="
                        item.id === currentId
                            ? 'cross-service-item-current'
                            : undefined
                    "
                >
                    <span
                        v-if="glyphless.has(item.id)"
                        class="cross-service-nav__stub"
                        aria-hidden="true"
                        >{{ initialOf(item) }}</span
                    >
                    <i
                        v-else
                        class="cross-service-nav__icon"
                        :class="['pi', item.icon]"
                        :data-icon-for="item.id"
                        aria-hidden="true"
                    ></i>

                    <span class="cross-service-nav__label">{{
                        nameOf(item)
                    }}</span>
                </a>
            </li>
        </ul>

        <hr v-if="placement === 'overlay'" class="cross-service-nav__divider" />
    </nav>
</template>
