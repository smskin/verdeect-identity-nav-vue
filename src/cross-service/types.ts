/**
 * Типы переносимого каталога кросс-сервисной навигации
 * (PRD навигации 9.1–9.3).
 *
 * Каталог рассчитан на выемку в отдельный репозиторий перемещением файлов,
 * поэтому здесь нет ни одного импорта из приложения: ни `@/types`,
 * ни `@inertiajs/*`. Состав полей `NavItem` совпадает с ответом операции
 * `POST /api/users/services` (PRD навигации 5.3, `RSNavigationItem`) —
 * продукт передаёт `items` ответа как есть, ничего не перекладывая.
 *
 * Индексных сигнатур здесь нет намеренно — по тому же доводу, что
 * и в `resources/js/types/registry.ts`: она заглушила бы обращение
 * к несуществующему полю, и расхождение сервера с компонентом стало бы
 * необнаруживаемым.
 *
 * Числовых порогов ширины в каталоге нет — см. докблок `index.ts`.
 */

/**
 * Куда хозяин смонтировал рейл.
 *
 * `rail` — постоянная полоса слева от навигации продукта;
 * `overlay` — содержимое выдвижной панели продукта на узком экране
 * (PRD навигации 7.1).
 */
export type NavPlacement = 'rail' | 'overlay';

/**
 * Пункт кросс-сервисной навигации (PRD навигации 5.3).
 *
 * Поле названо `name` в единственном числе и является объектом по языкам:
 * это одно имя пункта, отданное на всех поддерживаемых языках сразу.
 * Выбор языка выполняет компонент по prop `locale` (PRD навигации 4.3).
 *
 * `order` — порядок показа; сервер отдаёт пункты уже упорядоченными,
 * но поле оставлено, потому что продукт вправе хранить ответ и склеивать
 * его с собственными данными.
 */
export interface NavItem {
    readonly id: string;
    readonly name: Readonly<Record<string, string>>;
    readonly url: string;
    readonly icon: string;
    readonly order: number;
}

/**
 * Пункт меню самого продукта в блоке пользователя (PRD навигации 9.3).
 *
 * Сервис о таких пунктах не знает и их не хранит: их передаёт продукт,
 * встраивающий компонент.
 */
export interface ProductMenuItem {
    readonly name: string;
    readonly url: string;
}

/**
 * Props компонента `CrossServiceNav` (PRD навигации 9.2).
 *
 * `currentUrl` необязателен: без него компонент берёт адрес открытой
 * страницы сам. Это единственное необязательное поле — `placement`
 * обязателен намеренно, см. докблок самого компонента.
 */
export interface CrossServiceNavProps {
    readonly items: readonly NavItem[];
    readonly locale: string;
    readonly logoUrl: string;
    readonly currentUrl?: string;
    readonly placement: NavPlacement;
}

/**
 * Props компонента `UserMenu` (PRD навигации 9.3).
 *
 * Все три формы имени приходят готовыми: компонент их не склеивает
 * и не сокращает. `email` без значения означает, что строка адреса
 * не показывается, а не что вместо неё показывается пустая.
 */
export interface UserMenuProps {
    readonly shortName: string;
    readonly name: string;
    readonly initials: string;
    readonly email?: string | null;
    readonly profileUrl: string;
    readonly locale: string;
    readonly items?: readonly ProductMenuItem[];
}
