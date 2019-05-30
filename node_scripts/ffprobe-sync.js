var { spawnSync } = require('child_process');

function getInfo(filePath, opts)
{
	var ffprobe = spawnSync(opts.path,
		['-show_streams', '-show_format', '-print_format', 'json', filePath],
		{ stdio: ['ignore', 'pipe', 'ignore'] });

	var info = null;

	if(!ffprobe.status)
	{
		try { info = JSON.parse(ffprobe.output[1]); }
		catch(error) {}
	}

	return info;
}

module.exports = getInfo;
