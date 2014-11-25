/**
 * Created by cr on 15/11/14.
 */

var request = require('superagent')
   // , TimeQueue = require('timequeue')
    , htmlparser = require("htmlparser2")
    , fs = require('fs')
    , async = require('async')
    , sleep = require('sleep');

require('forevery');

//SET yOUR parship cookie here
var COOKIE = 'SET_YOUR_PARSHIP_COOKIE_HERE';

//Set pages to crawl
var pagesCount = 90;


//get suggestions
//https://www.parship.de/lists/partnersuggestions

var pageNr = 0;

async.whilst(
    function () { return pageNr < pagesCount; },
    function (callback) {
        pageNr++;
        //setTimeout(callback, 1000);
        console.log(pageNr);

        crawlProfilePage(pageNr, function(profileIds) {
            parseProfiles(profileIds, function(data) {
                console.log('parsed ' + data.length + ' profiles');
                sleep.sleep(1);
                callback();
            });

            releaseImages(profileIds, function(data) {
                console.log('releaseImages ' + data.length + ' profiles');
                sleep.sleep(1);
                callback();
            });
        });
    },
    function (err) {
        // 5 seconds have passed
        console.log('done');
    }
);


function releaseImages(profileIds, callback) {
    profileIds.forEvery(function (key, value) {
        console.log('profile', value);
        var url = value.split('?match=');
        var profileId = url[1];
        console.log('profileId', profileId);

        releaseImage(profileId, function (data) {
            console.log('releaseImage:', data.resultView.partnerChiffre, data.resultView.success);
        });

    }).done(function(data) {
        callback(data);
    })
}


function parseProfiles(profileIds, callback) {
    console.log('profiles', profileIds);

    profileIds.forEvery(function(key, value) {
        console.log('profile', value);
        var url = value.split('?match=');
        var profileId = url[1];
        console.log('profileId', profileId);

        var outputFilename = './cache/' + profileId + '.json';

        fs.exists(outputFilename, function(exists) {
            if (exists) {
                console.info('skip profile:' + profileId);
            } else {
                parseProfile(profileId, function(profile) {
                    saveProfile(profile, function(){
                        //saved
                    });
                });
            }
        })
    }).done(function(data) {
        callback(data);
    })
}

//parseProfile('PS53575D', saveProfile);
//parseProfile('KKL6KP76', saveProfile);

function saveProfile(profile, callback) {
    console.log('profile', profile);

    var outputFilename = './cache/' + profile.id + '.json';

    fs.writeFile(outputFilename, JSON.stringify(profile, null, 4), function(err) {
        if(err) {
            console.log(err);
            callback();
        } else {
            //console.log("JSON saved to " + outputFilename);
            callback();
        }
    });

}

Array.prototype.getUnique = function(){
    var u = {}, a = [];
    for(var i = 0, l = this.length; i < l; ++i){
        if(u.hasOwnProperty(this[i])) {
            continue;
        }
        a.push(this[i]);
        u[this[i]] = 1;
    }
    return a;
};


function releaseImage(pageId, callback) {
    console.log('releaseImage', pageId);

    request
        .post('https://www.parship.de/profile/imagerelease/release')
        .send({ partnerId: pageId, body: '' })
        .set('Accept-Encoding', 'gzip,deflate,sdch')
        .set('Accept-Language', 'en-US,en;q=0.8,de;q=0.6,ru;q=0.4,uk;q=0.2,es;q=0.2,ro;q=0.2,nl;q=0.2')
        .set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.122 Safari/537.36')
        .set('Accept', 'text/javascript, text/html, application/xml, text/xml, */*')
        .set('Referer', 'https://www.parship.de/partner/factfilepartner?match=' + pageId)

        .set('Cookie', COOKIE)
        .end(function(err, res) {
            if (err) {
                throw err;
            }

            var response = {};
            try {
                response = JSON.parse(res.text);
            } catch (e) {
                throw 'no profiles found';
            }

            //console.log(response);

            if(response.resultView.errorCode) {
                callback(response);
            } else {
                throw 'no profile found. pageId:' + pageId;
            }
        });
}

