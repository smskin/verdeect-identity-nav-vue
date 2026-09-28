import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

/**
 * Сборка входа `./element` — единственного собираемого входа пакета.
 *
 * Конфигурация названа по входу, а не `vite.config.ts`, намеренно: общей
 * сборки у пакета нет, и файл с умолчательным именем читался бы как
 * приглашение собирать остальные входы.
 *
 * - **Внешних зависимостей нет.** Vue уходит в бандл: потребителю не на Vue
 *   ставить его нечем и незачем.
 * - **`process.env.NODE_ENV` подставляется значением.** Иначе ветки
 *   разработки Vue остались бы в бандле, а обращение к `process` уронило бы
 *   элемент в браузере, где такого объекта нет.
 * - **Режим пользовательского элемента** у `@vitejs/plugin-vue` включается
 *   для `*.ce.vue` по умолчанию: стили такого файла становятся строкой
 *   и попадают в теневой корень, а не в отдельный `.css`.
 */
export default defineConfig({
    plugins: [vue()],
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
    publicDir: false,
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        lib: {
            entry: 'src/element/index.ts',
            formats: ['es'],
            fileName: () => 'element.js',
        },
    },
});
