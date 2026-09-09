<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import NavIcon from './NavIcon.vue';
import SettingsLink from './SettingsLink.vue';
import { translate } from './strings';
import { useNavView } from './useNavView';
import type { CrossServiceBarProps } from './types';

/**
 * Плашка кросс-сервисной навигации внизу экрана
 * (PRD навигации 7.1, мобильный вид 2).
 *
 * **Второй из двух мобильных видов и альтернатива первому.** Первый —
 * `CrossServiceMenu`, блок внутри выдвижного меню продукта. Продукт монтирует
 * полосу и **один** из двух: плашка внизу подходит не всякой оболочке, и
 * навязывать её пакет не вправе.
 *
 * **Логотипа и заголовка здесь нет** — их место в шапке продукта, поэтому
 * `logoUrl` этот вид не принимает.
 *
 * **Состав плашки зависит от ширины экрана, а не от числа пунктов.** Пока
 * пункты помещаются в строку целиком, все они и стоят в ней, а последний слот
 * занимает шестерёнка настроек. Как только не помещаются — этот слот отдан
 * контролу, раскрывающему список **всех** пунктов, и шестерёнка переезжает
 * в него последней строкой.
 *
 * **Слоты равны и разведены по ширине.** Список лишён собственного бокса
 * (`display: contents`), поэтому пункты и хвостовой узел делят строку в одной
 * раскладке. Разведённые порознь — список по своей ширине, хвост прижатым
 * к краю, — они давали неравные промежутки, и шов между двумя контейнерами
 * был виден глазом.
 *
 * **Правило «ни один пункт не исчезает» (PRD 7.2) этим не нарушено, а
 * исполнено иначе.** Прежде строка прокручивалась вбок: пункт оставался
 * достижимым, но невидимым — о прокрутке в строке из четырёх кнопок никто
 * не догадывается, а полосы прокрутки на телефоне не видно. Всплывающий
 * список показывает то же самое разом и подписями.
 *
 * **Порог не назначен числом.** Сколько кнопок помещается, решает измерение
 * настоящей ширины: пакет не знает ни ширины экрана продукта, ни его отступов,
 * и любое число, записанное здесь, разошлось бы с оболочкой (см. докблок
 * `index.ts` о числовых порогах).
 *
 * Подписей у кнопок нет, как и в полосе; имя показывает подсказка — а во
 * всплывающем списке подписи есть, ширина для них там своя.
 */
const props = defineProps<CrossServiceBarProps>();

const {
    currentId,
    hasSettings,
    settingsCurrent,
    nameOf,
    initialOf,
    stubbed,
    onIconError,
} = useNavView(props);

const t = (key: string): string => translate(props.locale, key);

/** Плашка целиком — по ней меряется доступная ширина. */
const root = ref<HTMLElement | null>(null);

/** Строка пунктов — из неё берётся ширина кнопки и промежуток. */
const list = ref<HTMLElement | null>(null);

/**
 * Сколько пунктов стоит в строке.
 *
 * Начальное значение — все: до первого измерения плашка рисуется целиком.
 * Так на широком экране (а он и есть частый случай) не бывает ни мигания,
 * ни лишней перерисовки, а на узком лишние кнопки прячутся тем же кадром.
 */
const shown = ref(props.items.length);

const collapsed = computed<boolean>(() => shown.value < props.items.length);

/** Раскрыт ли список; вне свёрнутого состояния он не существует. */
const opened = ref(false);

const close = (): void => {
    opened.value = false;
};

const toggle = (): void => {
    opened.value = !opened.value;
};

/**
 * Пересчитывает, сколько кнопок помещается в строку.
 *
 * Измеряется **настоящая** отрисованная кнопка, а не записанное здесь число:
 * геометрию задаёт таблица стилей, и продукт вправе её уточнить. Промежуток
 * берётся тем же способом — из вычисленного стиля строки.
 *
 * Хвостовой слот занят всегда, когда пунктов больше, чем помещается: там стоит
 * контрол. В несвёрнутом состоянии его занимает шестерёнка — но только если
 * смотрящий вошёл, у гостя её нет.
 *
 * Считается по **наименьшему** промежутку: строку разводит `space-around`,
 * и настоящие промежутки шире — но сводит он кнопки не ближе, чем `gap`.
 */
