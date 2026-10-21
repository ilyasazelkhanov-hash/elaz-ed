import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    // Мастер и ролики — отдельные проекты со своими node_modules; их правки не должны перезапускать OG.
    watch: { ignored: ['**/Azelkhanov-master/**', '**/videos/**', '**/test-results/**'] },
  },
  // Только свой вход: иначе Vite находит index.html мастера и подмешивает вторую копию React.
  optimizeDeps: { entries: ['index.html'] },
  build: {
    // Граф импортов нужен для сравнения реальной загрузки входов и ленивых экранов.
    manifest: true,
    rolldownOptions: {
      output: {
        // Библиотеки лежат отдельно от кода приложения: после очередной выкладки телефон докачивает только изменившийся файл.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/ },
          ],
        },
      },
    },
  },
})
