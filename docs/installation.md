# Установка и подключение

Пакет поставляется **исходниками** — `.vue`, `.ts` и `.css` без шага сборки.
Собирает их интерфейс продукта.

## Требования

| Что | Зачем |
| --- | --- |
| Vue 3.5+ | компоненты написаны на `<script setup lang="ts">` |
| Vite с `@vitejs/plugin-vue` | плагин обрабатывает `.vue` в зависимостях наравне со своими |
| Шрифт PrimeIcons | компоненты опираются на классы `pi pi-*`, но шрифта не поставляют |

Собранного бандла у пакета нет намеренно: ни один потребитель не потребляет его
без Vite, а шаг сборки добавил бы `prepare` при установке из git ради нулевой
выгоды.

## Установка

```bash
npm install git+ssh://git@gitlab.mkomov.com:verdeect/verdeect-identity-integration-vue.git#v0.1.0
```

Версия задаётся тегом. Одноранговые зависимости, кроме `vue`, объявлены
необязательными — ставится только то, что продукт действительно потребляет.

| Зависимость | Обязательна | Когда нужна |
| --- | --- | --- |
| `vue` | да | всегда |
| `@inertiajs/vue3` | нет | только для входа `./inertia` |
| `@playwright/test` | нет | только для входа `./playwright` |
| `primeicons` | нет | шрифт иконок; без него пункты рейла останутся без глифов |

## Пять входов

```ts
import { CrossServiceNav, UserMenu } from '@verdeect/identity-integration-vue';
import { useIdentity } from '@verdeect/identity-integration-vue/inertia';
import { useIdentityView } from '@verdeect/identity-integration-vue/identity';
import { loginAs } from '@verdeect/identity-integration-vue/playwright';
```

```css
@import '@verdeect/identity-integration-vue/style.css';
```

| Вход | Содержимое | Зависимости |
| --- | --- | --- |
| `.` | `CrossServiceNav`, `UserMenu` и их типы | `vue` |
| `./style.css` | визуальный слой | — |
| `./identity` | вывод состояния рейла и профиля, типы | `vue` |
| `./inertia` | адаптер над `usePage()` | `vue`, `@inertiajs/vue3` |
| `./playwright` | `loginAs`, `logout`, `credentialsFor` | `@playwright/test` |

**Продукт на Inertia** берёт `.`, `./style.css` и `./inertia`.
**Продукт на другом стеке** — те же, но вместо адаптера `./identity`,
и `@inertiajs/vue3` не ставит вовсе.
**Сама установка** обходится входами `.` и `./style.css`: данные рейла она
порождает, а не получает.

## Проверка подключения

```bash
npm ls @verdeect/identity-integration-vue   # разрешился ли пакет
npm run build                               # .vue из зависимости собирается
```

Если сборка спотыкается о `.vue` внутри `node_modules`, проверьте, что
`@vitejs/plugin-vue` подключён в `vite.config.ts` и что предварительная сборка
зависимостей не пытается обрабатывать пакет как готовый бандл — в этом случае
исключите его через `optimizeDeps.exclude`, а не отключением проверок.

## Дальше

- [Встраивание компонентов](embedding.md) — девять обязанностей продукта
- [Состояние рейла](state.md) — откуда компоненты берут данные
- [Оформление](styling.md) — переменные и порог переключения
