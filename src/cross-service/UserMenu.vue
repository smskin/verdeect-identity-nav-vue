<script setup lang="ts">
import { nextTick, onUnmounted, ref } from 'vue';
import { translate } from './strings';
import type { UserMenuProps } from './types';

/**
 * Блок пользователя единого входа (PRD навигации 9.3).
 *
 * **Формы имени приходят готовыми.** Инициалы, краткая и полная формы
 * вычисляются на стороне сервиса; компонент их не склеивает и не сокращает.
 * Ветки «фото, если есть» нет — фотографии у сервиса нет.
 *
 * **Выход компонент не выполняет и никуда не перенаправляет**: он лишь
 * порождает событие `logout`. У сервиса и у продуктов выход устроен
 * по-разному, и решение принимает тот, кто компонент встроил.
 *
 * **Порога узкого экрана компонент не знает.** Краткая форма имени помечена
 * классом `cross-service-user__short-name`; прячет её продукт своим
 * медиазапросом — тем же, на котором переключается его собственная
 * навигация.
 *
 * **Обращение к `document` здесь допустимо и ограничено закрытием меню.**
 * Слушатели `keydown` и `pointerdown` живут только пока меню раскрыто
 * и снимаются при закрытии и при размонтировании: оставленный слушатель —
 * утечка, которая в продукте проявится не сразу.
 */
const props = withDefaults(defineProps<UserMenuProps>(), {
    email: null,
    items: () => [],
});

const emit = defineEmits<{ logout: [] }>();

const opened = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLElement | null>(null);
const menu = ref<HTMLElement | null>(null);

const t = (key: string): string => translate(props.locale, key);

function onEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        close();
    }
}

function onPointerDown(event: Event): void {
    const host = root.value;

    if (host === null) {
        return;
    }

    if (event.target instanceof Node && host.contains(event.target)) {
        return;
    }

    close();
}

function listen(): void {
    document.addEventListener('keydown', onEscape);
    document.addEventListener('pointerdown', onPointerDown);
}

function unlisten(): void {
    document.removeEventListener('keydown', onEscape);
    document.removeEventListener('pointerdown', onPointerDown);
}

function open(): void {
    opened.value = true;
    listen();

    nextTick(() => {
        menu.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
}

function close(): void {
    if (!opened.value) {
        return;
    }

    opened.value = false;
    unlisten();
    trigger.value?.focus();
}

function toggle(): void {
    if (opened.value) {
        close();

        return;
    }

    open();
}

function requestLogout(): void {
    close();
    emit('logout');
}

onUnmounted(unlisten);
</script>

<template>
    <div ref="root" class="cross-service-user" data-testid="user-menu">
        <button
            ref="trigger"
            type="button"
            class="cross-service-user__trigger"
            :class="{ 'cross-service-user__trigger--opened': opened }"
            :aria-label="t('openMenu')"
            aria-haspopup="menu"
            :aria-expanded="opened"
            data-testid="user-menu-trigger"
            @click="toggle"
        >
            <span
                class="cross-service-user__avatar cross-service-user__avatar--small"
                aria-hidden="true"
                >{{ initials }}</span
            >
            <span class="cross-service-user__short-name">{{ shortName }}</span>

            <!--
                Шеврон, а не треугольник (кадр 4b): 13 px, обводка 1.8,
                поворот на 180° в открытом состоянии. Рисуется разметкой,
                а не глифом набора: стрелка триггера к набору иконок
                отношения не имеет.
            -->
            <svg
                class="cross-service-user__caret"
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <path d="m6 9 6 6 6-6" />
            </svg>
        </button>

        <div
            v-if="opened"
            ref="menu"
            class="cross-service-user__menu"
            role="menu"
        >
            <div class="cross-service-user__head">
                <span class="cross-service-user__avatar" aria-hidden="true">{{
                    initials
                }}</span>
                <span
                    class="cross-service-user__name"
                    data-testid="user-menu-name"
                    >{{ name }}</span
                >
                <span
                    v-if="email"
                    class="cross-service-user__email"
                    data-testid="user-menu-email"
                    >{{ email }}</span
                >
            </div>

            <a
                class="cross-service-user__entry"
                role="menuitem"
                :href="profileUrl"
                data-testid="user-menu-profile"
                @click="close"
            >
                <i class="pi pi-user" aria-hidden="true"></i>
                {{ t('profile') }}
            </a>

            <a
                v-for="(item, index) in items"
                :key="item.url"
                class="cross-service-user__entry"
                role="menuitem"
                :href="item.url"
                :data-testid="`user-menu-item-${index}`"
                @click="close"
                >{{ item.name }}</a
            >

            <button
                type="button"
                class="cross-service-user__entry cross-service-user__entry--logout"
                role="menuitem"
                data-testid="user-menu-logout"
                @click="requestLogout"
            >
                <i class="pi pi-sign-out" aria-hidden="true"></i>
                {{ t('logout') }}
            </button>
        </div>
    </div>
</template>
