# Basic Makefile

UUID = cast-to-tv-links-addon@rafostar.github.com
GETTEXT = cast-to-tv-links-addon
PACKAGE = "Cast to TV - Links Addon"
TOLOCALIZE = app.js widget.js links_prefs.js
POTFILE = ./po/cast-to-tv-links-addon.pot
ZIPFILES = *.js *.json *.css node_scripts schemas LICENSE README.md
INSTALLPATH = ~/.local/share/gnome-shell/extensions

# Compile schemas #
glib-schemas:
	glib-compile-schemas ./schemas/

# Create/update potfile #
potfile:
	mkdir -p po
	xgettext -o $(POTFILE) --language=JavaScript --add-comments=TRANSLATORS: --package-name $(PACKAGE) $(TOLOCALIZE)

# Create release zip #
zip-file: _build
	zip -qr $(UUID).zip $(ZIPFILES)

# Build and install #
install: zip-file
	mkdir -p $(INSTALLPATH)
	mkdir -p $(INSTALLPATH)/$(UUID)
	unzip -qo $(UUID).zip -d $(INSTALLPATH)/$(UUID)

_build: glib-schemas

