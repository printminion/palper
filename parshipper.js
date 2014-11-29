/**
 * Created by cr on 15/11/14.
 */

var profileParser = require("./parser.js");

var superagent = require('superagent')
// , TimeQueue = require('timequeue')
    , fs = require('fs')
    , async = require('async')
    , sleep = require('sleep')
    , process = require('process')
    , request = require('request')
    , domain = require('domain')
    , mkdirp = require('mkdirp')
    , nconf = require('nconf');

require('forevery');


d = domain.create();

d.on('error', function (err) {
    console.error(err);
});


// First consider commandline arguments and environment variables, respectively.
nconf.argv().env();

// Then load configuration from a designated file.
nconf.file({file: 'config.json'});

// Provide default values for settings not provided above.
nconf.defaults({
    'session': {
        'cookie': undefined
    }
});

//SET yOUR parship cookie here
var SESSION_COOKIE = nconf.get('session:cookie');
var PATH_CACHE = nconf.get('path:profileCache');
var PATH_CACHE_HTML = nconf.get('path:htmlCache');
var PATH_CACHE_PROFILE_IMAGES = nconf.get('path:imageCache');

if (!SESSION_COOKIE) {
    process.stderr.write('SESSION_COOKIE is empty. Please define it in config.json\n');
    process.exit(1);
}

//Set pages to crawl
var pagesCount = 1;


//get suggestions
//https://www.parship.de/lists/partnersuggestions

var pageNr = 0;


//parseNewProfiles();

//resyncProfles(false);

parseProfile('xxx', false, function (profile) {
    console.log('parseProfile:callback', profile);

});


function parseNewProfiles() {

    async.whilst(
        function () {
            return pageNr < pagesCount;
        },
        function (callback) {
            pageNr++;
            //setTimeout(callback, 1000);
            console.log(pageNr);

            crawlProfilePage(pageNr, function (profileIds) {
                parseProfiles(profileIds, function (data) {
                    console.log('parsed ' + data.length + ' profiles');
                    sleep.sleep(1);
                    callback();

                    //releaseImages(profileIds, function(data) {
                    //    console.log('releaseImages ' + data.length + ' profiles');
                    //    sleep.sleep(1);
                    //    callback();
                    //});

                });


            });
        },
        function (err) {
            // 5 seconds have passed
            console.log('done');
        }
    );
}


function resyncProfles(useCache) {
    fs.readdir(PATH_CACHE + '/', function (err, files) {
        if (err) {
            throw err;
        }


        var filesCount = files.length;
        var fileNr = 0;
        console.log('got ' + files.length + ' profiles');

        async.whilst(
            function () {
                return fileNr < filesCount;
            },
            function (callback) {
                fileNr++;
                //setTimeout(callback, 1000);
                console.log(fileNr + '/' + filesCount);

                if (!files.hasOwnProperty(fileNr)) {
                    callback();
                }

                var file = files[fileNr];

                if (file.substr(-5) == '.json') {
                    sleep.sleep(1);
                    //console.log(file, file.substr(-5), file.substr(0, file.length - 5));
                    parseProfile(file.substr(0, file.length - 5), useCache, function (profile) {

                        if (profile == null) {
                            console.log(' - skip');
                            callback();
                            return;
                        }
                        onParseProfileSuccess(profile, function () {
                            console.log('onParseProfileSuccess');
                            callback();
                        });
                    });

                    //break;
                } else {
                    callback();
                }
            },
            function (err) {
                // 5 seconds have passed
                console.log('done');
            });


    });
}

function releaseImages(profileIds, callback) {
    profileIds.forEvery(function (key, value) {
        console.log('profile', value);
        var url = value.split('?match=');
        var profileId = url[1];
        console.log('profileId', profileId);

        try {
            releaseImage(profileId, function (data) {
                if (data.hasOwnProperty('resultView')) {
                    console.log('releaseImage:', data.resultView.partnerChiffre, data.resultView.success);
                } else {
                    console.error('releaseImage:', profileId, false);
                }
            });
        } catch (e) {
            console.error('releaseImage:', profileId, false);
        }

    }).done(function (data) {
        callback(data);
    })
}


function parseProfiles(profileIds, callback) {
    console.log('profiles', profileIds);

    profileIds.forEvery(function (key, value) {
        console.log('profile', value);
        var url = value.split('?match=');
        var profileId = url[1];
        console.log('profileId', profileId);

        var outputFilename = PATH_CACHE + '/' + profileId + '.json';

        fs.exists(outputFilename, function (exists) {
            if (exists) {
                console.info('skip profile:' + profileId);
            } else {
                parseProfile(profileId, false, onParseProfileSuccess);
            }
        })
    }).done(function (data) {
        callback(data);
    })
}

