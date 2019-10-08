const { GLib } = imports.gi;
const PopupMenu = imports.ui.popupMenu;
const Local = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Local.metadata['gettext-domain']);
const _ = Gettext.gettext;

const EXTENSIONS_PATH = Local.path.substring(0, Local.path.lastIndexOf('/'));
const MAIN_PATH = EXTENSIONS_PATH + '/cast-to-tv@rafostar.github.com';

/* Imports from main extension */
imports.searchPath.unshift(MAIN_PATH);
const Helper = imports.helper;
imports.searchPath.shift();

var addonMenuItem = class linkMenu extends PopupMenu.PopupImageMenuItem
{
	constructor()
	{
		super(_("Link"), 'web-browser-symbolic');
		this.connect('activate', () =>
		{
			Helper.closeOtherApps(MAIN_PATH, EXTENSIONS_PATH);
			Helper.startApp(Local.path);
		});
	}
}
