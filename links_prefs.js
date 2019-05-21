const { Gio, Gtk } = imports.gi;
const Local = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext;
const extensionsPath = Local.path.substring(0, Local.path.lastIndexOf('/'));
const mainPath = extensionsPath + '/cast-to-tv@rafostar.github.com';
const localePath = mainPath + '/locale_addons/cast-to-tv-links-addon';
const GettextDomain = Gettext.domain(Local.metadata['gettext-domain']);
const _ = GettextDomain.gettext;
const Settings = getSettings();

function init()
{
	Gettext.bindtextdomain(Local.metadata['gettext-domain'], localePath);
}

function getSettings()
{
	const GioSSS = Gio.SettingsSchemaSource;
	let schemaSource = GioSSS.new_from_directory(
		Local.path + '/schemas', GioSSS.get_default(), false);
	let schemaObj = schemaSource.lookup(Local.metadata['settings-schema'], true);

	return new Gio.Settings({ settings_schema: schemaObj });
}

class settingLabel
{
	constructor(text, isTitle, isTopMargin)
	{
		let label = null;
		let marginLeft = 0;
		let marginTop = 0;

		if(isTitle) label = '<span font="12.5"><b>' + text + '</b></span>';
		else
		{
			label = text;
			marginLeft = 12;
		}

		if(isTopMargin) marginTop = 20;

		return new Gtk.Label({
			label: label,
			use_markup: true,
			hexpand: true,
			halign: Gtk.Align.START,
			margin_top: marginTop,
			margin_left: marginLeft
		});
	}
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
		label = new settingLabel(_("Links Options"), true);
		this.attach(label, 0, 0, 1, 1);

		/* Preferred youtube-dl Format */
		label = new settingLabel(_("Preferred format"));
		widget = new Gtk.ComboBoxText({ width_request: 220, halign: Gtk.Align.END });
		widget.append('combined', _("Best seekable"));
		widget.append('separate', _("Best quality"));
		Settings.bind('ytdl-mode', widget, 'active-id', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 1, 1, 1);
		this.attach(widget, 1, 1, 1, 1);

		/* youtube-dl Path */
		label = new settingLabel(_("Path to youtube-dl"));
		widget = new Gtk.Entry({ width_request: 220, halign:Gtk.Align.END });
		widget.set_placeholder_text("/usr/bin/youtube-dl");
		Settings.bind('ytdl-path', widget, 'text', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 2, 1, 1);
		this.attach(widget, 1, 2, 1, 1);

		/* Max Video Quality */
		/* TRANSLATORS: Can be translated simply as "Max quality" to make it shorter */
		label = new settingLabel(_("Max video quality"));
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
		label = new settingLabel(_("Allow VP9 codec"));
		widget = new Gtk.Switch({ halign:Gtk.Align.END });
		widget.set_active(Settings.get_boolean('allow-vp9'));
		Settings.bind('allow-vp9', widget, 'active', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 4, 1, 1);
		this.attach(widget, 1, 4, 1, 1);

		/* Label: Subtitles */
		label = new settingLabel(_("Subtitles"), true, true);
		this.attach(label, 0, 5, 1, 1);

		/* Preferred Lang */
		label = new settingLabel(_("Preferred language"));
		widget = new Gtk.Entry({ halign:Gtk.Align.END });
		widget.set_placeholder_text("en");
		Settings.bind('preferred-lang', widget, 'text', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 6, 1, 1);
		this.attach(widget, 1, 6, 1, 1);

		/* Fallback Lang */
		label = new settingLabel(_("Fallback language"));
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
