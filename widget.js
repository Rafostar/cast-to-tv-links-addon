const { GLib } = imports.gi;
const PopupMenu = imports.ui.popupMenu;
const Local = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Local.metadata['gettext-domain']);
const _ = Gettext.gettext;
const extensionsPath = Local.path.substring(0, Local.path.lastIndexOf('/'));
const mainPath = extensionsPath + '/cast-to-tv@rafostar.github.com';

var addonMenuItem = class linkMenu extends PopupMenu.PopupImageMenuItem
{
	constructor()
	{
		super(_("Link"), 'web-browser-symbolic');
		this.connect('activate', () =>
		{
			/* Close other possible opened windows */
			GLib.spawn_command_line_async('pkill -SIGINT -f ' + mainPath + '/file-chooser|' +
				extensionsPath + '/cast-to-tv-.*-addon@rafostar.github.com/app');

			/* To not freeze gnome shell app needs to be run as separate process */
			GLib.spawn_async('/usr/bin', ['gjs', Local.path + '/app.js'], null, 0, null);
		});
	}

	destroy()
	{
		super.destroy();
	}
}
