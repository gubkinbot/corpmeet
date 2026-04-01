# Frontend — Основной сайт

## Зона ответственности
Веб-интерфейс бронирования переговорных комнат. Доступен на https://corpmeet.uz

## Стек
- React 18, Vite
- Функциональные компоненты + хуки

## Структура
```
frontend/
├── index.html
├── src/
│   ├── main.jsx       # Точка входа
│   └── App.jsx        # Корневой компонент
```

## Правила
- Только функциональные компоненты (без классов)
- Состояние: useState/useReducer, при усложнении — Context API
- API-запросы через fetch к `/api/` (проксируется nginx на backend)
- Компоненты — PascalCase (Button.jsx, RoomCard.jsx)
- Один компонент — один файл
- Не тащить тяжёлые библиотеки без необходимости

## Запуск локально
```bash
cd frontend
npm install
npm run dev
```

## Сборка
```bash
npm run build  # → dist/
```
Dockerfile собирает через multi-stage: node → nginx (статика).
