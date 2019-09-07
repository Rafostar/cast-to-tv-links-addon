imports.gi.versions.Gtk = '3.0';
imports.gi.versions.Gdk = '3.0';

const { Gio, Gtk, Gdk, GLib, Pango, GdkPixbuf } = imports.gi;
const ByteArray = imports.byteArray;
const Gettext = imports.gettext;

const LOCAL_PATH = GLib.get_current_dir();
const EXTENSIONS_PATH = LOCAL_PATH.substring(0, LOCAL_PATH.lastIndexOf('/'));
const MAIN_PATH = EXTENSIONS_PATH + '/cast-to-tv@rafostar.github.com';

/* Imports from main extension */
imports.searchPath.unshift(MAIN_PATH);
const Helper = imports.helper;
const shared = imports.shared.module.exports;
imports.searchPath.shift();

const METADATA_DOMAIN = 'cast-to-tv-links-addon';
const TEMP_DIR = shared.tempDir + '/links-addon';
const ENCODE_FORMATS = readFromFile(LOCAL_PATH + '/encode-formats.json');
const NODE_PATH = (GLib.find_program_in_path('nodejs') || GLib.find_program_in_path('node'));

const GettextDomain = Gettext.domain(METADATA_DOMAIN);
const _ = GettextDomain.gettext;
Helper.initTranslations(LOCAL_PATH, 'cast-to-tv-links-addon');

class linkEntry
{
	constructor()
	{
		this.title = 'Cast to TV';
		this.imagePath = TEMP_DIR + '/image';
		GLib.set_prgname(this.title);
		this.application = new Gtk.Application();
		this.application.connect('activate', () => this._onActivate());
		this.application.connect('startup', () => this._buildUI());
		this.application.run([]);
	}

	_onActivate()
	{
		if(this.castButton) this.castButton.grab_focus();
		if(this.window) this.window.show_all();
	}

	_buildUI()
	{
		let geoHints = new Gdk.Geometry({ min_height: 0, max_height: 0, min_width: 620, max_width: 620 });

		this.window = new Gtk.ApplicationWindow({
			application: this.application,
			title: this.title,
			border_width: 12,
			resizable: true,
			window_position: Gtk.WindowPosition.CENTER
		});
		this.window.set_geometry_hints(null, geoHints, (Gdk.WindowHints.MIN_SIZE | Gdk.WindowHints.MAX_SIZE));

		let iconTheme = Gtk.IconTheme.get_default();
		if(iconTheme.has_icon('cast-to-tv')) this.window.set_icon_name('cast-to-tv');
		else {
			try { this.window.set_icon_from_file(mainExtPath + '/appIcon/cast-to-tv.svg'); }
			catch(err) { this.window.set_icon_name('application-x-executable'); }
		}

		this.provider = new Gtk.CssProvider();
		this.provider.load_from_path(LOCAL_PATH + '/style.css');

		this.window.add(this._getBody());
	}

