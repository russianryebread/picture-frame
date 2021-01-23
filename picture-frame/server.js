const express = require('express')
const cors = require('cors')
const sync = require('./sync')


const app = express()
const PORT = process.env.PORT || 80
const GALLERY_URL = process.env.GALLERY_URL

app.use(express.static('public'))
app.use(cors())

app.get('/images', (req, res) => {
  res.send(sync.galleryImages())
})

app.listen(PORT, () => {
    if(!GALLERY_URL) { throw new Error("Unknown Gallery!") }
    console.log(`Picture Frame listening at http://localhost:${PORT}`)
    sync.scheduleSync()
    sync.fetchImages(GALLERY_URL)
})

