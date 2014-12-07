/**
 * Created by cr on 28/11/14.
 */

htmlparser = require("htmlparser2");

var superagent = require('superagent');
var agent = superagent.agent();
var theAccount = {
    "j_username": "nacho",
    "j_password": "iamtheluchadore",
    "persistentLogin": "true"
};

exports.login = function (request, done) {

    //function(user, pass, callbackSuccess, callbackFailure) {
        //https://www.parship.de/j_acegi_security_check
        //j_username
        //j_password
        //persistentLogin=true

    console.log('login');
    request
        .post('https://www.parship.de/j_acegi_security_check')
        .send(theAccount)
        .end(function (err, res) {
            if (err) {
                throw err;
            }
            agent.saveCookies(res);
            done(agent);
        });
};

/**
 *
 * @param profile
 * @param html
 * @returns {null}
 */
exports.parseImages = function (profile, html) {
    //console.log('parseImages', profile, html);
    console.log('parseImages');

    html = '' + html;

    if(profile == undefined) {
        throw 'please provide profile object';
    }

    if (html.match(/(j_acegi_security_check)/)) {
        throw 'Please login';
    }


    if (html.match(/(Kostenlos anmelden)/)) {
        throw 'Please login';
    }

    if (html.match(/(Der Kontakt wurde beendet)/)) {
        //throw 'you are blocked by ' + profileId;
        console.error('you are blocked by ' + profileId);
        return null;
    }
    if (html.match(/Dieses Profil ist derzeit nicht aktiv/)) {
        //throw 'you are blocked by ' + profileId;
        console.error('not active ' + profileId);
        return null;
    }




    var parser = new htmlparser.Parser({
        onopentag: function(name, attribs){
            if (name === "span") {

                if (attribs.class === "ps_photo ps_photo_popItUp") {

                    //var imageUrl = attribs.style.backgroundImage.slice(4, -1);
                    var imageUrl = '' + attribs.style;//.slice(4, -1);
                    imageUrl = imageUrl.replace('background-image: url(','').replace(');','');
                    console.log('imageUrl', imageUrl);

                    if (imageUrl.match(/unblurred/)) {
                        profile.images.push(imageUrl);
                    }

                    return true;
                }

            }

        },
        ontext: function(text){
        },
        onclosetag: function(tagname){

        }
    });
    parser.write(html);
    parser.end();


    return profile;


};

exports.parse = function(profileId, profileHTML) {

    profileHTML = '' + profileHTML;

    if (profileHTML.match(/(Kostenlos anmelden)/)) {
        throw 'Please login';
    }

    if (profileHTML.match(/j_acegi_security_check/)) {
        console.info('profileHTML', profileHTML);
        throw 'Please login';
    }

    if (profileHTML.match(/(Der Kontakt wurde beendet)/)) {
        //throw 'you are blocked by ' + profileId;
        console.error('you are blocked by ' + profileId);
        return null;
    }

    var profile = {
        id: profileId
        , options: {
            sharedImages: undefined
            , _hasImages: false
        }
        , occupation: undefined
        , age: undefined
        , distance: undefined
        , matching: undefined
        , height: undefined
        , lastLogin: undefined
        , language: undefined
        , education: undefined
        , pets: undefined
        , children: undefined
        , maritalStatus: undefined
        , smoker: undefined

        , images: []
        , imagesPreview: []

    };

    if (profileHTML.match(/( Bilder verbergen )/)) {
        profile.options.sharedImages = true;
    }

    if (profileHTML.match(/(Kein Profilbild)/)) {
        profile.options._hasImages = false;
    } else {
        profile.options._hasImages = true;
    }



    var nodeValue = undefined;
    var currentItemId = '';
    var startItem = false;
    var partnerProfilePic = false;

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

                if (attribs.class === "ps_item") {
                    startItem = true;
                    return true;
                }

            }

            if (name === "input") {

                if (partnerProfilePic) {
                    var imageUrl = attribs.value;

                    if (imageUrl.match(/unblurred/)) {
                        profile.imagesPreview.push(imageUrl);
                    }

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

            if (name === "li") {

                if (attribs.id === "ps_viewMaritalStatus") {
                    currentItemId = 'maritalStatus';
                    return true;
                }

                if (attribs.id === "ps_viewChildren") {
                    currentItemId = 'children';
                    return true;
                }
                if (attribs.id === "ps_viewEducation") {
                    currentItemId = 'education';
                    return true;
                }
                if (attribs.id === "ps_viewSmoker") {
                    currentItemId = 'smoker';
                    return true;
                }

                if (attribs.id === "ps_viewPets") {
                    currentItemId = 'pets';
                    return true;
                }
            }

            if (name === "div") {
                if (attribs.class === "displayMP" && profile.matching === undefined) {
                    profile.matching = true;
                    return true;
                }

                if (attribs.id === "language_code") {
                    profile.language = true;
                    return true;
                }

                if (attribs.id === "partnerProfilePic") {
                    partnerProfilePic = true;
                    return true;
                }

                if (attribs.class === "ps_item") {
                    startItem = true;
                    return true;
                }

            }
        },
        ontext: function(text){
            //if (currentItemId == 'education') {
            //    console.log('ontext', startItem, currentItemId, text);
            //}
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

                if (startItem) {
                    if (currentItemId) {
                        profile[currentItemId] = nodeValue;
                        nodeValue = undefined;
                        startItem = false;
                        currentItemId = '';
                        return true;
                    }
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

                if (partnerProfilePic === true) {
                    partnerProfilePic = false;
                    return true;
                }

                if (startItem) {
                    if (currentItemId) {
                        profile[currentItemId] = nodeValue;
                        nodeValue = undefined;
                        startItem = false;
                        currentItemId = '';
                        return true;
                    }
                }

            }
        }
    });
    parser.write(profileHTML);
    parser.end();


    return profile;
};

exports.ping = function(callbackSuccess, callbackFailure) {

};

