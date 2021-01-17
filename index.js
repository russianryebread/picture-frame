const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const async = require('async')
require('dotenv').config()

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
const CREDENTIALS = process.env.CREDENTIALS
const TOKEN_PATH = 'token.json';
const FOLDER = './pictures'

log('Started')
authorize(JSON.parse(CREDENTIALS), downloadFrame);

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

function log(message) {
    console.log(`${(new Date().toLocaleString())} ${message}`)
}
/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFiles(auth) {
    const drive = google.drive({ version: 'v3', auth });
    drive.files.list({
        pageSize: 10,
        fields: 'nextPageToken, files(id, name)',
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const files = res.data.files;
        if (files.length) {
            console.log('Files:');
            files.map((file) => {
                console.log(`${file.name} (${file.id})`);
            });
        } else {
            console.log('No files found.');
        }
    });
}

function downloadFrame(auth) {
    log('Searching new files')
    let offlineFiles = []
    fs.readdirSync(FOLDER).forEach(file => {
        if (file.toLowerCase().endsWith('jpg'))
            offlineFiles.push(file);
    });

    const drive = google.drive({ version: 'v3', auth });
    var pageToken = null;
    let onlineFiles = []

    // Using the NPM module 'async'
    async.doWhilst(function (callback) {
        drive.files.list({
            q: "mimeType contains 'image/jpeg' and '191hyg006yIT-OdJkPY-V2e9uWZuKiQwr' in parents",
            fields: 'nextPageToken, files(id, name)',
            spaces: 'drive',
            pageToken: pageToken
        }, function (err, res) {
            if (err) {
                console.error(err);
                callback(err)
            } else {
                res.data.files.forEach(function (file) {
                    log(`Found file: ${file.name}`);
                    onlineFiles.push({ name: file.name, id: file.id })
                });
                pageToken = res.nextPageToken;
                callback();
            }
        });
    }, function () {
        let result = !!pageToken
        if (!result) {
            log('Sync started')
            let filesToBeDeleted = offlineFiles.filter(x => !onlineFiles.some(y => y.name === x))
            log('files to be deleted:')
            log(filesToBeDeleted)
            filesToBeDeleted.forEach(f => {
                try {
                    fs.unlinkSync(`${FOLDER}/${f}`)
                } catch (err) {
                    console.error(err)
                }
            })

            let filesToBeDownloaded = onlineFiles.filter(x => !offlineFiles.some(y => y == x.name))
            log('files to be downloaded:')
            log(filesToBeDownloaded.map(x => x.name))
            filesToBeDownloaded.forEach(file => {
                download3(auth, file.id, file.name)
            })
            log('Sync finished')
        }
        return !!pageToken;
    }, function (err) {
        if (err) {
            // Handle error
            console.error(err);
        } else {
            // All pages fetched
            log('finished')
            log(onlineFiles)
        }
    })

}

function download3(auth, fileId, name) {
    const drive = google.drive({ version: 'v3', auth });
    let path = `${FOLDER}/${name}`

    var dest = fs.createWriteStream(path);

    drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'stream' },
        function (err, res) {
            res.data
                .on('end', () => {
                    log(`Downloaded ${path}`);
                })
                .on('error', err => {
                    console.log('Error', err);
                })
                .pipe(dest);
        });
}