function crawlProfilePage(pageId, callback) {
    console.log('crawlProfilePage', pageId);

    request
        .get("https://www.parship.de/lists/partnersuggestions?sortBy=BY_NEWEST_FIRST&page=" + pageId)
        .set('Accept-Encoding', 'gzip,deflate,sdch')
        .set('Accept-Language', 'en-US,en;q=0.8,de;q=0.6,ru;q=0.4,uk;q=0.2,es;q=0.2,ro;q=0.2,nl;q=0.2')
        .set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.122 Safari/537.36')
        .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
        .set('Referer', 'https://www.parship.de/lists/partnersuggestions?sortBy=BY_DISTANCE')

        .set('Cookie', COOKIE)
        .end(function(err, res) {
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

            if(matches) {
                callback(matches.getUnique());
            } else {
                throw 'no profiles found. Page:' + pageId + ' Url: https://www.parship.de/lists/partnersuggestions?sortBy=BY_NEWEST_FIRST&page=' + pageId;
            }
        });
}


function parseProfile(profileId, callback) {
    console.log('parseProfile', profileId);

    request
        .get("https://www.parship.de/partner/factfilepartner?match=" + profileId)
        .set('Accept-Encoding', 'gzip,deflate,sdch')
        .set('Accept-Language', 'en-US,en;q=0.8,de;q=0.6,ru;q=0.4,uk;q=0.2,es;q=0.2,ro;q=0.2,nl;q=0.2')
        .set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.122 Safari/537.36')
        .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
        .set('Referer', 'https://www.parship.de/lists/partnersuggestions?sortBy=BY_DISTANCE')

        .set('Cookie', COOKIE)
        .end(function(err, res) {
            if (err) {
                console.error(err);
                throw err;
            }

            //check if logged off
            if (res.text.match(/(Kostenlos anmelden)/)) {
                if (err) throw 'logged of';
            }

            var profile = {
              id: profileId
                , occupation: undefined
                , age: undefined
                , distance: undefined
                , matching: undefined
                , height: undefined
                , lastLogin: undefined
                , language: undefined
                , education: undefined
                , pets: undefined

            };

            var nodeValue = undefined;

            var parser = new htmlparser.Parser({
                onopentag: function(name, attribs){
                    if (name === "span") {

                        if (attribs.id === "occupation") {
                            profile.occupation = true;
                            return true;
                        }

                        if (attribs.id === "ageText") {
                            profile.age = true;
                            return true;
                        }

                        if (attribs.id === "ps_viewHeight") {
                            profile.height = true;
                            return true;
                        }

                    }

                    if (name === "p") {

                        if (attribs.class === "ps_distanceValue") {
                            profile.distance = true;
                            return true;
                        }
                        if (attribs.class === "ps_lastLogin") {
                            profile.lastLogin = true;
                            return true;
                        }
                    }

                    if (name === "div") {
                        if (attribs.class === "displayMP hero" && profile.matching === undefined) {
                            profile.matching = true;
                            return true;
                        }

                        if (attribs.id === "language_code") {
                            profile.language = true;
                            return true;
                        }

                        if (attribs.id === "pets") {
                            profile.pets = true;
                            return true;
                        }

                    }
                },
                ontext: function(text){
                    nodeValue = text;
                },
                onclosetag: function(tagname){
                    if(tagname === "span") {

                        if (profile.occupation === true) {
                            profile.occupation = nodeValue;
                            nodeValue = undefined;
                            return true;
                        }

                        if (profile.age === true) {
                            profile.age = nodeValue;
                            nodeValue = undefined;
                            return true;
                        }

                        if (profile.height === true) {
                            profile.height = nodeValue;
                            nodeValue = undefined;
                            return true;
                        }

                    }

                    if(tagname === "p") {

                        if (profile.distance === true) {
                            profile.distance = nodeValue;
                            nodeValue = undefined;
                            return true;
                        }

                        if (profile.lastLogin === true) {
                            profile.lastLogin = nodeValue;
                            nodeValue = undefined;
                            return true;
                        }
                    }

                    if(tagname === "strong") {

                        if (profile.lastLogin === true) {
                            profile.lastLogin = nodeValue;
                            nodeValue = undefined;
                            return true;
                        }
                    }

                    if(tagname === "div") {

                        if (profile.matching === true) {
                            profile.matching = nodeValue;
                            nodeValue = undefined;
                            return true;
                        }

                        if (profile.language === true) {
                            profile.language = nodeValue;
                            nodeValue = undefined;
                            return true;
                        }

                        if (profile.pets === true) {
                            profile.pets = nodeValue;
                            nodeValue = undefined;
                            return true;
                        }
                    }
                }
            });
            parser.write(res.text);
            parser.end();



            callback(profile);

        });
}

