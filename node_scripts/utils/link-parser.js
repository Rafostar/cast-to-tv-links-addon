var fs = require('fs');
var path = require('path');
var debug = require('debug');
var parser_debug = debug('parser');
var ytdl_debug = debug('ytdl');
var JSONStream = require('JSONStream');
var request = require('request');
var { spawn, spawnSync } = require('child_process');
var schemaDir = path.join(__dirname + '/../../schemas');
var mainExtPath = path.join(__dirname + '/../../../cast-to-tv@rafostar.github.com');

/* Cast to TV imports */
var shared = require(mainExtPath + '/shared');
const tempDir = shared.tempDir + '/links-addon';
const imagePath = tempDir + '/image';

const link = process.argv[2];
if(!link)
{
	parser_debug('No link provided!');
	process.exit();
}
else
{
	var tempExist = fs.existsSync(tempDir);
	if(!tempExist) fs.mkdirSync(tempDir);
}

var linkOpts = {
	path: getPath(),
	mode: getSetting('ytdl-mode'),
	quality: getSetting('max-quality'),
	fps: getSetting('max-fps'),
	vp9: getSetting('allow-vp9')
};

parser_debug(`Setting parser opts: ${JSON.stringify(linkOpts)}`);

parseLink(link, linkOpts);

function getPath()
{
	var ytdlPath = getSetting('ytdl-path');
	if(!ytdlPath) ytdlPath = '/usr/bin/youtube-dl';

	parser_debug(`Obtained path: ${ytdlPath}`);
	return ytdlPath;
}

function getSetting(setting)
{
	var gsettings = spawnSync('gsettings', ['--schemadir', schemaDir,
		'get', 'org.gnome.shell.extensions.cast-to-tv-links-addon', setting]);

	var outStr = String(gsettings.stdout).replace(/\'/g, '').replace(/\n/, '');
	return outStr;
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
	var format;
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

	const formatsPath = path.join(__dirname + '/../../encode-formats.json');
	var exist = fs.existsSync(formatsPath);
	if(exist)
	{
		var formats = JSON.parse(fs.readFileSync(formatsPath));
		formats.forEach(format => disallowed += `[protocol!=${format}]`);
	}

	var bestSeekable = `best${params}${fps}${disallowed}/best${params}${disallowed}/best${disallowed}/best`;
	var bestAll = `best${params}${fps}/best${params}/best`;

	if(opts.mode == 'combined') format = bestSeekable;
	else format = `bestvideo${params}${fps}+bestaudio/bestvideo${params}+bestaudio/${bestAll}`;

	parser_debug(`Requested ytdl format: ${format}`);
	var youtubedl = spawn(opts.path, ['--ignore-config', '--socket-timeout', '3', '--all-subs', '--playlist-end', '1', '-f', format, '-j', Url]);

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
				if(linkOpts.mode != 'combined')
				{
					linkOpts.mode = 'combined';
					return parseLink(link, linkOpts);
				}
				else
				{
					return process.exit(1);
				}
			}
		}

		if(!parser_debug.enabled && !ytdl_debug.enabled) console.log(JSON.stringify(info));
		else
		{
			parser_debug('\nSELECTED INFO:');
			parser_debug(info);
		}
	});

	let setResolution = (data) =>
	{
		if(data.width && data.height) info.resolution = data.width + 'x' + data.height;
		else if(data.height) info.resolution = data.height;

		if(info.resolution && data.fps) info.resolution += '@' + data.fps;

		info.height = {
			expected: parseInt(opts.quality.slice(0, -1)),
			actual: (data.height || 0)
		}

		info.fps = {
			expected: parseInt(opts.fps),
			actual: (data.fps || 0)
		}
	}

	youtubedl.stdout
		.pipe(JSONStream.parse())
		.once('data', (data) =>
		{
			ytdl_debug(data);

			info = {
				title: data.title,
				container: data.ext
			};

			if(data.thumbnail)
			{
				info.thumbnail = data.thumbnail;
				request(info.thumbnail).pipe(fs.createWriteStream(imagePath));
			}
			else
			{
				var isPicture = (
					data.ext == 'bmp'
					|| data.ext == 'gif'
					|| data.ext == 'jpeg'
					|| data.ext == 'jpg'
					|| data.ext == 'png'
					|| data.ext == 'webp'
				);

				if(data.url && isPicture)
				{
					info.thumbnail = data.url;
					request(info.thumbnail).pipe(fs.createWriteStream(imagePath));
				}
				else fs.unlink(imagePath, () => {});
			}

			if(data.url)
			{
				setResolution(data);

				if(data.vcodec && data.vcodec != 'none') info.vcodec = data.vcodec;

				info.url = data.url;
				info.protocol = data.protocol;
			}
			else
			{
				var getUrl = (format) =>
				{
					if(	typeof format.manifest_url !== 'undefined'
						&& typeof format.fragment_base_url !== 'undefined'
					) {
						if(format.manifest_url == format.url)
							return format.fragment_base_url;
					}

					return format.url;
				}

				data.requested_formats.forEach(format =>
				{
					if(format.vcodec && format.vcodec != 'none')
					{
						setResolution(data);

						info.vcodec = format.vcodec;
						info.videoUrl = getUrl(format);
						info.protocol = format.protocol;
					}
					else if(format.acodec && format.acodec != 'none')
					{
						info.acodec = format.acodec;
						info.audioUrl = getUrl(format);
					}
				});
			}

			if(data.requested_subtitles)
			{
				var subsData = data.requested_subtitles;

				var lang = getSetting('preferred-lang');
				if(!lang) lang = 'en';

				var subtitles = getSubs(subsData, lang);

				if(subtitles) info.subtitles = subtitles;
				else
				{
					lang = getSetting('fallback-lang');
					subtitles = getSubs(subsData, lang);

					if(subtitles) info.subtitles = subtitles;
				}
			}
		});
}
