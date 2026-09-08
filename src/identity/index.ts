/**
 * Точка входа `./identity` — вывод состояния рейла и профиля.
 *
 * Зависимость ровно одна — `vue`. Ни Inertia, ни любой другой схемы
 * доставки данных здесь нет: продукт передаёт готовые свойства и путь
 * открытой страницы, а правила их разбора живут тут и не переписываются
 * в каждом продукте заново.
 *
 * Продукту на Inertia отдельно писать нечего — вход `./inertia` содержит
 * готовый адаптер над `usePage()`.
 */

export { useIdentityView } from './useIdentityView';

export type { IdentityView, IdentityViewSource } from './useIdentityView';

export type { CrossServiceData, IdentityProfile, IdentityProps } from './types';
