var fs = require('fs');
var ffprobe = require('./ffprobe-sync');
var { spawn } = require('child_process');
var request = require('request');
var debug = require('debug');
var links_debug = debug('links-addon');
var ffprobe_debug = debug('ffprobe');
var ffmpeg_debug = debug('ffmpeg');

var config;
var selection;
var streamProcess;
var isDirect;

var stdioConf = 'ignore';
if(ffmpeg_debug.enabled) stdioConf = 'inherit';

const downloadOpts = [
	'-user_agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36',
	'-multiple_requests', '0',
	'-seekable', '1',
	'-timeout', '100000',
	'-reconnect', '1',
	'-reconnect_streamed', '1',
	'-reconnect_at_eof', '1',
	'-reconnect_delay_max', '0'
];

exports.handleSelection = function(selectionContents, configContents)
{
	config = configContents;
	selection = selectionContents;
	isDirect = false;

	links_debug(`Obtained config: ${JSON.stringify(config)}`);
	links_debug(`Obtained selection: ${JSON.stringify(selection)}`);
}

exports.closeStream = function()
{
	config = null;
	selection = null;
	isDirect = null;

	links_debug('Stream closed. Config and selection data wiped');
}

exports.fileStream = function(req, res)
{
	/* Prevent spawning more then one ffmpeg encode process */
	if(streamProcess)
	{
		links_debug('Stream in progress. Send status 429');
		res.statusCode = 429;
		res.end();
		return;
	}

	res.setHeader('Access-Control-Allow-Origin', '*');

	/* Set content type only when using local media merging,
	otherwise content type is piped from source through request */
	switch(selection.streamType)
	{
		case 'VIDEO':
		case 'PICTURE':
		case 'MUSIC':
			break;
		default:
			res.setHeader('Content-Type', 'video/x-matroska');
			res.setHeader('Connection', 'keep-alive');
			break;
	}

	if(isDirect)
	{
		links_debug(`New http request: ${req.headers.range}`);
		req.pipe(request.get(selection.mediaSrc)).pipe(res);
		return;
	}

	var isSeparate = (selection.videoSrc && selection.audioSrc) ? true : (selection.mediaSrc) ? false : null;
	if(isSeparate === null)
	{
		links_debug(`Invalid or missing selection info!`);
		return res.sendStatus(404);
	}
	links_debug(`Are video and audio tracks separate: ${isSeparate}`);

	var needsTranscoding = (selection.streamType == 'VIDEO_ENCODE') ? detectTranscoding() : false;
	links_debug(`Is transcoding needed: ${needsTranscoding}`);
	if(needsTranscoding)
	{
		switch(config.videoAcceleration)
		{
			case 'none':
				links_debug('Software media encoding');
				videoEncode(isSeparate).pipe(res);
				break;
			case 'vaapi':
				links_debug('VAAPI media encoding');
				vaapiEncode(isSeparate).pipe(res);
				break;
			default:
				links_debug(`Invalid video acceleration option: ${config.videoAcceleration}`);
				return res.end();
		}
	}
	else
	{
		if(	isSeparate
			|| (!isSeparate && selection.streamType == 'VIDEO_ENCODE')
		) {
			links_debug('Media will be merged into single file');
			mediaMerge(isSeparate).pipe(res);
		}
		else
		{
			links_debug('Direct media streaming');
			isDirect = true;
			req.pipe(request.get(selection.mediaSrc)).pipe(res);
		}
	}

	req.on('close', () =>
	{
		if(streamProcess)
		{
			const sig = 'SIGHUP';
			try {
				process.kill(streamProcess.pid, sig);
				links_debug(`Send ${sig} signal to stream process`);
			}
			catch(err) {
				links_debug(err)
			}
		}
	});
}

exports.subsStream = function(req, res)
{
	res.setHeader('Access-Control-Allow-Origin', '*');
	return req.pipe(request.get(selection.subsSrc)).pipe(res);
}

exports.coverStream = function(req, res)
{
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Content-Type', 'image/png');

	var exist = fs.existsSync(selection.coverSrc);

	if(exist)
	{
		links_debug('Sending found media cover');
		return fs.createReadStream(selection.coverSrc).pipe(res);
	}
	else
	{
		links_debug('Cover not found. Send status 204');
		res.sendStatus(204);
	}
}

function detectTranscoding()
{
	links_debug('Determining if transcoding is needed...');

	var mediaInfo = null;

	if(!selection.fps.actual || !selection.height.actual)
	{
		var source = (selection.videoSrc || selection.mediaSrc);
		mediaInfo = ffprobe(source, { path: config.ffprobePath }).streams[0];

		/* On parsing error */
		if(!mediaInfo)
		{
			ffprobe_debug(`FFprobe data is: ${mediaInfo}`);
			links_debug('Could not parse FFprobe data. Transcoding enabled');
			return true;
		}
	}

	/* Skipped when info not needed or parsing error */
	if(mediaInfo)
	{
		links_debug('Successfully parsed FFprobe data');
		ffprobe_debug(mediaInfo);

		if(!selection.fps.actual)
		{
			links_debug('Obtaining missing fps...');

			var fps = (mediaInfo.r_frame_rate || mediaInfo.avg_frame_rate);
			if(!fps)
			{
				links_debug('Could not detect fps. Transcoding enabled');
				return true;
			}

			selection.fps.actual = (typeof fps === 'string' && fps.includes('/')) ? fps.split('/')[0] : fps;
			links_debug(`Obtained video fps: ${selection.fps.actual}`);
		}

		if(!selection.height.actual)
		{
			links_debug('Obtaining missing video height...');

			selection.height.actual = (mediaInfo.height || mediaInfo.coded_height);
			links_debug(`Obtained video height: ${selection.fps.actual}`);
		}
	}

	links_debug(`Expected fps: ${selection.fps.expected}, actual: ${selection.fps.actual}`);
	links_debug(`Expected height: ${selection.height.expected}, actual: ${selection.height.actual}`);

	var detectedQuality = `${selection.height.actual}p${selection.fps.actual}`;
	var expectedQuality = `${selection.height.expected}p${selection.fps.expected}`;

	if(	selection.fps.actual > selection.fps.expected
		&& selection.height.actual >= selection.height.expected
	) {
		links_debug(`Detected ${detectedQuality} is greater than ${expectedQuality}`);
		return true;
	}

	links_debug(`Detected ${detectedQuality} is lower than or equal to requested ${expectedQuality}`);
	return false;
}