function downloadProfileImages(profile, callback) {
    //download image
    //PATH_CACHE_PROFILE_IMAGES

    var download = function (uri, filename, callback) {
        request.head(uri, function (err, res, body) {
            console.log('content-type:', res.headers['content-type']);
            console.log('content-length:', res.headers['content-length']);

            request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
        });
    };

    var getMd5 = function(path, callback) {
        var fs = require('fs');
        var crypto = require('crypto');

        // the file you want to get the hash
        var fd = fs.createReadStream(path);
        var hash = crypto.createHash('sha1');
        hash.setEncoding('hex');

        fd.on('end', function() {
            hash.end();
            callback(hash.read());
        });

        // read all file and pipe it (write it) to the hash object
        fd.pipe(hash);
    };


    profile.images.forEvery(function (key, fileUrl) {
        console.log('fileUrl', fileUrl);

        var targetPath = '/tmp/' + profile.id + '_' + key + '.jpg';


        download(fileUrl, targetPath, function () {
            console.log('done');
            getMd5(targetPath, function(hash) {
                console.log('hash', hash);


                var profileImageCacheDir = PATH_CACHE_PROFILE_IMAGES + '/' + profile.id + '/';
                var newPath = profileImageCacheDir + profile.id + '_' + hash + '.jpg';

                mkdirp(profileImageCacheDir, function(err) {

                    // path was created unless there was error

                    if (err) throw err;

                    console.log('moving from ', targetPath);
                    console.log('moving to ', newPath);

                    fs.rename(targetPath, newPath, function() {
                        console.log('moved to new destination');
                    });
                });


            })

        });

    }).done(function (data) {
        callback(data);
    });
}

function onParseProfileSuccess(profile, callback) {
    console.log('onParseProfileSuccess');
    var profileId = profile.id;
    saveProfile(profile, function () {
        //saved

        if (profile.options.sharedImages) {
            console.error('releaseImage:', profileId, 'already shared');
            callback();
        } else {
            //releaseImage after save
            releaseImage(profileId, function (data) {
                if (data.hasOwnProperty('resultView')) {
                    console.log('releaseImage:', data.resultView.partnerChiffre, data.resultView.success);
                } else {
                    console.error('releaseImage:', profileId, false);
                }
                callback();
            });
        }


    });
}

function saveProfileHTML(profileId, html, callback) {
    console.log('saveProfileHTML', profileId);

    var outputFilename = PATH_CACHE_HTML + '/' + profileId + '.html';

    fs.writeFile(outputFilename, html, function (err) {
        if (err) {
            console.log(err);
            callback();
        } else {
            //console.log("JSON saved to " + outputFilename);
            callback();
        }
    });

}


function saveProfileImagesHTML(profileId, html, callback) {
    console.log('saveProfileImagesHTML', profileId);

    var outputFilename = PATH_CACHE_HTML + '/' + profileId + '_images.html';

    fs.writeFile(outputFilename, html, function (err) {
        if (err) {
            console.log(err);
            callback();
        } else {
            //console.log("JSON saved to " + outputFilename);
            callback();
        }
    });

}

function saveProfile(profile, callback) {
    console.log('saveProfile', profile);

    var outputFilename = PATH_CACHE + '/' + profile.id + '.json';

    fs.writeFile(outputFilename, JSON.stringify(profile, null, 4), function (err) {
        if (err) {
            console.log(err);
            callback();
        } else {
            //console.log("JSON saved to " + outputFilename);
            callback();
        }
    });

}

function loadProfileHtml(profileId, callbackSuccess, callbackFailure) {
    console.log('loadProfileHtml', profileId);

    var outputFilename = PATH_CACHE_HTML + '/' + profileId + '.html';

    fs.readFile(outputFilename, function (err, data) {
        if (err) {
            console.log(err);
            callbackFailure();
        } else {
            //console.log("JSON saved to " + outputFilename);
            callbackSuccess(data);
        }
    });

}

function loadProfileImagesHtml(profileId, callbackSuccess, callbackFailure) {
    console.log('loadProfileHtml', profileId);

    var outputFilename = PATH_CACHE_HTML + '/' + profileId + '_images.html';

    fs.readFile(outputFilename, function (err, data) {
        if (err) {
            console.log(err);
            callbackFailure();
        } else {
            //console.log("JSON saved to " + outputFilename);
            callbackSuccess(data);
        }
    });

}
Array.prototype.getUnique = function () {
    var u = {}, a = [];
    for (var i = 0, l = this.length; i < l; ++i) {
        if (u.hasOwnProperty(this[i])) {
            continue;
        }
        a.push(this[i]);
        u[this[i]] = 1;
    }
    return a;
};


function releaseImage(pageId, callback) {
    console.log('releaseImage', pageId);

    superagent
        .post('https://www.parship.de/profile/imagerelease/release')
        .send({partnerId: pageId, body: ''})
        .set('Accept-Encoding', 'gzip,deflate,sdch')
        .set('Accept-Language', 'en-US,en;q=0.8,de;q=0.6,ru;q=0.4,uk;q=0.2,es;q=0.2,ro;q=0.2,nl;q=0.2')
        .set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.122 Safari/537.36')
        .set('Accept', 'text/javascript, text/html, application/xml, text/xml, */*')
        .set('Referer', 'https://www.parship.de/partner/factfilepartner?match=' + pageId)

        .set('Cookie', SESSION_COOKIE)
        .end(function (err, res) {
            if (err) {
                //throw err;
                console.error(err);
                callback(response);
                return false;
            }

            if (res.text == '') {
                console.error('no profiles found', res);
                throw 'no profiles found';
            }
            var response = {};
            try {
                response = JSON.parse(res.text);
            } catch (e) {
                console.error('no profiles found', response);
                throw 'no profiles found';
            }

            //console.log(response);

            if (response.resultView.errorCode) {
                callback(response);
            } else {
                throw 'no profile found. pageId:' + pageId;
            }
        });
}

