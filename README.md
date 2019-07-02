# Cast to TV Links Add-on
[![License](https://img.shields.io/github/license/Rafostar/cast-to-tv-links-addon.svg)](https://github.com/Rafostar/cast-to-tv-links-addon/blob/master/COPYING)
[![Crowdin](https://d322cqt584bo4o.cloudfront.net/cast-to-tv/localized.svg)](https://crowdin.com/project/cast-to-tv)
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=TFVDFD88KQ322)
[![Donate](https://img.shields.io/badge/Donate-PayPal.Me-lightgrey.svg)](https://www.paypal.me/Rafostar)

Web links casting support for GNOME Shell Extension Cast to TV.

<p align="center">
<img src="https://raw.githubusercontent.com/wiki/Rafostar/gnome-shell-extension-cast-to-tv/images/Add-ons/Links.png" width="65%" height="65%">
</p>

## Features
* Cast videos, music and pictures from internet
* All [youtube-dl compatible sites](https://ytdl-org.github.io/youtube-dl/supportedsites.html) are supported
* Constant video quality throughout playback
* No commercials
* Supports captions
* Allows disabling VP9 codec
* Tries to pick up videos that do not exceed configured fps, otherwise transcodes them to 30 fps on the fly
* Does not require Chrome/Chromium browser

## Requirements
* [Cast to TV](https://github.com/Rafostar/gnome-shell-extension-cast-to-tv) (version 9 or later)
* [youtube-dl](https://ytdl-org.github.io/youtube-dl/index.html)

Always use the newest possible youtube-dl version.

## Installation
```
cd /tmp
git clone https://github.com/Rafostar/cast-to-tv-links-addon.git
cd cast-to-tv-links-addon
make install
```
After installing restart gnome-shell and enable the newly added extension.

**Before using this Add-on** you also **must** install some additional npm packages.<br>
Go to `Cast Settings -> Modules` and click `Install npm modules` button.<br>
This step will install additional packages and automatically restart Cast to TV server.

## How to use
Launch app from newly added `Link` menu entry in `Cast media` submenu.<br>
Simply write/paste link to the website containing the requested media content and click `Cast link` button or achieve the same effect even simpler by dragging link into the text field.

## Configuration
Add-ons can be configured from within Cast to TV extension preferences (Cast Settings in drop down menu).<br>
After installing a new "Add-ons" tab will be added to the extension settings.

Some of the options that might need explaining are:
* Preferred format
  * Best seekable - tries to pick up videos with formats that will allow seeking using top bar remote. In this mode youtube-dl is only used to abtain direct link to video and files are not downloaded locally.
  * Best quality - selects videos with best possible quality (not always seekable) and if necessary downloads and merges or transcodes them locally (on the fly) while sending output directly to the receiver.

* Preferred and fallback subtitles languages - first and second best choice when selecting video captions (if preferred lang. is not available for a particular video, fallback lang. is used). Fill those fields with two letters language codes (codes table can be found in [wikipedia](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)). If you do not want video captions, then fill those fields with words not representing any of the lang. codes (e.g: none).

## Info for translators
All translatable files are in the main extension.<br>
Preferred translation method is to use [Cast to TV Crowdin](https://crowdin.com/project/cast-to-tv) web page.

## Donation
If you like my work please support it by buying me a cup of coffee :grin:

[![PayPal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=TFVDFD88KQ322)