function mediaMerge(isSeparate)
{
	var format = 'matroska';
	if(!isSeparate) format = 'mp4';

	var mergeOpts = [
	'-movflags', '+empty_moov',
	'-c', 'copy',
	'-f', format,
	'pipe:1'
	];

	if(isSeparate) mergeOpts.unshift('-i', 'async:cache:' + selection.videoSrc, '-i', 'async:cache:' + selection.audioSrc);
	else mergeOpts.unshift('-i', 'async:cache:' + selection.mediaSrc, '-bsf:a', 'aac_adtstoasc');

	mergeOpts = [...downloadOpts, ...mergeOpts];
	links_debug(`Starting ffmpeg with opts: ${JSON.stringify(mergeOpts)}`);

	streamProcess = spawn(config.ffmpegPath, mergeOpts,
	{ stdio: ['ignore', 'pipe', stdioConf] });

	streamProcess.once('close', (code) =>
	{
		if(code !== null) links_debug(`FFmpeg exited with code: ${code}`);
		streamProcess = null;
		links_debug('Stream process wiped');
	});

	streamProcess.once('error', (error) => links_debug(error));

	return streamProcess.stdout;
}

function videoEncode(isSeparate)
{
	var format = 'matroska';
	if(!isSeparate) format = 'mp4';

	var encodeOpts = [
	'-movflags', '+empty_moov',
	'-c:v', 'libx264',
	'-vf', 'fps=30',
	'-pix_fmt', 'yuv420p',
	'-preset', 'superfast',
	'-level:v', '4.1',
	'-b:v', config.videoBitrate + 'M',
	'-maxrate', config.videoBitrate + 'M',
	'-c:a', 'copy',
	'-metadata', 'title=Cast to TV - Software Encoded Stream',
	'-f', format,
	'pipe:1'
	];

	if(isSeparate) encodeOpts.unshift('-i', 'async:cache:' + selection.videoSrc, '-i', 'async:cache:' + selection.audioSrc);
	else encodeOpts.unshift('-i', 'async:cache:' + selection.mediaSrc, '-bsf:a', 'aac_adtstoasc');

	encodeOpts = [...downloadOpts, ...encodeOpts];
	links_debug(`Starting ffmpeg with opts: ${JSON.stringify(encodeOpts)}`);

	streamProcess = spawn(config.ffmpegPath, encodeOpts,
	{ stdio: ['ignore', 'pipe', stdioConf] });

	streamProcess.once('close', (code) =>
	{
		if(code !== null) links_debug(`FFmpeg exited with code: ${code}`);
		streamProcess = null;
		links_debug('Stream process wiped');
	});

	streamProcess.once('error', (error) => links_debug(error));

	return streamProcess.stdout;
}

function vaapiEncode(isSeparate)
{
	var format = 'matroska';
	if(!isSeparate) format = 'mp4';

	var encodeOpts = [
	'-movflags', '+empty_moov',
	'-c:v', 'h264_vaapi',
	'-vf', 'fps=30,format=nv12,hwmap',
	'-level:v', '4.1',
	'-b:v', config.videoBitrate + 'M',
	'-maxrate', config.videoBitrate + 'M',
	'-c:a', 'copy',
	'-metadata', 'title=Cast to TV - VAAPI Encoded Stream',
	'-f', format,
	'pipe:1'
	];

	if(isSeparate) encodeOpts.unshift('-i', 'async:cache:' + selection.videoSrc, '-i', 'async:cache:' + selection.audioSrc);
	else encodeOpts.unshift('-i', 'async:cache:' + selection.mediaSrc, '-bsf:a', 'aac_adtstoasc');

	encodeOpts = [...downloadOpts, ...encodeOpts];
	encodeOpts.unshift('-vaapi_device', '/dev/dri/renderD128');
	links_debug(`Starting ffmpeg with opts: ${JSON.stringify(encodeOpts)}`);

	streamProcess = spawn(config.ffmpegPath, encodeOpts,
	{ stdio: ['ignore', 'pipe', stdioConf] });

	streamProcess.once('close', (code) =>
	{
		if(code !== null) links_debug(`FFmpeg exited with code: ${code}`);
		streamProcess = null;
		links_debug('Stream process wiped');
	});

	streamProcess.once('error', (error) => links_debug(error));

	return streamProcess.stdout;
}
