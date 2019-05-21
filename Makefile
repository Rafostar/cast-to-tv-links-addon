# Basic Makefile

UUID = cast-to-tv-links-addon@rafostar.github.com
GETTEXT = cast-to-tv-links-addon
PACKAGE = "Cast to TV - Links Addon"
TOLOCALIZE = app.js widget.js links_prefs.js
MSGSRC = $(wildcard ./po/*.po)
POTFILE = ./po/cast-to-tv-links-addon.pot
ZIPFILES = *.js *.json node_scripts schemas locale LICENSE README.md
INSTALLPATH = ~/.local/share/gnome-shell/extensions

# Compile schemas #
glib-schemas:
	glib-compile-schemas ./schemas/

# Create/update potfile #
potfile:
	mkdir -p po
	xgettext -o $(POTFILE) --language=JavaScript --add-comments=TRANSLATORS: --package-name $(PACKAGE) $(TOLOCALIZE)

# Update '.po' from 'potfile' #
mergepo:
	for i in $(MSGSRC); do \
		msgmerge -U $$i $(POTFILE); \
	done;

# Compile .mo files #
compilemo:
	mkdir -p locale
	for i in $(MSGSRC); do \
		mkdir -p ./locale/`basename $$i .po`; \
		mkdir -p ./locale/`basename $$i .po`/LC_MESSAGES; \
		msgfmt -c -o ./locale/`basename $$i .po`/LC_MESSAGES/$(GETTEXT).mo $$i; \
	done;

# Create release zip #
zip-file: _build
	zip -qr $(UUID).zip $(ZIPFILES)

# Build and install #
install: zip-file
	mkdir -p $(INSTALLPATH)
	mkdir -p $(INSTALLPATH)/$(UUID)
	unzip -qo $(UUID).zip -d $(INSTALLPATH)/$(UUID)

_build: glib-schemas potfile mergepo compilemo

