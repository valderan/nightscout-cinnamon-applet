# Nightscout Cinnamon Applet

[English version](README.md)

Апплет для рабочего стола Cinnamon, отображающий данные об уровне глюкозы в крови с вашего сервера [Nightscout](http://www.nightscout.info/) прямо на панели.

## Возможности

- Отображение уровня глюкозы в реальном времени со стрелками тренда
- Поддержка единиц измерения ммоль/л и мг/дл
- Заряд батареи телефона-загрузчика в подсказке
- Предупреждение о пропущенных показаниях
- Многоязычная поддержка (русский, английский, испанский, французский и др.)

> **Примечание:** Этот форк упрощён для конфигураций только с CGM. Поддержка инсулиновой помпы (IOB, резервуар, батарея помпы) удалена. Отображаются только показания глюкозы и заряд батареи телефона-загрузчика.

## Требования

- **Nightscout** версии 14.0 или выше (протестировано на 15.0.2)
- Рабочий стол **Cinnamon** (Linux Mint и др.)
- Пакет **gettext** (для компиляции переводов)

## Быстрая установка (одной командой)

```bash
git clone https://github.com/valderan/nightscout-cinnamon-applet.git ~/.local/share/cinnamon/applets/nightscout@ranneft && cd ~/.local/share/cinnamon/applets/nightscout@ranneft && ./install.sh
```

## Ручная установка

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/valderan/nightscout-cinnamon-applet.git
   ```

2. Скопируйте в директорию апплетов Cinnamon:
   ```bash
   cp -r nightscout-cinnamon-applet ~/.local/share/cinnamon/applets/nightscout@ranneft
   ```

3. Запустите скрипт установки для компиляции переводов:
   ```bash
   cd ~/.local/share/cinnamon/applets/nightscout@ranneft
   ./install.sh
   ```

4. Перезапустите Cinnamon:
   - Нажмите `Alt+F2`, введите `r`, нажмите `Enter`
   - Или выйдите из системы и войдите снова

5. Добавьте апплет на панель:
   - Правый клик на панели → "Апплеты" → Найдите "Nightscout" → Добавить на панель

## Настройка

Правый клик на апплете → "Настроить":

| Параметр | Описание |
|----------|----------|
| **Сервер Nightscout** | URL вашего Nightscout (например, `https://your-site.herokuapp.com`) |
| **API-токен** | Токен доступа к Nightscout (например, `readable-xxxxxxxxxxxx`) |
| **Интервал обновления** | Как часто обновлять данные (1-10 минут) |
| **Использовать ммоль/л** | Переключение между ммоль/л и мг/дл |
| **Показывать пропуски** | Предупреждение, когда данные устарели |

## История изменений

### v0.2.0 (Форк от Valderan)
- Исправлена совместимость с Nightscout API v14+/v15+
- Добавлена аутентификация через заголовок `api-secret`
- Упрощено отображение статуса устройства (убраны поля помпы)
- Добавлена русская локализация
- Добавлен скрипт установки для переводов
- Очистка и улучшение кода

### v0.1.0 (Оригинал от ImmRanneft)
- Первоначальный релиз

## Авторы

- **Оригинальный автор:** [ImmRanneft](https://github.com/linuxmint/cinnamon-spices-applets/tree/master/nightscout%40ranneft)
- **Автор форка:** [Valderan](https://github.com/valderan)
- Основано на [Cinnamon Spices Applets](https://github.com/linuxmint/cinnamon-spices-applets)

## Лицензия

Проект распространяется под той же лицензией, что и оригинальный апплет Cinnamon Spices.

## Решение проблем

### Апплет показывает "Loading..." или нет данных
1. Проверьте URL вашего Nightscout (включая `https://`)
2. Убедитесь, что ваш API-токен имеет права на чтение
3. Проверьте логи: `tail -f ~/.xsession-errors | grep nightscout`

### Переводы не работают
Запустите скрипт установки снова:
```bash
cd ~/.local/share/cinnamon/applets/nightscout@ranneft && ./install.sh
```
