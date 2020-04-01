const { GObject } = imports.gi;
const PopupMenu = imports.ui.popupMenu;
const Local = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Local.metadata['gettext-domain']);
const _ = Gettext.gettext;

var AddonMenuItem = GObject.registerClass(
class CastLinkMenuItem extends PopupMenu.PopupImageMenuItem
{
	_init()
	{
		super._init(_("Link"), 'web-browser-symbolic');
		this.hasExtApp = true;
	}
});
