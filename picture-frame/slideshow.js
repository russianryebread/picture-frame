const { spawn } = require('child_process')

const PHOTO_DELAY = process.env.PHOTO_DELAY || "10"
const PICTURE_PATH = process.env.LOCAL_MEDIA_DIR || "./public/pictures"
const PORT = process.env.PORT || 80

function feh() {
    return command('feh', [
	    '--recursive',
	    '--randomize',
	    '--fullscreen',
	    '--quiet',
	    '--hide-pointer',
	    '--slideshow-delay', PHOTO_DELAY,
	    PICTURE_PATH
    ])
}

function chromium() {
    return command('chromium-browser', [
        '--kiosk',
        '--fullscreen',
        `--app=http://localhost:${PORT}`
    ])
}

function command(command, args) {
    const cmd = spawn(command, args)

    cmd.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`)
    })

    cmd.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`)
    })

    cmd.on('close', (code) => {
        console.log(`child process exited with code ${code}`)
    })

    return cmd
}

module.exports = {
    chromium,
    feh
}