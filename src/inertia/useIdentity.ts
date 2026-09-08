import { usePage } from '@inertiajs/vue3';
import {
    useIdentityView,
    type IdentityProps,
    type IdentityView,
} from '../identity';

/**
 * Состояние рейла и профиля для продукта на Inertia.
 *
 * Адаптер и только адаптер: он добывает свойства страницы и её адрес,
 * а выводит из них всё ядро входа `./identity`. Собственных правил здесь
 * нет ни одного — появившееся здесь правило было бы недоступно продукту
 * на другой схеме доставки.
 *
 * Свойство `identity` типизируется **параметром** `usePage`, а не
 * объявлением `sharedPageProps`: состав страницы принадлежит продукту,
 * и библиотека, объявив его за него, отняла бы у него собственные
 * свойства либо породила второе расширение того же интерфейса.
 *
 * Свойство объявлено необязательным намеренно: страница входа отдаётся
 * до появления сессии, и `identity` на ней может не быть вовсе.
 */
export function useIdentity(): IdentityView {
    const page = usePage<{ identity?: IdentityProps }>();

    return useIdentityView({
        props: () => page.props.identity,
        path: () => page.url,
    });
}
