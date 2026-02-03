#!/bin/bash
#
# Nightscout Applet Installation Script
# Compiles translations and installs the applet
#

APPLET_UUID="nightscout@ranneft"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPLET_DIR="$HOME/.local/share/cinnamon/applets/$APPLET_UUID"
LOCALE_DIR="$HOME/.local/share/locale"

echo "=== Nightscout Applet Installer ==="
echo ""

# Check if msgfmt is available
if ! command -v msgfmt &> /dev/null; then
    echo "Error: msgfmt not found. Install gettext package:"
    echo "  sudo apt install gettext"
    exit 1
fi

# Copy applet files if running from different location
if [ "$SCRIPT_DIR" != "$APPLET_DIR" ]; then
    echo "Copying applet to $APPLET_DIR..."
    mkdir -p "$APPLET_DIR"
    cp -r "$SCRIPT_DIR"/* "$APPLET_DIR/"
    echo "Done."
    echo ""
fi

# Compile translations
echo "Compiling translations..."
for po_file in "$APPLET_DIR"/po/*.po; do
    if [ -f "$po_file" ]; then
        lang=$(basename "$po_file" .po)
        mkdir -p "$LOCALE_DIR/$lang/LC_MESSAGES"
        msgfmt -o "$LOCALE_DIR/$lang/LC_MESSAGES/$APPLET_UUID.mo" "$po_file"
        echo "  $lang: OK"
    fi
done
echo ""

echo "=== Installation complete ==="
echo ""
echo "Restart Cinnamon to apply changes:"
echo "  Press Alt+F2, type 'r', press Enter"
echo ""
echo "Or log out and log back in."
