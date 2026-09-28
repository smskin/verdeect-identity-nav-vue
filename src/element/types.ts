import type { NavItem } from '../cross-service';

/**
 * Вид, который элемент монтирует.
 *
 * Подмножество `NavPlacement` без `overlay`: блок в выдвижном меню встраивается
 * в разметку продукта, а теневой корень элемента туда не попадает.
 */
export type ElementPlacement = 'rail' | 'bottom';

/**
 * Свойства элемента `verdeect-identity-nav`.
 *
 * Состав повторяет объединение свойств полосы и плашки, а не вводит свой:
 * продукт получает данные с того же бэкенда, что и продукты на Vue, и второй
 * формат разошёлся бы с первым. Все необязательны намеренно — продукт задаёт
 * их свойствами уже после появления тега, и до этого элемент рисует пустоту,
 * а не падает.
 */
export interface IdentityNavElementProps {
    readonly placement?: ElementPlacement;
    readonly items?: readonly NavItem[];
    readonly locale?: string;
    readonly currentUrl?: string;
    readonly profileUrl?: string;
    readonly logoUrl?: string;
    readonly logoHeight?: string;
}
