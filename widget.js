const { GLib } = imports.gi;
const PopupMenu = imports.ui.popupMenu;
const Local = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Local.metadata['gettext-domain']);
const _ = Gettext.gettext;

const EXTENSIONS_PATH = Local.path.substring(0, Local.path.lastIndexOf('/'));
const MAIN_PATH = EXTENSIONS_PATH + '/cast-to-tv@rafostar.github.com';

var addonMenuItem = class linkMenu extends PopupMenu.PopupImageMenuItem
{
	constructor()
	{
		super(_("Link"), 'web-browser-symbolic');
		this.linkSignal = this.connect('activate', () =>
		{
			/* Close other possible opened extension windows */
			GLib.spawn_command_line_async('pkill -SIGINT -f ' + MAIN_PATH + '/file-chooser|' +
				EXTENSIONS_PATH + '/cast-to-tv-.*-addon@rafostar.github.com/app');

			/* To not freeze gnome shell app needs to be run as separate process */
			GLib.spawn_async(Local.path, ['/usr/bin/gjs', Local.path + '/app.js'], null, 0, null);
		});

		this.destroy = () =>
		{
			this.disconnect(this.linkSignal);
			super.destroy();
		}
	}
}