	_getBody()
	{
		let body = new Gtk.VBox();

		this.castBox = this._makeCastBox();
		this.castInfo = this._makeInfoBox();

		this.progressSpinner = new Gtk.Spinner({
			width_request: 64,
			height_request: 64,
			valign: Gtk.Align.CENTER
		});

		let spinnerStyle = this.progressSpinner.get_style_context();
		spinnerStyle.add_provider(this.provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
		spinnerStyle.add_class('white-color');

		body.pack_start(this.castBox, false, false, 0);
		body.pack_start(this.castInfo, false, false, 0);

		return body;
	}

	_addInfoItem(text, destBox)
	{
		let hbox = new Gtk.HBox();
		let label = new Gtk.Label({
			label: text,
			expand: false,
			halign: Gtk.Align.START
		});
		let infoLabel = new Gtk.Label({
			label: "-",
			use_markup: true,
			expand: false,
			halign: Gtk.Align.START,
			margin_left: 4
		});
		infoLabel.set_ellipsize(Pango.EllipsizeMode.END);
		hbox.pack_start(label, false, false, 0);
		hbox.pack_start(infoLabel, false, false, 0);
		destBox.pack_start(hbox, false, false, 0);

		return infoLabel;
	}

	_makeInfoBox()
	{
		let vbox = new Gtk.VBox({ spacing: 6, valign: Gtk.Align.CENTER });

		/* Thumbnail Frame */
		this.frame = new Gtk.Frame({
			width_request: 242,
			height_request: 182
		});

		let frameStyle = this.frame.get_style_context();
		frameStyle.add_provider(this.provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
		frameStyle.add_class('black-background');

		/* No Image Label */
		this.noImageLabel = new Gtk.Label({
			/* TRANSLATORS: Make sure this text fits the black background. Otherwise the frame will get stretched!!! */
			label: '<span font="24"><b>' + _("No Image") + '</b></span>',
			use_markup: true,
			expand: false,
			halign: Gtk.Align.CENTER
		});
		let labelStyle = this.noImageLabel.get_style_context();
		labelStyle.add_provider(this.provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
		labelStyle.add_class('white-color');
		this.thumbnail = this.noImageLabel;
		this.frame.add(this.thumbnail);

		this.infoItems = [
			this._addInfoItem(_("Title:"), vbox),
			this._addInfoItem(_("Format:"), vbox),
			this._addInfoItem(_("Resolution:"), vbox),
			this._addInfoItem(_("Video codec:"), vbox),
			this._addInfoItem(_("Audio codec:"), vbox),
			this._addInfoItem(_("Subtitles:"), vbox)
		];

		/* Pack widgets in box */
		let hbox = new Gtk.HBox({ spacing: 10, valign: Gtk.Align.CENTER });
		hbox.pack_start(this.frame, false, false, 0);
		hbox.pack_start(vbox, false, false, 0);

		return hbox;
	}

	_makeCastBox()
	{
		let box = new Gtk.HBox({ spacing: 6, margin_bottom: 10 });

		this.linkEntry = new Gtk.Entry({ width_request: 220, height_request: 36, expand: true });
		this.linkEntry.set_placeholder_text(_("Enter or drop link here"));
		this.linkEntry.connect('drag_data_received', (widget, context, x, y, selData) =>
		{
			this.linkEntry.set_text("");
			if(this.castButton.get_sensitive())
				this._getInfo(selData.get_text());
		});

		this.castButton = new Gtk.Button({
			label: _("Cast link"),
			expand: false,
			halign: Gtk.Align.END
		});

		this.linkEntry.connect('activate', () =>
		{
			if(this.castButton.get_sensitive())
				this.castButton.clicked();
		});

		this.castButton.connect('clicked', () => this._getInfo());

		box.pack_start(this.linkEntry, true, true, 0);
		box.pack_start(this.castButton, false, false, 0);

		return box;
	}

	_getInfo(link)
	{
		let completeOutput = "";
		this.castButton.set_sensitive(false);

		this._restoreInfoDefaults();
		this.frame.remove(this.thumbnail);
		this.frame.add(this.progressSpinner);
		this.progressSpinner.start();

		this.castInfo.show_all();

		if(!link) link = this.linkEntry.text;

		let [res, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
			'/usr/bin', [NODE_PATH, LOCAL_PATH + '/node_scripts/utils/link-parser', link],
			null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);

		let stream = new Gio.DataInputStream({ base_stream: new Gio.UnixInputStream({ fd: stdout }) });

		GLib.child_watch_add(GLib.PRIORITY_LOW, pid, () =>
		{
			try {
				var info = JSON.parse(completeOutput);
				this._fillInfo(info);
				this._setTempFiles(info);
			}
			catch(err) {
				this._fillInfo({});
			}

			this.castButton.set_sensitive(true);
		});

		readOutputAsync(stream, (out) =>
		{
			completeOutput += out;
		});
	}

	_restoreInfoDefaults()
	{
		this.infoItems.forEach(item => item.label = '-');
	}

	_fillInfo(mediaInfo)
	{
		let mediaLabels = [
			mediaInfo.title,
			mediaInfo.container,
			mediaInfo.resolution,
			mediaInfo.vcodec,
			mediaInfo.acodec,
			mediaInfo.subtitles
		];

		for(var i = 0; i < this.infoItems.length; i++)
		{
			if(mediaLabels[i])
			{
				let text = (i === 0) ? mediaLabels[i].replace(/&/g, '&amp;') : mediaLabels[i];
				if(text.lang) text = text.lang;
				this.infoItems[i].label = '<b>' + text + '</b>';
			}
		}

		if(mediaInfo.thumbnail)
		{
			try {
				let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(this.imagePath, 240, 180, true);
				this.thumbnail = Gtk.Image.new_from_pixbuf(pixbuf);
			}
			catch(err) {
				this.thumbnail = this.noImageLabel;
			}
		}
		else
		{
			this.thumbnail = this.noImageLabel;
		}

		this.progressSpinner.stop();
		this.frame.remove(this.progressSpinner);
		this.frame.add(this.thumbnail);

		this.castInfo.show_all();
	}

	_getSelection(mediaInfo)
	{
		var selection = {
			addon: 'LINKS',
			title: mediaInfo.title,
			filePath: mediaInfo.title,
			coverSrc: this.imagePath,
			height: mediaInfo.height,
			fps: mediaInfo.fps
		};

		if(mediaInfo.url)
		{
			selection.mediaSrc = mediaInfo.url;
		}
		else if(mediaInfo.videoUrl)
		{
			selection.videoSrc = mediaInfo.videoUrl;

			if(mediaInfo.audioUrl)
			{
				selection.audioSrc = mediaInfo.audioUrl;
				selection.streamType = 'VIDEO_ENCODE';

				return selection;
			}
		}

		if(mediaInfo.protocol)
		{
			selection.protocol = mediaInfo.protocol;
			if(ENCODE_FORMATS && ENCODE_FORMATS.includes(selection.protocol))
			{
				selection.streamType = 'VIDEO_ENCODE';
				return selection;
			}
		}

		if(mediaInfo.container)
		{
			if(this._isMusic(mediaInfo)) selection.streamType = 'MUSIC';
			else if(this._isPicture(mediaInfo)) selection.streamType = 'PICTURE';
			else selection.streamType = 'VIDEO';

			return selection;
		}

		return null;
	}

	_isMusic(mediaInfo)
	{
		var isMusic = (
			mediaInfo.container == 'aac'
			|| mediaInfo.container == 'mp3'
			|| mediaInfo.container == 'm4a'
			|| mediaInfo.container == 'vorbis'
			|| mediaInfo.container == 'wav'
			|| mediaInfo.container == 'opus'
			|| mediaInfo.container == 'flac'
		);

		return isMusic;
	}

	_isPicture(mediaInfo)
	{
		var isPicture = (
			mediaInfo.container == 'bmp'
			|| mediaInfo.container == 'gif'
			|| mediaInfo.container == 'jpeg'
			|| mediaInfo.container == 'jpg'
			|| mediaInfo.container == 'png'
			|| mediaInfo.container == 'webp'
		);

		return isPicture;
	}

	_setTempFiles(mediaInfo)
	{
		var selection = null;
		var playlist = null;

		if(mediaInfo.url || mediaInfo.videoUrl)
		{
			selection = this._getSelection(mediaInfo);
			playlist = [mediaInfo.title];
		}

		if(selection && playlist)
		{
			if(mediaInfo.subtitles) selection.subsSrc = mediaInfo.subtitles.url;

			/* Set playback list */
			GLib.file_set_contents(shared.listPath, JSON.stringify(playlist, null, 1));

			/* Save selection to file */
			GLib.file_set_contents(shared.selectionPath, JSON.stringify(selection, null, 1));
		}
	}
}

function readFromFile(path)
{
	/* Check if file exists (EXISTS = 16) */
	let fileExists = GLib.file_test(path, 16);
	if(fileExists)
	{
		let [readOk, readFile] = GLib.file_get_contents(path);
		if(readOk)
		{
			let data;

			if(readFile instanceof Uint8Array)
			{
				try { data = JSON.parse(ByteArray.toString(readFile)); }
				catch(err) { data = null; }
			}
			else
			{
				try { data = JSON.parse(readFile); }
				catch(err) { data = null; }
			}

			return data;
		}
	}

	return null;
}

function readOutputAsync(stream, callback)
{
	stream.read_line_async(GLib.PRIORITY_LOW, null, (source, res) =>
	{
		let out_fd, length, outStr;

		[out_fd, length] = source.read_line_finish(res);

		if(out_fd !== null)
		{
			if(out_fd instanceof Uint8Array) outStr = ByteArray.toString(out_fd);
			else outStr = out_fd.toString();

			callback(outStr);
			readOutputAsync(source, callback);
		}
	});
}

GLib.mkdir_with_parents(TEMP_DIR, 448); // 700 in octal
let app = new linkEntry();
