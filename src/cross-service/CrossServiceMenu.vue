<script setup lang="ts">
import NavIcon from './NavIcon.vue';
import SettingsLink from './SettingsLink.vue';
import { translate } from './strings';
import { useNavView } from './useNavView';
import type { CrossServiceMenuProps } from './types';

/**
 * Блок кросс-сервисной навигации внутри выдвижного меню продукта
 * (PRD навигации 7.1, мобильный вид 1).
 *
 * **Первый из двух мобильных видов.** Второй — `CrossServiceBar`, плашка внизу
 * экрана; они **взаимоисключающие**, и продукт выбирает подходящий своей
 * оболочке. Плашка внизу годится не всякому интерфейсу, поэтому выбор оставлен
 * продукту, а не навязан пакетом.
 *
 * **Геометрии здесь нет: ширину задаёт панель хозяина.** Компонент — именно
 * блок, а не панель: он рисует заголовок, пункты с подписями и разделитель
 * в конце. Разделитель — шов, после которого продукт продолжает своими
 * разделами; их установка не знает и знать не может.
 *
 * Логотип не рисуется: в выдвижном меню его место занимает шапка продукта,
 * поэтому `logoUrl` этот вид и не принимает.
 *
 * Подписи видны без наведения, поэтому подсказки здесь нет — в отличие
 * от полосы, где имя показывать больше негде.
 */
const props = defineProps<CrossServiceMenuProps>();

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
</script>

<template>
    <nav
        v-if="items.length > 0"
        class="cross-service-nav cross-service-nav--menu"
        data-placement="overlay"
        :aria-label="t('services')"
        data-testid="cross-service-nav"
    >
        <p class="cross-service-nav__heading">{{ t('services') }}</p>

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

                    <span class="cross-service-nav__label">{{
                        nameOf(item)
                    }}</span>
                </a>
            </li>
        </ul>

        <SettingsLink
            v-if="hasSettings"
            :href="profileUrl ?? ''"
            :locale="locale"
            labelled
            :current="settingsCurrent"
        />

        <hr class="cross-service-nav__divider" />
    </nav>
</template>