const measure = (): void => {
    const rootElement = root.value;
    const listElement = list.value;

    if (rootElement === null || listElement === null) {
        return;
    }

    const entry = listElement.firstElementChild;

    if (!(entry instanceof HTMLElement)) {
        return;
    }

    const width = entry.offsetWidth;

    if (width === 0) {
        return;
    }

    const style = window.getComputedStyle(rootElement);

    /**
     * Наименьший промежуток берётся у **плашки**, а не у списка: список лишён
     * собственного бокса (`display: contents`), и `gap` на нём не действует.
     */
    const measured = Number.parseFloat(style.columnGap);
    const gap = Number.isNaN(measured) ? 0 : measured;
    const slot = width + gap;

    const available =
        rootElement.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight);

    /** Сколько кнопок помещается: `k` кнопок разделены `k - 1` промежутками. */
    const fitting = Math.floor((available + gap) / slot);
    const tail = hasSettings.value ? 1 : 0;

    shown.value =
        props.items.length + tail <= fitting
            ? props.items.length
            : Math.max(1, fitting - 1);
};

/**
 * Наблюдатель за шириной плашки.
 *
 * Ширина меняется не только поворотом телефона: оболочка вправе показать
 * и скрыть собственную колонку, и событие окна об этом не расскажет.
 */
let observer: ResizeObserver | null = null;

onMounted(() => {
    measure();

    observer = new ResizeObserver(measure);

    if (root.value !== null) {
        observer.observe(root.value);
    }
});

onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
});

watch(
    () => props.items,
    async (): Promise<void> => {
        shown.value = props.items.length;
        await nextTick();
        measure();
    },
);

/** Разъехавшийся список закрывается сам: раскрывать больше нечего. */
watch(collapsed, (value): void => {
    if (!value) {
        close();
    }
});
</script>

<template>
    <nav
        v-if="items.length > 0"
        ref="root"
        class="cross-service-nav cross-service-nav--bar"
        data-placement="bottom"
        :aria-label="t('services')"
        data-testid="cross-service-nav"
        @keydown.escape="close"
    >
        <ul ref="list" class="cross-service-nav__list" role="list">
            <li
                v-for="(item, index) in items"
                :key="item.id"
                class="cross-service-nav__entry"
                :hidden="index >= shown"
                :data-testid="`cross-service-item-${item.id}`"
            >
                <a
                    class="cross-service-nav__link"
                    :class="{
                        'cross-service-nav__link--current':
                            item.id === currentId,
                    }"
                    :href="item.url"
                    :aria-label="nameOf(item)"
                    :aria-current="item.id === currentId ? 'page' : undefined"
                    :data-testid="
                        item.id === currentId
                            ? 'cross-service-item-current'
                            : undefined
                    "
                >
                    <NavIcon
                        :url="item.iconUrl"
                        :item-id="item.id"
                        :stubbed="stubbed(item)"
                        :initial="initialOf(item)"
                        @error="onIconError(item)"
                    />
                </a>
            </li>
        </ul>

        <SettingsLink
            v-if="hasSettings && !collapsed"
            :href="profileUrl ?? ''"
            :locale="locale"
            :current="settingsCurrent"
        />

        <button
            v-if="collapsed"
            type="button"
            class="cross-service-nav__link cross-service-nav__link--more"
            :class="{ 'cross-service-nav__link--open': opened }"
            :aria-label="t('allServices')"
            :aria-expanded="opened"
            aria-haspopup="menu"
            data-testid="cross-service-more"
            @click="toggle"
        >
            <span class="cross-service-nav__icon cross-service-nav__glyph">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.9"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
            </span>
        </button>

        <div
            v-if="opened"
            class="cross-service-nav__scrim"
            data-testid="cross-service-scrim"
            @click="close"
        ></div>

        <div
            v-if="opened"
            class="cross-service-nav__popup"
            data-testid="cross-service-popup"
        >
            <a
                v-for="item in items"
                :key="item.id"
                class="cross-service-nav__link cross-service-nav__row"
                :class="{
                    'cross-service-nav__link--current': item.id === currentId,
                }"
                :href="item.url"
                :aria-current="item.id === currentId ? 'page' : undefined"
                :data-testid="`cross-service-popup-item-${item.id}`"
            >
                <NavIcon
                    :url="item.iconUrl"
                    :item-id="item.id"
                    :stubbed="stubbed(item)"
                    :initial="initialOf(item)"
                    @error="onIconError(item)"
                />

                <span class="cross-service-nav__label">{{ nameOf(item) }}</span>
            </a>

            <hr v-if="hasSettings" class="cross-service-nav__divider" />

            <SettingsLink
                v-if="hasSettings"
                class="cross-service-nav__row"
                :href="profileUrl ?? ''"
                :locale="locale"
                labelled
                :current="settingsCurrent"
            />
        </div>
    </nav>
</template>
