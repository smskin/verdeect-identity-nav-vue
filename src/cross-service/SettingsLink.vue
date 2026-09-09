<script setup lang="ts">
import { ref } from 'vue';
import NavTip from './NavTip.vue';
import { translate } from './strings';

/**
 * Шестерёнка настроек — ссылка на страницу профиля установки.
 *
 * Внутренний узел каталога: во вход `.` не отдаётся. Существует ради того,
 * чтобы значок в тридцать строк не лежал копией в трёх видах навигации —
 * такая копия расходится первой и незаметнее всех.
 *
 * **Кого показывать решает не этот узел, а вызывающий:** он рисуется лишь
 * при непустом адресе профиля (`useNavView().hasSettings`). Признак входа
 * выражен адресом, а не отдельным полем: гостю установка адреса не отдаёт.
 *
 * **Значок нарисован здесь, а не приходит файлом по ссылке.** Он принадлежит
 * компоненту, а не реестру установки, и подписанной ссылки на него
 * не существует. Шрифт иконок ради одного значка не подключается — его
 * пришлось бы заводить в каждом продукте (условие 10 `check:isolation`).
 * Тем же приёмом нарисованы значки `UserMenu.vue`.
 *
 * **Значок цвет наследует** — в отличие от иконки пункта: это собственный
 * SVG, а не чужое изображение, и `currentColor` здесь работает.
 */
interface Props {
    /** Адрес страницы профиля; узел рисуется только при непустом. */
    readonly href: string;
    /** Язык подписи. */
    readonly locale: string;
    /** Подпись рядом со значком — её просит блок меню, где подписи видны. */
    readonly labelled?: boolean;
    /**
     * Подсказка по наведению — её просит полоса, где подписи нет.
     *
     * Панель внизу не просит ни того ни другого: подписей там нет, а подсказка
     * по наведению на телефоне не раскрывается — имя доступно `aria-label`.
     * Явные признаки вместо «не подпись значит подсказка»: иначе панель
     * заводила бы обработчики, которым нечего показывать.
     */
    readonly tipped?: boolean;
    /**
     * Открыта ли страница профиля — тогда шестерёнка подсвечена как текущая.
     *
     * Признак приходит извне, а не считается здесь: правило текущей цели одно
     * на весь рейл и живёт в `useNavView`. Второе его воплощение — пусть даже
     * на одну ссылку — разошлось бы с первым.
     */
    readonly current?: boolean;
}

const props = defineProps<Props>();

const t = (key: string): string => translate(props.locale, key);

/**
 * Ссылка, у которой показана подсказка, либо `null`.
 *
 * Подсказка выносится в `body` тем же `NavTip`, что и у пунктов: внутри полосы
 * её обрезает прокрутка, и шестерёнка страдает от этого сильнее прочих — она
 * прижата к низу, где обрезание заметно менее всего.
 */
const tipAnchor = ref<HTMLElement | null>(null);

const showTip = (event: Event): void => {
    tipAnchor.value = event.currentTarget as HTMLElement;
};

const hideTip = (): void => {
    tipAnchor.value = null;
};
</script>

<template>
    <a
        class="cross-service-nav__link cross-service-nav__link--settings"
        :class="{ 'cross-service-nav__link--current': current === true }"
        :aria-current="current === true ? 'page' : undefined"
        :href="href"
        :aria-label="t('settings')"
        data-testid="cross-service-settings"
        @mouseenter="tipped === true && showTip($event)"
        @mouseleave="hideTip"
        @focus="tipped === true && showTip($event)"
        @blur="hideTip"
    >
        <span class="cross-service-nav__icon cross-service-nav__glyph">
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="3" />
                <path
                    d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
                />
            </svg>
        </span>

        <span v-if="labelled" class="cross-service-nav__label">{{
            t('settings')
        }}</span>

        <NavTip :text="t('settings')" :anchor="tipAnchor" />
    </a>
</template>
