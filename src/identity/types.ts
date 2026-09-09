import type { NavItem } from '../cross-service';

/**
 * Профиль вошедшего сотрудника.
 *
 * Приходит от продукта, который получил его с собственного бэкенда.
 * **Токенов здесь нет** и быть не может: схема Backend-for-Frontend
 * обязательна, они живут только на сервере.
 */
export interface IdentityProfile {
    readonly sub: string;
    readonly name: string;
    readonly givenName: string;
    readonly familyName: string;
    readonly middleName: string;
    readonly locale: string;
    readonly shortName: string;
    readonly initials: string;
    /**
     * Адрес владельца учётной записи.
     *
     * Поле обязательное, а пустая строка законна и означает «адреса нет»:
     * установка, которой не разрешена область `email`, утверждения
     * не отдаёт. Необязательное поле заставило бы каждого потребителя
     * различать «не пришло» и «пусто», хотя показывать в обоих случаях
     * нечего — `UserMenu` на пустое значение строку адреса не рисует.
     */
    readonly email: string;
}

/**
 * Данные рейла кросс-сервисной навигации.
 *
 * Пункты приходят уже отфильтрованными по роли и в порядке отображения:
 * своих правил видимости продукт не применяет.
 */
export interface CrossServiceData {
    readonly items: readonly NavItem[];
    readonly profileUrl: string;
    readonly logoUrl: string;
}

/**
 * Состав свойств identity, который продукт получает с бэкенда.
 *
 * Как именно продукт их доставляет — разделяемыми свойствами Inertia,
 * начальным состоянием страницы или запросом — пакета не касается:
 * ядро принимает готовое значение.
 */
export interface IdentityProps {
    readonly profile: IdentityProfile | null;
    readonly crossService: CrossServiceData;
}
