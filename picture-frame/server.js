const express = require('express')
const cors = require('cors')
const sync = require('./sync')
const slideshow = require('./slideshow')
const exec = require('child_process').exec

const app = express()
const PORT = process.env.PORT || 80
const GALLERY_URL = process.env.GALLERY_URL

app.use(express.static('public'))
app.use(cors())

app.get('/images', (req, res) => {
  res.send(sync.galleryImages())
})

app.get('/screen/toggle', (req, res) => {
  exec("vcgencmd display_power", (error, stdout, stderr) => {
    let t = stdout.trim().slice(-1)
    let toggle = (t == 1) ? 0 : 1
    exec(`vcgencmd display_power ${toggle}`, (e, stdout, stderr) => {
      let out = stdout.trim()
      res.json({
        screen: out,
        power: toggle,
        t: t
      })
    })
  })
})

app.listen(PORT, () => {
  if (!GALLERY_URL) { throw new Error("Unknown Gallery!") }
  console.log(`Picture Frame listening at http://localhost:${PORT}`)
  sync.scheduleSync()
  sync.fetchImages(GALLERY_URL)
  slideshow.chromium()
})

