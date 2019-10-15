var fs = require('fs');
var path = require('path');
var debug = require('debug');
var parser_debug = debug('parser');
var ytdl_debug = debug('ytdl');
var JSONStream = require('JSONStream');
var request = require('request');
var { spawn } = require('child_process');

/* Cast to TV imports */
const MAIN_EXT_PATH = path.join(__dirname + '/../../../cast-to-tv@rafostar.github.com');
var gnome = require(MAIN_EXT_PATH + '/node_scripts/gnome');
var shared = require(MAIN_EXT_PATH + '/shared');
var formats = null;

const SCHEMA_DIR = path.join(__dirname + '/../../schemas');
const TEMP_DIR = shared.tempDir + '/links-addon';
const IMAGE_PATH = TEMP_DIR + '/image';
const LINK = process.argv[2];

const FORMATS_PATH = path.join(__dirname + '/../../formats.json');
if(fs.existsSync(FORMATS_PATH))
	formats = JSON.parse(fs.readFileSync(FORMATS_PATH));

if(!LINK)
{
	parser_debug('No link provided!');
	process.exit(1);
}
else
{
	var tempExist = fs.existsSync(TEMP_DIR);
	if(!tempExist) fs.mkdirSync(TEMP_DIR);

	gnome.loadSchema("org.gnome.shell.extensions.cast-to-tv-links-addon", SCHEMA_DIR);
}

var linkOpts = {
	path: getPath(),
	mode: gnome.getSetting('ytdl-mode'),
	quality: gnome.getSetting('max-quality'),
	fps: gnome.getSetting('max-fps'),
	vp9: gnome.getSetting('allow-vp9')
};

parser_debug(`Setting parser opts: ${JSON.stringify(linkOpts)}`);
parseLink(LINK, linkOpts);

function getPath()
{
	var ytdlPath = gnome.getSetting('ytdl-path');
	if(!ytdlPath) ytdlPath = '/usr/bin/youtube-dl';

	parser_debug(`Obtained path: ${ytdlPath}`);
	return ytdlPath;
}

function getSubs(data, lang)
{
	var subtitles = data[lang];
	parser_debug(`Searching for ${subtitles} subs`);

	if(subtitles)
	{
		subtitles.lang = lang;

		parser_debug(`Found available ${lang} subs`);
		return subtitles;
	}

	parser_debug(`Did not found ${lang} subs`);
	return null;
}

function checkUrl(url)
{
	return new Promise((resolve) =>
	{
		request.head(url, (error, response) =>
		{
			if(response.statusCode == 404) resolve(true);
			else resolve(false);
		});
	});
}

