import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { NavItem } from '../cross-service';
import { useIdentityView, type IdentityProps } from '../identity';
import { loadPublicNavigation } from './loadPublicNavigation';
import type {
    PublicNavigationFailure,
    PublicNavigationOptions,
    PublicNavigationView,
} from './types';

/**
 * Состав рейла для лендинга без бэкенда (PRD навигации 5.8).
 *
 * **Вывод идёт через ядро, а не рядом с ним.** Абсолютный адрес страницы,
 * порядок разрешения языка и признак непустого рейла уже закреплены
 * в `useIdentityView`; второе их воплощение в адаптере разошлось бы
 * с первым (`.ai-factory/ARCHITECTURE.md`, «правило вывода в адаптере»).
 * Композиция лишь добывает данные — запросом, а не `usePage()`, — и отдаёт
 * их ядру с профилем `null`.
 *
 * **Загрузка начинается при монтировании и прерывается при размонтировании.**
 * При отрисовке на сервере обработчик не выполняется, и запроса нет — он там
 * бесполезен. Ответ, пришедший в размонтированный компонент, писал бы
 * в мёртвое состояние.
 *
 * **Путь без опции не следит за маршрутизатором лендинга.** Окно читается
 * при каждом вычислении, но реактивным источником не является: переход
 * внутри SPA пересчёта не вызовет. Лендинг с маршрутизатором передаёт путь
 * опцией.
 *
 * **Повтора нет.** Отказ оставляет страницу без рейла; повтор по таймеру
 * нагрузил бы установку ровно тогда, когда она просит сбавить частоту.
 * Смена языка запроса не порождает: имена приходят на всех языках сразу.
 *
 * **Наборов у композиции нет** — прогонщик пакета компонентов не монтирует,
 * а хуки жизненного цикла вне компонента не выполняются. Вся логика вынесена
 * в `loadPublicNavigation` и `parsePublicNavigationResponse`, которые
 * проверяются прямыми вызовами.
 *
 * Вызывается в `setup` компонента.
 */
export function usePublicNavigation(
    options: PublicNavigationOptions,
): PublicNavigationView {
    const items = ref<readonly NavItem[]>([]);
    const logoUrl = ref('');
    const loading = ref(true);
    const failure = ref<PublicNavigationFailure | null>(null);

    let controller: AbortController | null = null;

    function openedPath(): string {
        if (options.path !== undefined) {
            return options.path();
        }

        if (typeof window === 'undefined') {
            return '/';
        }

        return window.location.pathname + window.location.search;
    }

    const view = useIdentityView({
        props: (): IdentityProps => ({
            profile: null,
            crossService: {
                items: items.value,
                profileUrl: '',
                logoUrl: logoUrl.value,
            },
            locale: options.locale(),
        }),
        path: openedPath,
    });

    onMounted(async (): Promise<void> => {
        controller = new AbortController();

        const result = await loadPublicNavigation(
            options.baseUrl,
            fetch,
            controller.signal,
        );

        if (result.status === 'aborted') {
            return;
        }

        if (result.status === 'loaded') {
            items.value = result.data.items;
            logoUrl.value = result.data.logoUrl;
        } else {
            failure.value = result.failure;
        }

        loading.value = false;
    });

    onBeforeUnmount((): void => {
        controller?.abort();
        controller = null;
    });

    return {
        crossService: view.crossService,
        locale: view.locale,
        hasRail: view.hasRail,
        currentUrl: view.currentUrl,
        loading,
        failure,
    };
}
