const { spawn } = require('child_process')

const PHOTO_DELAY = process.env.PHOTO_DELAY || "10"
const PICTURE_PATH = process.env.LOCAL_MEDIA_DIR || "./public/pictures"

function show() {
    const feh = spawn('feh', [
	    '--recursive',
	    '--randomize',
	    '--fullscreen',
	    '--quiet',
	    '--hide-pointer',
	    '--slideshow-delay', PHOTO_DELAY,
	    PICTURE_PATH
    ])

    feh.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`)
    })

    feh.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`)
    })

    feh.on('close', (code) => {
        console.log(`child process exited with code ${code}`)
    })
}

module.exports = {
    show
}