<script setup lang="ts">
import { ref } from 'vue';
import NavIcon from './NavIcon.vue';
import NavTip from './NavTip.vue';
import SettingsLink from './SettingsLink.vue';
import { translate } from './strings';
import { useNavView } from './useNavView';
import type { CrossServiceRailProps } from './types';

/**
 * Постоянная полоса кросс-сервисной навигации слева (PRD навигации 7.1–7.4).
 *
 * **Десктопный вид.** Его пару на узком экране выбирает продукт:
 * `CrossServiceMenu` — блоком в своём выдвижном меню, либо `CrossServiceBar` —
 * плашкой внизу экрана. Виды взаимоисключающие, монтируются полоса и **один**
 * из двух, а переключение задаёт таблица стилей продукта по `data-placement`.
 *
 * Данные приходят только props: ни сетевых обращений, ни браузерных хранилищ,
 * ни адресов сервиса внутри нет. Логотип загружает браузер по атрибуту `src`,
 * а не код компонента.
 *
 * **Подписей у пунктов здесь нет** — имя показывает подсказка при наведении
 * (`NavTip`), а полное имя остаётся в `aria-label`, то есть доступно
 * и экранному диктору независимо от указателя.
 *
 * **Подсказка ведётся состоянием, а не правилом CSS.** Прежде она раскрывалась
 * по `:hover` соседним узлом внутри ссылки — и обрезалась полосой, которая
 * обязана прокручиваться: `overflow-y: auto` заставляет вычислять `overflow-x`
 * в `auto`, а подсказка по построению выходит за правый край. Довод «обработчики
 * наведения завели бы обращения к отрисованному узлу» силы не имеет: к `document`
 * ни полоса, ни `NavTip` не обращаются, а условие 7 `check:isolation` запрещает
 * именно его.
 *
 * **Порядок пунктов не пересортировывается.** Он задан реестром и приходит
 * готовым; сортировка «на всякий случай» разошлась бы с тем, как сервер
 * упорядочивает пункты с равным `order`.
 *
 * Порогов ширины здесь нет: когда показывать полосу, решает продукт — порог
 * обязан совпадать с порогом его собственной навигации.
 */
const props = defineProps<CrossServiceRailProps>();

const {
    currentId,
    hasSettings,
    settingsCurrent,
    nameOf,
    initialOf,
    stubbed,
    onIconError,
} = useNavView(props);

/** Логотип показывается по факту загрузки; места под него не резервируется. */
const logoShown = ref(false);

const t = (key: string): string => translate(props.locale, key);

/**
 * Ссылка, у которой сейчас показана подсказка, и её текст.
 *
 * Узел один на всю полосу: указатель наводится на один пункт, и второй узел
 * означал бы две подсказки одновременно.
 */
const tipAnchor = ref<HTMLElement | null>(null);
const tipText = ref('');

const showTip = (event: Event, text: string): void => {
    tipAnchor.value = event.currentTarget as HTMLElement;
    tipText.value = text;
};

const hideTip = (): void => {
    tipAnchor.value = null;
};
</script>

<template>
    <nav
        v-if="items.length > 0"
        class="cross-service-nav cross-service-nav--rail"
        data-placement="rail"
        :aria-label="t('services')"
        data-testid="cross-service-nav"
    >
        <img
            v-show="logoShown"
            class="cross-service-nav__logo"
            :src="logoUrl"
            :alt="t('logoAlt')"
            :style="
                logoHeight === undefined ? undefined : { height: logoHeight }
            "
            data-testid="cross-service-logo"
            @load="logoShown = true"
            @error="logoShown = false"
        />

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
                    @mouseenter="showTip($event, nameOf(item))"
                    @mouseleave="hideTip"
                    @focus="showTip($event, nameOf(item))"
                    @blur="hideTip"
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

        <span v-if="hasSettings" class="cross-service-nav__spacer"></span>

        <SettingsLink
            v-if="hasSettings"
            :href="profileUrl ?? ''"
            :locale="locale"
            tipped
            :current="settingsCurrent"
        />

        <NavTip :text="tipText" :anchor="tipAnchor" />
    </nav>
</template>
