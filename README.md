# Nightscout Cinnamon Applet

[Русская версия](README_ru.md)

A Cinnamon desktop applet that displays blood glucose data from your [Nightscout](http://www.nightscout.info/) server directly on the panel.

## Features

- Real-time blood glucose display with trend arrows
- Support for mmol/L and mg/dL units
- Device battery status in tooltip
- Missing readings alert
- Multi-language support (English, Russian, Spanish, French, and more)

## Requirements

- **Nightscout** version 14.0 or higher (tested on 15.0.2)
- **Cinnamon** desktop environment (Linux Mint, etc.)
- **gettext** package (for translation compilation)

## Quick Install (One-liner)

```bash
git clone https://github.com/valderan/nightscout-cinnamon-applet.git ~/.local/share/cinnamon/applets/nightscout@ranneft && cd ~/.local/share/cinnamon/applets/nightscout@ranneft && ./install.sh
```

## Manual Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/valderan/nightscout-cinnamon-applet.git
   ```

2. Copy to Cinnamon applets directory:
   ```bash
   cp -r nightscout-cinnamon-applet ~/.local/share/cinnamon/applets/nightscout@ranneft
   ```

3. Run the installation script to compile translations:
   ```bash
   cd ~/.local/share/cinnamon/applets/nightscout@ranneft
   ./install.sh
   ```

4. Restart Cinnamon:
   - Press `Alt+F2`, type `r`, press `Enter`
   - Or log out and log back in

5. Add the applet to your panel:
   - Right-click on the panel → "Applets" → Find "Nightscout" → Add to panel

## Configuration

Right-click on the applet → "Configure":

| Setting | Description |
|---------|-------------|
| **Nightscout host** | Your Nightscout URL (e.g., `https://your-site.herokuapp.com`) |
| **API token** | Your Nightscout API token (e.g., `readable-xxxxxxxxxxxx`) |
| **Refresh interval** | How often to update data (1-10 minutes) |
| **Use mmol/L** | Toggle between mmol/L and mg/dL |
| **Show missing readings** | Alert when data is stale |

## Changelog

### v0.2.0 (Fork by Valderan)
- Fixed compatibility with Nightscout API v14+/v15+
- Added API token authentication via `api-secret` header
- Simplified device status display (removed pump-specific fields)
- Added Russian localization
- Added installation script for translations
- Code cleanup and improvements

### v0.1.0 (Original by ImmRanneft)
- Initial release

## Credits

- **Original author:** [ImmRanneft](https://github.com/linuxmint/cinnamon-spices-applets/tree/master/nightscout%40ranneft)
- **Fork maintainer:** [Valderan](https://github.com/valderan)
- Based on [Cinnamon Spices Applets](https://github.com/linuxmint/cinnamon-spices-applets)

## License

This project is released under the same license as the original Cinnamon Spices applet.

## Troubleshooting

### Applet shows "Loading..." or no data
1. Check your Nightscout URL (include `https://`)
2. Verify your API token has read permissions
3. Check logs: `tail -f ~/.xsession-errors | grep nightscout`

### Translations not working
Run the installation script again:
```bash
cd ~/.local/share/cinnamon/applets/nightscout@ranneft && ./install.sh
```
