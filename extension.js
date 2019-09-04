/*
Cast to TV - Links Add-on
Developer: Rafostar
Extension GitHub: https://github.com/Rafostar/cast-to-tv-links-addon
*/
const Local = imports.misc.extensionUtils.getCurrentExtension();
const extensionsPath = Local.path.substring(0, Local.path.lastIndexOf('/'));
const mainPath = extensionsPath + '/cast-to-tv@rafostar.github.com';

/* Imports from main extension */
imports.searchPath.unshift(mainPath);
const Widget = Local.imports.widget;
const Addons = imports.addons;
const Helper = imports.helper;
imports.searchPath.shift();

const GETTEXT_DOMAIN = Local.metadata['gettext-domain'];
const EXTENSION_ID = Local.metadata['extension-id'];
const DELAY = 1500;

function init()
{
	Helper.initTranslations(Local.path, GETTEXT_DOMAIN);
}

function enable()
{
	Addons.enableAddon(EXTENSION_ID, Widget, DELAY);
}

function disable()
{
	Addons.disableAddon(EXTENSION_ID);
}
