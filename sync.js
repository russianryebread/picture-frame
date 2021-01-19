require('dotenv').config()
const request = require("request");
const rp = require("request-promise-native");
const _chunk = require("lodash.chunk");
const fs = require("fs");
const path = require("path");
const schedule = require("node-schedule");

const PICTURE_PATH = "./pictures"

fetchImages(process.env.GALLERY_URL);

var cronSchedule = process.env.CRON_SCHEDULE || "0 */12 * * *";
console.log("Scheduling refresh of images every " + cronSchedule);
schedule.scheduleJob(cronSchedule, () => fetchImages(process.env.GALLERY_URL))

function fetchImages(albumURL) {
    console.log(`Fetching images from: ${process.env.GALLERY_URL}`);
    var albumId = albumURL.match(new RegExp("([^#/]+$)", "g"))[0];

    var baseUrl = getBaseUrl(albumId);
    images = listImagesInDir(PICTURE_PATH);

    getPhotoMetadata(baseUrl).then((metadata) => {
            var chunks = _chunk(metadata.photoGuids, 25);

            var processChunks = function (i) {
                if (i < chunks.length) {
                    getUrls(baseUrl, chunks[i]).then((urls) => {
                        decorateUrls(metadata, urls);
                        setTimeout(() => processChunks(i + 1), 1000);
                    })
                } else {
                    var i = 0;
                    for (const photoGuid in metadata.photos) {
                        i++;
                        var photo = metadata.photos[photoGuid];

                        const photoName = `${photoGuid}.jpg`
                        const photoPath = `${PICTURE_PATH}/${photoName}`

                        // Skip photos which are already on the fs
                        if (fs.existsSync(photoPath)) { continue }

                        // Download files that are not.
                        console.log(`Downloading: ${photoName}`);
                        downloadFile(photo.url, photoPath);
                    }

                    // Delete photos which are not present in the photostream
                    for (const image of images) {
                        let guid = image.slice(11, 47)
                        if (metadata.photoGuids.indexOf(guid) === -1) {
                            console.log(`Deleting: ${image}`, guid)
                            fs.unlinkSync(image);
                        }
                    }

                    images = listImagesInDir(PICTURE_PATH);
                }
            };

            processChunks(0);
        }).catch(function (error) {
            console.log("error:", error);
        });
}

/**
 * Parse the base url for apple photos
 * @param {String} token Token is the album id.
 */
function getBaseUrl(token) {
    var BASE_62_CHAR_SET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    var base62ToInt = function (e) {
        var t = 0;
        for (var n = 0; n < e.length; n++)
            t = t * 62 + BASE_62_CHAR_SET.indexOf(e[n]);
        return t;
    };

    var e = token,
        t = e[0],
        n = t === "A" ? base62ToInt(e[1]) : base62ToInt(e.substring(1, 3)),
        r = e,
        i = e.indexOf(";"),
        s = null;

    if (i >= 0) {
        s = e.slice(i + 1);
        r = r.replace(";" + s, "");
    }

    var serverPartition = n;

    var baseUrl = "https://p";

    baseUrl += serverPartition < 10 ? "0" + serverPartition : serverPartition;
    baseUrl += "-sharedstreams.icloud.com";
    baseUrl += "/";
    baseUrl += token;
    baseUrl += "/sharedstreams/";

    return baseUrl;
}

/**
 * Fetches the metadata for aple photos
 * @param {String} baseUrl Apple photos album url.
 */
function getPhotoMetadata(baseUrl) {
    var url = baseUrl + "webstream";

    var headers = {
        Origin: "https://www.icloud.com",
        "Accept-Language": "en-US,en;q=0.8",
        "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36",
        "Content-Type": "text/plain",
        Accept: "*/*",
        Referer: "https://www.icloud.com/sharedalbum/",
        Connection: "keep-alive"
    };

    var dataString = '{"streamCtag":null}';

    var options = {
        url: url,
        method: "POST",
        headers: headers,
        body: dataString
    };

    return rp(options).then(function (body) {
        var data = JSON.parse(body);

        var photos = {};

        var photoGuids = [];

        data.photos.forEach(function (photo) {
            photos[photo.photoGuid] = photo;
            photoGuids.push(photo.photoGuid);
        });

        return {
            photos: photos,
            photoGuids: photoGuids
        };
    });
}

