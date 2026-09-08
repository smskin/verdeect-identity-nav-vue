/**
 * Точка входа `./inertia` — адаптер над `usePage()`.
 *
 * Единственный файл пакета, импортирующий `@inertiajs/vue3`. Зависимость
 * объявлена необязательной: продукт, не потребляющий этот вход, её
 * не ставит, а ядро входа `./identity` работает без неё.
 */

export { useIdentity } from './useIdentity';

export type { IdentityView } from '../identity';
