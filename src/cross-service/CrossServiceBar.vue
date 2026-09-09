<script setup lang="ts">
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
 * **Пункты прокручиваются, а не прячутся.** Правило то же, что у полосы:
 * ни один пункт не исчезает (PRD 7.2), режимов «только иконки» и «Ещё»
 * не предусмотрено. Сколько их поместится, решает ширина экрана.
 *
 * **Бургер и всплывающее меню принадлежат продукту.** В макете плашка
 * соседствует с ними, но это его меню — как и выдвижная панель: пакет отдаёт
 * содержимое, состояние ведёт хозяин.
 *
 * Подписей нет, как и в полосе; имя показывает подсказка.
 */
const props = defineProps<CrossServiceBarProps>();

const { currentId, hasSettings, nameOf, initialOf, stubbed, onIconError } =
    useNavView(props);

const t = (key: string): string => translate(props.locale, key);
</script>

<template>
    <nav
        v-if="items.length > 0"
        class="cross-service-nav cross-service-nav--bar"
        data-placement="bottom"
        :aria-label="t('services')"
        data-testid="cross-service-nav"
    >
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
            v-if="hasSettings"
            :href="profileUrl ?? ''"
            :locale="locale"
        />
    </nav>
</template>
