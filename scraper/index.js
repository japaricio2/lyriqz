var request = require('request');
var cheerio = require('cheerio');
var randomUseragent = require('random-useragent');

var scrape = {
  musix: function (songUrl, callback) {
    var randomAgent = randomUseragent.getRandom();
    var options = {
      url: songUrl,
      headers: {
        'User-Agent': randomAgent
      }
    };

    request(options, function (err, response, body) {
      if (err || response.statusCode !== 200) {
        if (err) {
          console.log(err)
          callback(undefined);
          return;
        } else {
          console.log('Response Status Code: ' + response.statusCode);
          console.log(response.body);
          callback(undefined);
          return;
        }
      } else {
        $ = cheerio.load(body);
        var stuff = $('p.mxm-lyrics__content');
        var lyrics = [];
        for (var i = 0; i < stuff.length; i++) {
          lyrics.push(stuff[i]['children'][0]['data'])
        }
        lyrics = lyrics.join('\n')
        callback(lyrics);
      }
    });
  },
  lyricwiki: function (url, callback) {
    console.log('scraper.lyricWiki');

    var randomAgent = randomUseragent.getRandom();
    var options = {
      url: url,
      headers: {
        'User-Agent': randomAgent
      }
    };
    request(options, function (err, response, body) {
      if (err || response.statusCode != 200) {
        if (err) {
          console.log(err)
        } else {
          console.log('Response Status Code: ' + response.statusCode);
        }
      } else {
        $ = cheerio.load(body);
        var stuff = $('div.lyricbox').toArray();
        var lyrics = [];
        var chunk = '';

        stuff = stuff[0];
        stuff.children.forEach(function (child) {
          if (!child.data) {
            chunk += '\n';
            lyrics.push(chunk);
            chunk = '';
          } else {
            chunk += child.data;
          }
        });
        // lyrics.forEach(function(chunk) {
        //   console.log(chunk);
        // });
        callback(lyrics);
      }
    });
  }
};

module.exports = scrape;
// scrape.musix();
// scrape.lyricwiki();