function parseLink(Url, opts)
{
	var info;
	var params;
	var fps;

	switch(opts.quality)
	{
		case '720p':
			params = '[height<=720]';
			break;
		case '2160p':
			params = '[height<=2160]';
			break;
		case '1080p':
		default:
			params = '[height<=1080]';
			break;
	}

	/* Disallow AV1 codec */
	params += '[vcodec!^=av01]';

	/* Stdout returns char to string, not bool */
	if(opts.vp9 != 'true') params += '[vcodec!^=vp9]';

	switch(opts.fps)
	{
		case '60':
			fps = '[fps<=60]';
			break;
		case '30':
		default:
			fps = '[fps<=30]';
			break;
	}

	var disallowed = '';

	if(formats && formats.ENCODE)
		formats.ENCODE.forEach(format => disallowed += `[protocol!=${format}]`);

	var bestSeekable = `best${params}${fps}${disallowed}/best${params}${disallowed}/best${disallowed}/best`;
	var bestAll = `best${params}${fps}/best${params}/best`;

	var format = (opts.mode === 'combined') ?
		bestSeekable : `bestvideo${params}${fps}+bestaudio/bestvideo${params}+bestaudio/${bestAll}`;

	parser_debug(`Requested ytdl format: ${format}`);

	var ytdlOpts = ['--ignore-config', '--socket-timeout', '3', '--all-subs', '--playlist-end', '1', '-f', format, '-j', Url];
	var youtubedl = spawn(opts.path, ytdlOpts);

	youtubedl.once('close', async(code) =>
	{
		if(code !== 0) return parser_debug(`youtube-dl error code: ${code}`);
		else if(!info) return parser_debug(`Unable to obtain link info!`);

		if(info.protocol == 'http_dash_segments')
		{
			var testUrl = (info.videoUrl || info.url);
			var isInvalid = await checkUrl(testUrl);

			if(isInvalid)
			{
				if(linkOpts.mode !== 'combined')
				{
					linkOpts.mode = 'combined';
					return parseLink(LINK, linkOpts);
				}
				else
				{
					return process.exit(1);
				}
			}
		}

		if(!parser_debug.enabled && !ytdl_debug.enabled)
		{
			console.log(JSON.stringify(info));
		}
		else
		{
			parser_debug('\nSELECTED INFO:');
			parser_debug(info);
		}
	});

	var setResolution = (data) =>
	{
		if(data.width && data.height)
			info.resolution = data.width + 'x' + data.height;
		else if(data.height)
			info.resolution = data.height;

		if(info.resolution && data.fps)
			info.resolution += '@' + data.fps;

		info.height = {
			expected: parseInt(opts.quality.slice(0, -1)),
			actual: (data.height || 0)
		}

		info.fps = {
			expected: parseInt(opts.fps),
			actual: (data.fps || 0)
		}
	}

	var getDownloadOpts = () =>
	{
		var opts = Array.from(ytdlOpts);

		opts.splice(opts.indexOf('--all-subs'), 1);
		opts.splice(opts.indexOf('-j'), 1);
		opts.pop();

		return opts;
	}

	youtubedl.stdout
		.pipe(JSONStream.parse())
		.once('data', (data) =>
		{
			ytdl_debug(data);

			info = {
				link: LINK,
				title: data.title,
				ytdlOpts: getDownloadOpts(),
				container: data.ext
			};

			if(data.thumbnail)
			{
				info.thumbnail = data.thumbnail;
				request(info.thumbnail).pipe(fs.createWriteStream(IMAGE_PATH));
			}
			else
			{
				var isPicture = (formats && formats.PICTURE && formats.PICTURE.includes(data.ext));

				if(data.url && isPicture)
				{
					info.thumbnail = data.url;
					request(info.thumbnail).pipe(fs.createWriteStream(IMAGE_PATH));
				}
				else
					fs.unlink(IMAGE_PATH, () => {});
			}

			if(data.url)
			{
				setResolution(data);

				if(data.vcodec && data.vcodec !== 'none')
					info.vcodec = data.vcodec;

				info.url = data.url;
				info.protocol = data.protocol;
			}
			else
			{
				var getUrl = (format) =>
				{
					if(
						format.manifest_url
						&& format.fragment_base_url
						&& format.manifest_url === format.url
					) {
						return format.fragment_base_url;
					}

					return format.url;
				}

				data.requested_formats.forEach(format =>
				{
					if(format.vcodec && format.vcodec !== 'none')
					{
						setResolution(data);

						info.vcodec = format.vcodec;
						info.videoUrl = getUrl(format);
						info.protocol = format.protocol;
					}
					else if(format.acodec && format.acodec !== 'none')
					{
						info.acodec = format.acodec;
						info.audioUrl = getUrl(format);
					}
				});
			}

			if(data.requested_subtitles)
			{
				var subsData = data.requested_subtitles;

				var lang = gnome.getSetting('preferred-lang');
				if(!lang) lang = 'en';

				parser_debug(`Using preferred subs lang: ${lang}`);
				var subtitles = getSubs(subsData, lang);

				if(subtitles) info.subtitles = subtitles;
				else
				{
					lang = gnome.getSetting('fallback-lang');
					parser_debug(`Using fallback subs lang: ${lang}`);
					subtitles = getSubs(subsData, lang);

					if(subtitles) info.subtitles = subtitles;
				}
			}
		});
}
