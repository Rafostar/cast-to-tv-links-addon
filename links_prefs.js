imports.gi.versions.Gtk = '3.0';

const { Gio, Gtk, GObject } = imports.gi;
const Local = imports.misc.extensionUtils.getCurrentExtension();

const EXTENSIONS_PATH = Local.path.substring(0, Local.path.lastIndexOf('/'));
const LOCAL_PATH = EXTENSIONS_PATH + '/cast-to-tv-links-addon@rafostar.github.com';
const MAIN_PATH = EXTENSIONS_PATH + '/cast-to-tv@rafostar.github.com';

/* Imports from main extension */
imports.searchPath.unshift(MAIN_PATH);
const { SettingLabel, addToGrid } = imports.prefs_shared;
const Helper = imports.helper;
imports.searchPath.shift();

const Metadata = Helper.readFromFile(LOCAL_PATH + '/metadata.json');
const Settings = Helper.getSettings(LOCAL_PATH, Metadata['settings-schema']);
const Gettext = imports.gettext.domain(Metadata['gettext-domain']);
const _ = Gettext.gettext;

function init()
{
	Helper.initTranslations(LOCAL_PATH, Metadata['gettext-domain']);
}

let LinksSettings = GObject.registerClass(
class LinksSettings extends Gtk.Grid
{
	_init()
	{
		super._init({ margin: 20, row_spacing: 6 });
		this.title = new Gtk.Label({ label: _("Links") });
		let label = null;
		let widget = null;

		/* Label: Links Options */
		label = new SettingLabel(_("Links Options"), true);
		addToGrid(this, label, null, true);

		/* Preferred youtube-dl Format */
		label = new SettingLabel(_("Preferred format"));
		widget = new Gtk.ComboBoxText({ width_request: 220, halign: Gtk.Align.END });
		widget.append('combined', _("Best seekable"));
		widget.append('separate', _("Best quality") + ' ' + _("(experimental)"));
		Settings.bind('ytdl-mode', widget, 'active-id', Gio.SettingsBindFlags.DEFAULT);
		addToGrid(this, label, widget);

		/* youtube-dl Path */
		label = new SettingLabel(_("Path to youtube-dl"));
		widget = new Gtk.Entry({ width_request: 220, halign:Gtk.Align.END });
		widget.set_placeholder_text("/usr/bin/youtube-dl");
		Settings.bind('ytdl-path', widget, 'text', Gio.SettingsBindFlags.DEFAULT);
		addToGrid(this, label, widget);

		/* Max Video Quality */
		/* TRANSLATORS: Can be translated simply as "Max quality" to make it shorter */
		label = new SettingLabel(_("Max video quality"));
		let hbox = new Gtk.HBox({ halign: Gtk.Align.END });
		widget = new Gtk.ComboBoxText();
		widget.append('720p', '720p');
		widget.append('1080p', '1080p');
		widget.append('2160p', '2160p');
		Settings.bind('max-quality', widget, 'active-id', Gio.SettingsBindFlags.DEFAULT);
		hbox.pack_start(widget, false, false, 0);

		widget = new Gtk.ComboBoxText({ margin_left: 6 });
		widget.append('30', '30 fps');
		widget.append('60', '60 fps');
		Settings.bind('max-fps', widget, 'active-id', Gio.SettingsBindFlags.DEFAULT);
		hbox.pack_start(widget, false, false, 0);
		addToGrid(this, label, hbox);

		/* Allow VP9 */
		label = new SettingLabel(_("Allow VP9 codec"));
		widget = new Gtk.Switch({ halign:Gtk.Align.END });
		widget.set_active(Settings.get_boolean('allow-vp9'));
		Settings.bind('allow-vp9', widget, 'active', Gio.SettingsBindFlags.DEFAULT);
		addToGrid(this, label, widget);

		/* Label: Subtitles */
		label = new SettingLabel(_("Subtitles"), true, true);
		addToGrid(this, label);

		/* Preferred Lang */
		label = new SettingLabel(_("Preferred language"));
		widget = new Gtk.Entry({ halign:Gtk.Align.END });
		widget.set_placeholder_text("en");
		Settings.bind('preferred-lang', widget, 'text', Gio.SettingsBindFlags.DEFAULT);
		addToGrid(this, label, widget);

		/* Fallback Lang */
		label = new SettingLabel(_("Fallback language"));
		widget = new Gtk.Entry({ halign:Gtk.Align.END });
		widget.set_placeholder_text(_("none"));
		Settings.bind('fallback-lang', widget, 'text', Gio.SettingsBindFlags.DEFAULT);
		addToGrid(this, label, widget);
	}
});

function buildPrefsWidget()
{
	let widget = new LinksSettings();

	widget.show_all();
	return widget;
}
