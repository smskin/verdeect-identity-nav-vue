/**
 * Загрузка файла иконки пункта в адрес `data:` для маски.
 *
 * **Маска не получает адрес хранилища — только содержимое файла.** Прежде
 * один и тот же подписанный адрес грузили двое: скрытая картинка запросом CORS
 * и маска. Safari грузит маску **без** `Origin`, хранилище на такой запрос
 * отвечает без `Access-Control-Allow-Origin`, и этот ответ ложится в общий
 * кэш поверх ответа с разрешением. Следующая картинка с `crossorigin` (второй
 * вид навигации, повтор, перемонтирование) достаёт его из кэша и падает
 * проверкой CORS: «Origin … is not allowed by Access-Control-Allow-Origin.
 * Status code: 200». Пункт после трёх неудач переходил на букву, и какой
 * пункт пострадает, решал порядок загрузок — отсюда «время от времени».
 * Уравнять режимы атрибутом нельзя: режим маски выбирает обозреватель.
 *
 * Здесь файл забирается **одним** запросом в одном режиме — `fetch` с CORS,
 * без учётных данных, — и маске отдаётся `data:` с тем же содержимым.
 * Запроса без `Origin` к хранилищу пакет больше не делает вовсе, поэтому
 * испортить запись кэша нечем.
 *
 * **Загрузка общая для всех видов.** Полоса, меню и плашка показывают одни
 * и те же пункты; обещание по адресу лежит в модуле, и файл запрашивается
 * один раз на страницу. Неудача из общего перечня убирается — повтор идёт
 * в хранилище заново, а не отдаёт ту же ошибку.
 *
 * **Сетевой запрос в каталоге — исключение, закреплённое проверкой
 * изоляции** (`FETCH_ALLOWED` в `scripts/check-component-isolation.mjs`).
 * Данные рейла по-прежнему приходят props; этот модуль лишь забирает файл
 * по адресу из них — ту же работу прежде делал обозреватель по `src`
 * картинки. Отсюда обязанность продукта: origin хранилища — в `connect-src`,
 * а `data:` — в `img-src` (`docs/checklist.md`).
 */

/** Обещание содержимого по адресу файла; живёт, пока открыта страница. */
const pending = new Map<string, Promise<string>>();

/**
 * Тип содержимого, когда хранилище не назвало тип изображения.
 *
 * Иконки установки — SVG. Хранилище, не знающее типа файла, отдаёт
 * `binary/octet-stream`, а с таким типом маска не распознала бы файл вовсе.
 */
const FALLBACK_TYPE = 'image/svg+xml';

/**
 * Содержимое файла иконки адресом `data:`.
 *
 * `fresh` — запрос в обход кэша обозревателя. Им идут повторы: запись,
 * испорченная прежней версией пакета, пережила бы обычный повтор, потому что
 * подписанный адрес живёт дольше страницы.
 *
 * Отклоняется при сетевой ошибке, отказе CORS и ответе не из `2xx`.
 */
export function loadIcon(url: string, fresh: boolean, fetcher: typeof fetch = fetch): Promise<string> {
    const known = pending.get(url);

    if (known !== undefined && !fresh) {
        return known;
    }

    const loading = request(url, fresh, fetcher);

    pending.set(url, loading);
    loading.catch(() => {
        if (pending.get(url) === loading) {
            pending.delete(url);
        }
    });

    return loading;
}

async function request(url: string, fresh: boolean, fetcher: typeof fetch): Promise<string> {
    const response = await fetcher(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: fresh ? 'reload' : 'default',
    });

    if (!response.ok) {
        throw new Error(`icon status ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const declared = response.headers.get('Content-Type')?.split(';')[0].trim() ?? '';
    const type = declared.startsWith('image/') ? declared : FALLBACK_TYPE;

    return `data:${type};base64,${base64(bytes)}`;
}

/**
 * Байты строкой base64.
 *
 * Кусками, а не одним `fromCharCode(...bytes)`: разворот массива в аргументы
 * упирается в предел числа аргументов на крупном файле.
 */
function base64(bytes: Uint8Array): string {
    const CHUNK = 0x8000;
    let binary = '';

    for (let offset = 0; offset < bytes.length; offset += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
    }

    return btoa(binary);
}
