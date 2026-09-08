# Состояние рейла и профиля

Компоненты в сеть не ходят: данные приходят только props. Откуда их взять —
задача продукта, и пакет помогает двумя входами.

## Продукт на Inertia

```ts
import { useIdentity } from '@verdeect/identity-nav-vue/inertia';

const { profile, crossService, locale, hasRail, currentUrl } = useIdentity();
```

Адаптер читает свойство `identity` со страницы Inertia и её адрес, остальное
считает ядро. Свойство поставляет composer-пакет `verdeect/identity-integration`
вызовом `IdentityProps::share()`.

Свойство типизируется параметром `usePage`, а не объявлением `sharedPageProps`:
состав страницы принадлежит продукту, и библиотека, объявив его за него, отняла
бы у продукта собственные свойства.

## Продукт на другом стеке

```ts
import { useIdentityView } from '@verdeect/identity-nav-vue/identity';

const view = useIdentityView({
    props: () => store.identity,       // сырые свойства с бэкенда
    path: () => route.path,            // путь открытой страницы
});
```

Оба источника передаются **функциями**: вычисленные на момент вызова, они
замерли бы навсегда, и подсветка текущего пункта застряла бы на первой
открытой странице.

## Что возвращают оба входа

| Значение | Содержимое |
| --- | --- |
| `profile` | профиль вошедшего либо `null` |
| `crossService` | `items`, `profileUrl`, `logoUrl` |
| `locale` | язык подписей из профиля, запасной — `ru` |
| `hasRail` | состав пунктов непуст |
| `currentUrl` | абсолютный адрес открытой страницы |

## Три правила, ради которых существует ядро

Их легко воспроизвести неверно, поэтому они живут в библиотеке, а не в каждом
продукте.

1. **Адрес собирается абсолютным** — из origin окна и пути. Правило текущего
   пункта сравнивает схему и хост; путь без них не подсвечивает ничего.
   При отрисовке на сервере окна нет, и возвращается путь как есть: подсветка
   на сервере всё равно не видна, а обращение к отсутствующему объекту уронило
   бы отрисовку целиком.
2. **Пустой состав рейла задан значением по умолчанию** — чтобы отсутствие
   свойства и пустой рейл не путались.
3. **Язык берётся из профиля** с запасным `ru`: `locale` приходит из
   `/userinfo` установки и относится к отображению интерфейса своему владельцу.

## Типы

```ts
import type {
    IdentityProfile,
    CrossServiceData,
    IdentityProps,
} from '@verdeect/identity-nav-vue/identity';
```

`IdentityProfile` — `sub`, `name`, `givenName`, `familyName`, `middleName`,
`locale`, `shortName`, `initials`.
`CrossServiceData` — `items`, `profileUrl`, `logoUrl`.
`IdentityProps` — пара `profile` и `crossService`.

Типы принадлежат **ядру**, а не адаптеру: они описывают данные, а не способ
их доставки.

### Объявление свойств страницы остаётся продукту

```ts
// resources/js/types/global.d.ts продукта
import type { IdentityProps } from '@verdeect/identity-nav-vue/identity';

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            identity: IdentityProps;
            // ...собственные свойства продукта
        };
    }
}
```

Пакет объявить это за продукт не может: `sharedPageProps` описывает страницу
целиком, включая свойства, о которых библиотека ничего не знает.

## Токенов здесь нет

Ни в одном из входов и ни в одном типе. Схема Backend-for-Frontend
обязательна: токены живут на сервере продукта. Компоненты, кроме того,
не обращаются к браузерным хранилищам — кэш данных рейла ведёт бэкенд.

## Дальше

- [Встраивание компонентов](embedding.md)
- [Тестирование](testing.md)
