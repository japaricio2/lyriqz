var request = require('request');
var cheerio = require('cheerio');
var keys = require('../keys');

var quorum_factor = "quorum_factor=1";
var apikey = keys.musixmatch.key;
var baseURL = "https://api.musixmatch.com/ws/1.1/track.search"

var options = {
  url: '',
  headers: {
    'User-Agent': 'request',
    'Accept': 'application/json',
  }
};

// ----------------------------------------------
// getUrl
// ----------------------------------------------
// musixmatch()
//    makes request to musixmatch api to find endpoint of lyrics to song
//    returns url of endpoint
// lyricWiki()
//    makes request to lyricWiki to find endpoint of lyrics to song
//    on hold but it will be used as an alternative for musixmatch
//    returns url of endpoint
// ----------------------------------------------

var getUrl = {
  musixmatch: function (songName, songArtists, callback) {
    var musixName = songName;
    var musixArtists = '';

    if (!songName || !songArtists) {
      console.log('getUrl.musixmatch --- songName or songArtists returned null');
      callback(undefined);
      return;
    }

    if (!(songArtists.length >= 1)) {
      console.log('getUrl.musixmatch --- songArtists returned empty');
      callback(undefined);
      return;
    }

    songArtists.forEach(function (artist) {
      musixArtists += artist + ' ';
    });

    if (songName.includes('feat')) {
      var musixName = songName.slice(0, songName.indexOf('('));
    }

    var q_track = `q_track=${musixName}`;
    var q_artist = `q_artist=${musixArtists}`;
    queryString = `?format=json&${q_track}&${q_artist}&${quorum_factor}&${apikey}`;

    var finalURL = baseURL + queryString;
    options.url = encodeURI(finalURL);

    request(options, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        console.log('getUrl.musixmatch.request --- no error and valid status code')
        var payload = {};
        var data;
        data = JSON.parse(body);

        console.log(data.message.body.track_list)
        // console.log(data.message.body.track_list)
        var listTracks = data.message.body.track_list;
        var lyricURL = undefined;

        for (var i = 0; i < listTracks.length; i++) {
          var musixArtistName = listTracks[i]['track']['artist_name'].toLowerCase();
          var spotifyArtistName = songArtists[0].toLowerCase();

          if (listTracks[i]['track']['artist_name'] && listTracks[i]['track']['has_lyrics'] === 1) {
            if (musixArtistName.includes(spotifyArtistName)) {
              lyricURL = listTracks[i].track.track_share_url;
              lyricURL = lyricURL.split('?')[0];
              artName = lyricURL.split('/')[4]
              sngName = lyricURL.split('/')[5]
            }
          }
        }
        callback(lyricURL);
        return;
      } else {
        console.log(`getUrl.musixmatch --- musixmatch invalid statusCode: ${code} or eror ${error}`);
        callback(undefined);
        return;
      }
    });
  },
  lyricWiki: function (songName, songArtist, callback) {
    // http://lyrics.wikia.com/wiki/Special:Search?query=humble+kendrick
    options.url = 'http://lyrics.wikia.com/wiki/Special:Search?query=' + songName + '+' + songArtist;
    options.url = encodeURI(options.url);
    request(options, function (err, response, body) {
      if (err || response.statusCode != 200) {
        if (err) {
          console.log(err);
        } else {
          console.log('Response Status Code: ' + response.statusCode);
          console.log(response.body);
        }
      } else {
        var $ = cheerio.load(body);
        var resultLinks = [];
        var links = $('.result-link').toArray();
        var winners = [];

        links.forEach(function (link, index) {
          if (index % 2 === 0) {
            resultLinks.push(link.attribs.href);
          }
        });
        links = null;
        var url = '';

        resultLinks.forEach(function (link, index) {
          url = decodeURI(link);
          url = url.split('/');
          info = url[4];

          if (info) {
            songName = songName.split(' ').join('_');
            artist = info.split(':')[0];
            songTitle = info.split(':')[1];
            // console.log(`${index}. ${artist} - ${songTitle}`);
            if (artist && songTitle) {
              // console.log(`${songTitle} - ${songName}`);
              if (songName.toLowerCase().includes(songTitle.toLowerCase())) {
                winners.push(link);
              }
            }
          }
        });
        callback(winners[0]);
      }
    });
  }
}

module.exports = getUrl;