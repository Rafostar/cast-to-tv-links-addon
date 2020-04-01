const PopupMenu = imports.ui.popupMenu;
const Local = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Local.metadata['gettext-domain']);
const _ = Gettext.gettext;

var AddonMenuItem = class linkMenu extends PopupMenu.PopupImageMenuItem
{
	constructor()
	{
		super(_("Link"), 'web-browser-symbolic');
		this.hasExtApp = true;
	}
}
