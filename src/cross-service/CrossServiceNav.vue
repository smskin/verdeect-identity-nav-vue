<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
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
 * **Иконка — изображение по подписанной ссылке, а не глиф шрифта** (PRD 9.4).
 * Набора иконок нет: шрифт пришлось бы подключать в каждом продукте установки,
 * а продукты о нём не знают. Вместе с набором ушло и обращение к отрисованному
 * узлу: прежде компонент читал псевдоэлемент `::before`, чтобы выяснить,
 * нарисован ли глиф; теперь о неудаче сообщает событие `error` самой картинки.
 *
 * **Цвет иконки задаёт файл, а не тон рейла.** Глиф шрифта наследовал `color`,
 * изображение — нет. Способ, сохраняющий наследование (маска по силуэту),
 * отклонён: он превратил бы многоцветную иконку в силуэт, а предполагать
 * одноцветность загруженного администратором файла оснований нет
 * (PRD навигации 7.1). За читаемость на тоне рейла отвечает администратор
 * установки.
 *
 * **Пустой `iconUrl` равнозначен неудачной загрузке.** Так парная библиотека
 * читает ответ установки, ещё не перешедшей на загружаемые иконки; пункт
 * показывается первой буквой имени, а рейл целиком работоспособен.
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

/** Пункты, иконка которых не загрузилась (PRD 9.4). */
const failed = ref<ReadonlySet<string>>(new Set());

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

/** Заглушка вместо не загрузившейся иконки — первая буква имени (PRD 9.4). */
function initialOf(item: NavItem): string {
    return nameOf(item).slice(0, 1).toUpperCase();
}

/** Показывать ли заглушку: ссылки нет либо изображение не загрузилось. */
function stubbed(item: NavItem): boolean {
    return item.iconUrl === '' || failed.value.has(item.id);
}

/** Помечает пункт, изображение которого браузер не загрузил. */
function onIconError(item: NavItem): void {
    failed.value = new Set(failed.value).add(item.id);
}

onMounted(() => {
    openedAtMount.value = window.location.href;
});

watch(
    () => props.items,
    () => {
        // Новый состав пунктов — новая попытка загрузки: прежние неудачи
        // относились к прежним ссылкам, а те уже сменились.
        failed.value = new Set();
    },
);
</script>

<template>
    <nav
        v-if="items.length > 0"
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
                        v-if="stubbed(item)"
                        class="cross-service-nav__stub"
                        aria-hidden="true"
                        >{{ initialOf(item) }}</span
                    >
                    <img
                        v-else
                        class="cross-service-nav__icon"
                        :src="item.iconUrl"
                        alt=""
                        aria-hidden="true"
                        :data-icon-for="item.id"
                        @error="onIconError(item)"
                    />

                    <span class="cross-service-nav__label">{{
                        nameOf(item)
                    }}</span>
                </a>
            </li>
        </ul>

        <hr v-if="placement === 'overlay'" class="cross-service-nav__divider" />
    </nav>
</template>
