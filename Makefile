# Basic Makefile

UUID = cast-to-tv-links-addon@rafostar.github.com
GETTEXT = cast-to-tv-links-addon
PACKAGE = "Cast to TV - Links Addon"
TOLOCALIZE = app.js widget.js links_prefs.js
ZIPFILES = *.js *.json *.css node_scripts schemas LICENSE README.md
INSTALLPATH = ~/.local/share/gnome-shell/extensions
POTPATH = $(INSTALLPATH)/cast-to-tv@rafostar.github.com/po/$(GETTEXT)
POTFILE = cast-to-tv-links-addon.pot

# Compile schemas #
glib-schemas:
	glib-compile-schemas ./schemas/

# Create/update potfile #
potfile:
	mkdir -p $(POTPATH)
	xgettext -o $(POTPATH)/$(POTFILE) --language=JavaScript --add-comments=TRANSLATORS: --package-name $(PACKAGE) $(TOLOCALIZE)

# Create release zip #
zip-file: _build
	zip -qr $(UUID).zip $(ZIPFILES)

# Build and install #
install: zip-file
	mkdir -p $(INSTALLPATH)/$(UUID)
	unzip -qo $(UUID).zip -d $(INSTALLPATH)/$(UUID)

_build: glib-schemas