//
//function worker(type, arg1, arg2, arg3, callback) {
//    if(type == "browse") {
//        if(arg2) {
//            browsePlaylist(client, arg1, arg2, callback);
//        } else {
//            browsePlaylist(client, arg1, null, callback);
//        }
//    } else if(type == "video") {
//        checkVideo(client, arg1, callback);
//    } else if(type == "shortlink") {
//        checkShortlink(client, arg1, callback);
//    }
//}
//var q = new TimeQueue(worker, { concurrency: 1, every: 1000 });
//
//
//function crawlProfiles(client) {
//    for(var i = 0; i < channels.length; i++) {
//        var channel = channels[i];
//        var params = {
//            id: channel,
//            part: "id,contentDetails"
//        };
//        var req = client.youtube.channels.list(params).withApiKey(API_KEY);
//        req.execute(function(err, response) {
//
//            if(!err && response) {
//                var uploadsList = response.items[0].contentDetails.relatedPlaylists.uploads;
//                if(uploadsList) {
//                    q.push("browse", uploadsList);
//                }
//            } else {
//                console.log("crawlProfiles failed");
//                console.log(err);
//            }
//        });
//    }
//}
//
//function browsePlaylist(client, playlistId, pageToken, callback) {
//    var params = {
//        part: "id,contentDetails",
//        playlistId: playlistId,
//        maxResults: 50
//    };
//
//    if(pageToken) {
//        params['pageToken'] = pageToken;
//    }
//
//    var req = client.youtube.playlistItems.list(params).withApiKey(API_KEY);
//    req.execute(function(err, response) {
//
//        if(err) {
//            console.log("browsePlaylist failed");
//            console.log(err);
//        } else {
//            for(var i = 0; i < response.items.length; i++) {
//                var videoId = response.items[i].contentDetails.videoId;
//
//                q.push("video", videoId);
//            }
//
//            if(response.nextPageToken) {
//                q.push("browse", playlistId, response.nextPageToken);
//            }
//        }
//        callback();
//    });
//}
//
//function checkVideo(client, videoId, callback) {
//    processedVideos++;
//    if(!checkedVideos[videoId]) {
//        checkedVideos[videoId] = 1;
//        request.get("https://www.youtube.com/annotations_invideo?features=1&legacy=1&video_id="+videoId, function(res) {
//            var regex = /(goo.gl\/[a-zA-Z0-9]{6,})/;
//            var matches = res.text.match(regex);
//
//            if(matches) {
//                for(var i = 0; i < matches.length; i++) {
//                    q.push("shortlink", matches[0]);
//                }
//            }
//        });
//    }
//    callback();
//}
//
//function checkShortlink(client, shortLink, callback) {
//    processedShortLinks++;
//    if(!checkShortlink[shortLink]) {
//        checkShortlink[shortLink] = 1;
//
//        var params = {
//            shortUrl: "http://"+shortLink,
//            projection: "ANALYTICS_CLICKS"
//        };
//        var req = client.urlshortener.url.get(params).withApiKey(API_KEY);
//        req.execute(function(err, response) {
//            if(err) {
//                console.log("checkShortlink failed");
//                console.log(err);
//                delete checkShortlink[shortLink];
//            } else {
//                if(response.longUrl.indexOf("redeem") != -1) {
//                    if(response.analytics.allTime.shortUrlClicks < 5) {
//                        console.log(response.analytics.allTime.shortUrlClicks + ": "+shortLink + " -> "+ response.longUrl);
//                    } else {
//                        console.log("redeem, "+ shortLink + " is stale, views: "+ response.analytics.allTime.shortUrlClicks);
//                    }
//                }
//            }
//        });
//    }
//    callback();
//}