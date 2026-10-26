# ENG-101 · учебные исходники

Полный пакет из 16 занятий находится в `../../authored/ENG-101.json` и подключён к сборке Академии. `01-environment.md` сохраняет исходный текст первого занятия; версия для приложения и ссылка на starter находятся в авторском JSON. Папка `starter/` содержит исполняемый пример и восемь исходных тестов. Эталон расширения со сбором и пять дополнительных проверок находятся в `../../authored/ENG-101-reference/`.

Запуск из корня репозитория:

```bash
node --test content/ai-academy/drafts/ENG-101/starter/quote.test.mjs content/ai-academy/authored/ENG-101-reference/fee.test.mjs
```

Архив для студента: `public/learning/academy/eng-starter.zip`. Он содержит исходную задачу без эталонного решения расширения.