/**
 * Geg ULR for images
 * @param {String} baseUrl Directory to check for images as string.
 * @param {String} photoGuids
 */
function getUrls(baseUrl, photoGuids) {
    var url = baseUrl + "webasseturls";

    var headers = {
        Origin: "https://www.icloud.com",
        "Accept-Language": "en-US,en;q=0.8",
        "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36",
        "Content-Type": "text/plain",
        Accept: "*/*",
        Referer: "https://www.icloud.com/sharedalbum/",
        Connection: "keep-alive"
    };

    var dataString = JSON.stringify({
        photoGuids: photoGuids
    });

    var options = {
        url: url,
        method: "POST",
        headers: headers,
        body: dataString
    };

    // console.log('Retrieving URLs for ' + photoGuids[0] + ' - ' + photoGuids[photoGuids.length - 1] + '...');

    return rp(options).then(function (body) {
        var data = JSON.parse(body);

        var items = {};

        for (var itemId in data.items) {
            var item = data.items[itemId];

            items[itemId] = "https://" + item.url_location + item.url_path;
        }

        return items;
    });
}

/**
 * Get best image from meta
 * @param {Array} metadata Directory to check for images as string.
 * @param {Array} urls
 */
function decorateUrls(metadata, urls) {
    for (var photoId in metadata.photos) {
        var photo = metadata.photos[photoId];

        var biggestFileSize = 0;
        var bestDerivative = null;

        for (var derivativeId in photo.derivatives) {
            var derivative = photo.derivatives[derivativeId];

            if (parseInt(derivative.fileSize, 10) > biggestFileSize) {
                biggestFileSize = parseInt(derivative.fileSize, 10);
                bestDerivative = derivative;
            }
        }

        if (bestDerivative) {
            if (typeof urls[bestDerivative.checksum] == "undefined") {
                continue;
            }

            var url = urls[bestDerivative.checksum];
            metadata.photos[photoId].url = url;
            metadata.photos[photoId].bestDerivative = bestDerivative;
        }
    }
}

/**
 * Download file to directory
 * @param {String} url File URL.
 * @param {String} dest Full path of destination folder to save file.
 * @param {String} cb Callback function. 
 */
function downloadFile(url, dest, cb) {
    const file = fs.createWriteStream(dest);
    const sendReq = request.get(url);

    // verify response code
    sendReq.on("response", response => {
        if (response.statusCode !== 200) {
            console.log("Response status was " + response.statusCode);
        }

        sendReq.pipe(file);
    });

    // check for request errors
    sendReq.on("error", err => {
        fs.unlinkSync(dest);
        console.log(err.message);
    });

    file.on("error", err => {
        // Handle errors
        fs.unlinkSync(dest); // Delete the file async. (But we don't check the result)
        console.log(err.message);
    });
}

function listImagesInDir(directory) {
    if (!fs.existsSync(directory)) return [];
    let newDirents = fs.readdirSync(directory, { withFileTypes: true });
    let files = newDirents
        .filter(d => !d.isDirectory() && d.isFile())                                      // remove directories
        .map(d => d.name)                                                                 // file name
        .filter(f => !(/(^|\/)\.[^\/\.]/g).test(f))                                       // remove files starting with . (macOS .DS_STORE for example)
        .filter(f => [".jpg", ".jpeg", ".gif", ".png", ".bmp"].includes(path.extname(f))) // remove files that are not an image
        .map(f => `${directory}/${f}`);                                                   // rebuild file path

    return files;
}