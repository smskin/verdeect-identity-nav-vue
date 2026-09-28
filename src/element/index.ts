import { defineCustomElement } from 'vue';
import IdentityNav from './IdentityNav.ce.vue';

/**
 * Вход `./element` — рейл кросс-сервисной навигации пользовательским
 * элементом для продуктов не на Vue.
 *
 * **Единственный вход пакета, который собирается.** Остальные поставляются
 * исходниками и собираются Vite потребителя; у продукта на Svelte или без
 * сборщика Vite нет, и исходники `.vue` ему взять нечем. Vue лежит внутри
 * собранного файла, поэтому потребителю элемента ставить его незачем.
 *
 * Визуальный слой и правила хоста приходят стилями `IdentityNav.ce.vue`
 * и оказываются в теневом корне элемента.
 */
export const IdentityNavElement = defineCustomElement(IdentityNav);

/**
 * Имя тега, под которым элемент регистрируется сам.
 */
export const IDENTITY_NAV_TAG = 'verdeect-identity-nav';

/*
 * Регистрация только при свободном имени: скрипт, загруженный дважды
 * (две точки подключения в продукте, повторная вставка), иначе ронял бы
 * страницу исключением `NotSupportedError`.
 */
if (customElements.get(IDENTITY_NAV_TAG) === undefined) {
    customElements.define(IDENTITY_NAV_TAG, IdentityNavElement);
}

export type { ElementPlacement, IdentityNavElementProps } from './types';
