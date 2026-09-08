/**
 * Точка входа `./playwright` — вход в продукт установки для браузерных
 * сценариев.
 *
 * Зависимость `@playwright/test` объявлена необязательной: вход нужен
 * только прогонам, и обязательной она тянула бы прогонный пакет
 * в эксплуатационную сборку продукта.
 */

export { credentialsFor, loginAs, logout } from './login';

export type { LoginOptions, Role } from './login';
