var request = require('request');

// ----------------------------------------
// Spotify
// ----------------------------------------
// getTrack()
//    makes api call to spotify
//    returns data on requested track
// getCurrentSong()
//    api call to spotify
//    returns currently playing song
// ----------------------------------------

var spotify = {
  getTrack: function (token, trackid, callback) {
    var options = {
      url: `https://api.spotify.com/v1/tracks/${trackid}?market=US`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
    request(options, (error, response, body) => {
      var statusCode = response.statusCode;
      var info = {}
      if (!error && statusCode === 200) {
        try {
          info = JSON.parse(body);
          callback(info);
        } catch(e) {
          console.log('spotify.getTrack.request --- error parsing request.body');
          console.log(e);
          callback(undefined);
        }
      } else {
        console.log(`spotify.getTrack.request --- Request for: ${options.url}`);
        console.log(`spotify.getTrack.request --- spotify returned statusCode: ${response.statusCode}`);
        if(error) {
          console.log(`spotify.getTrack.request --- request returned error`);
          console.log(error);
        }
        callback(undefined);
      }
    });
  },
  getCurrentSong: function (token, callback) {
    
    var options = {
      url: 'https://api.spotify.com/v1/me/player/currently-playing?market=US',
      headers: {
        'User-Agent': 'request',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
    request(options, (error, response, body) => {
      var statusCode = response.statusCode;
      var payload = {};

      if (!error && statusCode === 200) {
        try {
          var info = JSON.parse(body);
          payload.progress_ms = info.progress_ms;
          payload.id = info.item.id;
          payload.name = info.item.name;
          payload.artist = info.item.artists[0].name;
          callback(payload);
        } catch(e) {
          console.log('spotify.getCurrentSong.request --- error parsing request.body');
          console.log(e);
          callback(undefined);
        }
      } else {
        console.log(`spotify.getCurrentSong.request --- status code ${statusCode}`);
        if(error) {
          console.log(`spotify.getCurrentSong.request --- request returned error`);
          console.log(error);
        }
        callback(undefined);
      }
    });
  }
}

module.exports = spotify;