function crawlProfilePage(pageId, callback) {
    console.log('crawlProfilePage', pageId);

    superagent
        .get("https://www.parship.de/lists/partnersuggestions?sortBy=BY_NEWEST_FIRST&page=" + pageId)
        .set('Accept-Encoding', 'gzip,deflate,sdch')
        .set('Accept-Language', 'en-US,en;q=0.8,de;q=0.6,ru;q=0.4,uk;q=0.2,es;q=0.2,ro;q=0.2,nl;q=0.2')
        .set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.122 Safari/537.36')
        .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
        .set('Referer', 'https://www.parship.de/lists/partnersuggestions?sortBy=BY_DISTANCE')

        .set('Cookie', SESSION_COOKIE)
        .end(function (err, res) {
            if (err) {
                throw err;
            }
            //console.log(res.text);

            //check if logged off
            if (res.text.match(/Kostenlos anmelden/)) {
                throw 'logged of';
            }


            //https://www.parship.de/partner/factfilepartner?match=PS8MN5DX
            var regex = /(\/partner\/factfilepartner\?match=[^"]*)/g;
            var matches = res.text.match(regex);

            //console.log(matches);

            if (matches) {
                callback(matches.getUnique());
            } else {
                throw 'no profiles found. Page:' + pageId + ' Url: https://www.parship.de/lists/partnersuggestions?sortBy=BY_NEWEST_FIRST&page=' + pageId;
            }
        });
}


function parseProfile(profileId, useCache, callback) {
    console.log('parseProfile', profileId);

    try {


        if (useCache) {
            loadProfileHtml(profileId,
                function (html) {
                    var profile = profileParser.parse(profileId, html);
                    callback(profile);
                }, function () {
                    loadRemoteProfile(profileId, function (html) {


                        var profile = profileParser.parse(profileId, html);

                        saveProfileHTML(profileId, html, function () {
                            //callback(profile);
                            downloadProfileImages(profile, callback);
                        });


                    });
                });

            return;
        }

        var profile = undefined;

        loadRemoteProfile(profileId,
            function (html) {

                profile = profileParser.parse(profileId, html);

                saveProfile(profile, function(){
                    console.log('updated profile');
                });

                saveProfileHTML(profileId, html, function () {

                    console.log('saveProfileHTML:callback');

                    if (profile.imagesPreview.length == 0) {
                        callback(profile);
                    } else {


                        loadRemoteProfileImages(profileId, function (html) {

                            profile = profileParser.parseImages(profile, html);


                            saveProfileImagesHTML(profile.id, html, function () {


                                downloadProfileImages(profile, callback);
                                //callback(profile);
                            });

                        })
                    }


                });


            });

    } catch (e) {
        callback(null);
    }

}

function loadRemoteProfile(profileId, callbackSuccess) {
    console.log('loadRemoteProfile', profileId);

    superagent
        .get("https://www.parship.de/partner/factfilepartner?match=" + profileId)
        .set('Accept-Encoding', 'gzip,deflate,sdch')
        .set('Accept-Language', 'en-US,en;q=0.8,de;q=0.6,ru;q=0.4,uk;q=0.2,es;q=0.2,ro;q=0.2,nl;q=0.2')
        .set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.122 Safari/537.36')
        .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
        .set('Referer', 'https://www.parship.de/lists/partnersuggestions?sortBy=BY_DISTANCE')

        .set('Cookie', SESSION_COOKIE)
        .end(function (err, res) {
            if (err) {
                console.error(err);
                throw err;
            }

            //check if logged off
            if (res.text.match(/(Kostenlos anmelden)/)) {
                if (err) throw 'logged of';
            }

            callbackSuccess(res.text);

        });
}

function loadRemoteProfileImages(profileId, callbackSuccess) {
    console.log('loadRemoteProfileImages', profileId);

    superagent
        .get("https://www.parship.de/profile/partnerslideshow?userid=" + profileId + "&ajaxContent=true")
        .set('Accept-Encoding', 'gzip,deflate,sdch')
        .set('Accept-Language', 'en-US,en;q=0.8,de;q=0.6,ru;q=0.4,uk;q=0.2,es;q=0.2,ro;q=0.2,nl;q=0.2')
        .set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.122 Safari/537.36')
        .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
        .set('Referer', 'https://www.parship.de/partner/factfilepartner?match=' + profileId)

        .set('Cookie', SESSION_COOKIE)
        .end(function (err, res) {
            if (err) {
                console.error(err);
                throw err;
            }

            //check if logged off
            if (res.text.match(/(Kostenlos anmelden)/)) {
                if (err) throw 'logged of';
            }

            callbackSuccess(res.text);

        });
}