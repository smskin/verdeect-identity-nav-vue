<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

/**
 * Подсказка с именем пункта, вынесенная из полосы.
 *
 * **Существует потому, что подсказку внутри полосы показать нельзя.** Полоса
 * обязана прокручиваться, когда пунктов больше, чем помещается по высоте
 * (PRD навигации 7.2), — а это `overflow-y: auto`. По спецификации CSS, если
 * одна ось переполнения не `visible`, вторая из `visible` вычисляется в `auto`:
 * полоса начинает обрезать и по горизонтали. Подсказка же по построению выходит
 * за её правый край — и обрезалась там до последнего пикселя, оставляя снаружи
 * один уголок. Прежнее правило `position: absolute` этого не лечит ничем:
 * обрезает предок, а не сам узел.
 *
 * **Поэтому узел уезжает в `body` через `Teleport`.** Оказавшись вне
 * прокручиваемого предка, он не обрезается ничем, а место на экране получает
 * `position: fixed` с координатами, снятыми с самой ссылки.
 *
 * **Цена — вычисление координат, которого у каталога до сих пор не было.**
 * Чисто оформительского решения у задачи нет: пока узел лежит внутри
 * прокручиваемого контейнера, его обрежет любой из них, а вынесенный узел
 * о своём месте на экране из CSS узнать не может. `position: fixed` без `top`
 * встал бы на статическую позицию и обошёлся бы без вычислений, но остался бы
 * висеть на месте при прокрутке полосы — то есть напротив уже другого пункта.
 *
 * К `document` компонент не обращается: цель переноса называется строкой, её
 * разрешает сам Vue, а размеры снимаются с переданного узла (условие 7
 * `check:isolation`).
 */
interface Props {
    /** Текст подсказки; уже переведён вызывающим. */
    readonly text: string;
    /**
     * Узел, у которого подсказка стоит, либо `null` — не показывать.
     *
     * Передаётся сам элемент, а не признак «показана»: координаты снимаются
     * с него, и признак потребовал бы второго источника — ссылки на узел,
     * которая разошлась бы с признаком при быстром переводе указателя
     * с пункта на пункт.
     */
    readonly anchor: HTMLElement | null;
}

const props = defineProps<Props>();

/** Отступ подсказки от правого края ссылки, пикселей. */
const GAP = 10;

const top = ref(0);
const left = ref(0);

/**
 * Ставит подсказку напротив середины ссылки, правее неё.
 *
 * Координаты снимаются заново при каждом показе и при каждой прокрутке:
 * запомненные один раз, они разъехались бы с пунктом, как только полоса
 * прокрутится, — ровно тот изъян, ради которого выбран перенос, а не
 * статическая позиция.
 */
const place = (): void => {
    const element = props.anchor;

    if (element === null) {
        return;
    }

    const rect = element.getBoundingClientRect();

    top.value = rect.top + rect.height / 2;
    left.value = rect.right + GAP;
};

/**
 * Прокрутка слушается **на этапе перехвата**: прокручивается вложенная полоса,
 * а её событие до окна не всплывает.
 */
const listen = (): void => {
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
};

const unlisten = (): void => {
    window.removeEventListener('scroll', place, true);
    window.removeEventListener('resize', place);
};

watch(
    () => props.anchor,
    (element): void => {
        unlisten();

        if (element === null) {
            return;
        }

        place();
        listen();
    },
    { immediate: true },
);

onBeforeUnmount(unlisten);
</script>

<template>
    <Teleport v-if="anchor !== null" to="body">
        <span
            class="cross-service-nav__tip"
            :style="{ top: `${top}px`, left: `${left}px` }"
            role="tooltip"
            aria-hidden="true"
            data-testid="cross-service-tip"
            >{{ text }}</span
        >
    </Teleport>
</template>
