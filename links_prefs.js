imports.gi.versions.Gtk = '3.0';

const { Gio, Gtk } = imports.gi;
const Local = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Local.metadata['gettext-domain']);

const EXTENSIONS_PATH = Local.path.substring(0, Local.path.lastIndexOf('/'));
const MAIN_PATH = EXTENSIONS_PATH + '/cast-to-tv@rafostar.github.com';
const _ = Gettext.gettext;

/* Imports from main extension */
imports.searchPath.unshift(MAIN_PATH);
const { SettingLabel } = imports.prefs_shared;
const Helper = imports.helper;
const Settings = Helper.getSettings(Local.path, Local.metadata['settings-schema']);
imports.searchPath.shift();

function init()
{
	Helper.initTranslations(Local.path, Local.metadata['gettext-domain']);
}

class LinksSettings extends Gtk.Grid
{
	constructor()
	{
		super({ margin: 20, row_spacing: 6 });
		this.title = new Gtk.Label({ label: _("Links") });
		let label = null;
		let widget = null;

		/* Label: Links Options */
		label = new SettingLabel(_("Links Options"), true);
		this.attach(label, 0, 0, 1, 1);

		/* Preferred youtube-dl Format */
		label = new SettingLabel(_("Preferred format"));
		widget = new Gtk.ComboBoxText({ width_request: 220, halign: Gtk.Align.END });
		widget.append('combined', _("Best seekable"));
		widget.append('separate', _("Best quality") + ' ' + _("(experimental)"));
		Settings.bind('ytdl-mode', widget, 'active-id', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 1, 1, 1);
		this.attach(widget, 1, 1, 1, 1);

		/* youtube-dl Path */
		label = new SettingLabel(_("Path to youtube-dl"));
		widget = new Gtk.Entry({ width_request: 220, halign:Gtk.Align.END });
		widget.set_placeholder_text("/usr/bin/youtube-dl");
		Settings.bind('ytdl-path', widget, 'text', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 2, 1, 1);
		this.attach(widget, 1, 2, 1, 1);

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
		this.attach(label, 0, 3, 1, 1);
		this.attach(hbox, 1, 3, 1, 1);

		/* Allow VP9 */
		label = new SettingLabel(_("Allow VP9 codec"));
		widget = new Gtk.Switch({ halign:Gtk.Align.END });
		widget.set_active(Settings.get_boolean('allow-vp9'));
		Settings.bind('allow-vp9', widget, 'active', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 4, 1, 1);
		this.attach(widget, 1, 4, 1, 1);

		/* Label: Subtitles */
		label = new SettingLabel(_("Subtitles"), true, true);
		this.attach(label, 0, 5, 1, 1);

		/* Preferred Lang */
		label = new SettingLabel(_("Preferred language"));
		widget = new Gtk.Entry({ halign:Gtk.Align.END });
		widget.set_placeholder_text("en");
		Settings.bind('preferred-lang', widget, 'text', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 6, 1, 1);
		this.attach(widget, 1, 6, 1, 1);

		/* Fallback Lang */
		label = new SettingLabel(_("Fallback language"));
		widget = new Gtk.Entry({ halign:Gtk.Align.END });
		widget.set_placeholder_text(_("none"));
		Settings.bind('fallback-lang', widget, 'text', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 7, 1, 1);
		this.attach(widget, 1, 7, 1, 1);
	}

	destroy()
	{
		super.destroy();
	}
}

function buildPrefsWidget()
{
	let widget = new LinksSettings();

	widget.show_all();
	return widget;
}
