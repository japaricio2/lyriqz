var SpotifyStrategy = require('passport-spotify').Strategy,
  connectFlash = require('connect-flash'),
  bodyParser = require('body-parser'),
  mongoose = require('mongoose'),
  passport = require('passport'),
  request = require('request'),
  express = require('express');

// Helpers
var spotify = require('./spotify'),
  getUrl = require('./get-url'),
  scrape = require('./scraper'),
  keys = require('./keys');

// Schema Models
var Track = require('./models/Track'),
  User = require('./models/User');

// Mongo Config
mongoose.connect('mongodb://localhost/lyrics', {
  useMongoClient: true
});
// ------------------------------------
// Passport Config - Spotify Strategy
// ------------------------------------
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id).then(function (user) {
    done(null, user);
  });
});

passport.use(new SpotifyStrategy({
    clientID: keys.spotify.clientID,
    clientSecret: keys.spotify.clientSecret,
    // Production
    callbackURL: 'http://jxja.me/l/callback'
    // LocalDev
    // callbackURL: 'http://localhost:3000/l/callback'
  },
  function (accessToken, refreshToken, profile, done) {
    User.findOne({
        spotifyID: profile.id
      })
      .then(function (foundUser) {
        if (!foundUser) {
          // null user
          console.log("Couldn't find user. Registering NEW USER to MongoDB");
          var newUser = {
            spotifyID: profile.id,
            accessToken: accessToken,
            refreshToken: refreshToken
          };
          User.create(newUser)
            .then(function (newUser) {
              done(null, newUser);
            })
            .catch(function (err) {
              console.log('err');
            });
        } else {
          User.findOneAndUpdate({
              "spotifyID": profile.id
            }, {
              accessToken: accessToken,
              refreshToken: refreshToken
            })
            .then(function () {
              console.log("User already registered. Refreshing Tokens.");
              done(null, foundUser);
            })
            .catch(function (err) {
              console.log(err);
            });
        }
      })
      .catch(function (err) {
        console.log(err);
      });
  }));

// Basic Setup
var port = 3000;
var app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static(__dirname + '/public'));
app.use(connectFlash());
app.use(require('express-session')({
  secret: 'ubuntu is a big red horse',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.use(function (req, res, next) {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash('error');
  next();
});

// --------------------------
// App Routes
// --------------------------
app.get('/l', function (req, res) {
  res.render('show');
});

app.get('/l/callback',
  passport.authenticate('spotify', {
    failureRedirect: '/l/login'
  }),
  function (req, res) {
    res.redirect('/l/lyrics');
  });


app.get('/l/lyrics', ensureAuthenticated, function (req, res) {
  User.findById(req.user._id)
    .then(function (foundUser) {
      console.log("\n---------------------- /l/lyrics -----------------------------");
      spotify.getCurrentSong(foundUser.accessToken, function (song) {
        if (!song) {
          req.flash('error', "Hmm, seems like we can't figure out what song you're currently playing");
          res.redirect('/l/error');
          console.log('song.id || song.name returned null');
        } else {
          console.log(`Song Name: ${song.name}`);
          spotify.getTrack(foundUser.accessToken, song.id, function (songData) {
            if (!songData) {
              req.flash('error', "Hmm, seems like we can't see what song you're currently playing.");
              res.redirect('/l/error');
              console.log('songData.id returned null');
            } else {
              var artists = [];
              if (songData.artists && songData.artists.length > 0) {
                songData.artists.forEach(function (artist) {
                  artists.push(artist.name);
                });
              }
              console.log(`Song Artists: ${artists.join(', ')}`);
              // check mongodb first before we scrape
              Track.find({
                'name': song.name
              }, function (err, foundTracks) {
                if (err) {
                  console.log(err);
                } else {
                  if (!foundTracks) {
                    // null track
                    console.log('foundTracks returned null');
                  } else if (foundTracks.length > 0) {
                    foundTracks.forEach(function (track) {
                      if (track.artist === song.artist) {
                        var finalLyrics = '';
                        for (var i = 0; i < track.lyrics.length; i++) {
                          if (track.lyrics[i] === '\n' || track.lyrics[i] === '') {
                            if (i >= 1) finalLyrics += '<br>';
                          } else {
                            finalLyrics += track.lyrics[i];
                          }
                        }
                        var songInfo = {
                          name: track.name,
                          artist: track.artist,
                          progress_ms: song.progress_ms
                        }
                        res.render('lyrics', {
                          data: finalLyrics,
                          song: songInfo
                        });
                      }
                    });
                  } else {
                    // we must scrape for lyrics since not in local db
                    getUrl.musixmatch(song.name, artists, function (url) {
                      if (!url) {
                        req.flash('error', "Hmm, seems like we couldn't find the lyrics.");
                        res.redirect('/l/error');
                        console.log('url returned null');
                      } else {
                        scrape.musix(url, function (lyrics) {
                          if (!lyrics) {
                            console.log("couldn't scrape lyrics");
                            req.flash('error', "Hmm, seems like we couldn't find the lyrics.");
                            res.redirect('/l/error');
                          } else {
                            var finalLyrics = '';
                            lyrics.forEach(function (line) {
                              if (line === '\n' || ' ') {
                                finalLyrics += '<br>'
                              }
                              finalLyrics += line;
                            });

                            var songInfo = {
                              name: song.name,
                              artist: song.artist,
                              progress_ms: song.progress_ms
                            }
                            res.render('lyrics', {
                              data: finalLyrics,
                              song: songInfo
                            });
                            var dbLyrics = '';
                            lyrics.forEach(function (line) {
                              dbLyrics += line
                            });
                            // Build Track document
                            var newTrack = {
                              name: song.name,
                              artist: song.artist,
                              artists: artists,
                              album: songData.album.name,
                              spotifyID: songData.id,
                              lyrics: dbLyrics
                            }
                            Track.create(newTrack, function (err, track) {
                              if (err) {
                                console.log(err);
                              }
                            });
                          }
                        });
                      }
                    });
                  }
                }
              });
            }
          });
        }
      });
    })
    .catch(function (err) {
      console.log(err);
    });
});

app.post('/l/update', ensureAuthenticated, function (req, res) {
  // what they get
  //  - new progress_ms
  //  - new lyrics
  //  - new song name
  //  - new artist name

  var oldSongName = req.body.sName;
  var newPayload = {
    songName: null,
    songArtist: null,
    progress_ms: null,
    songLyrics: null
  };
  console.log('[/l/update] oldSongName: ' + oldSongName);

  User.findById(req.user._id)
    .then(function (foundUser) {
      spotify.getCurrentSong(foundUser.accessToken, function (currSongData) {
        // FIRST CHECK
        if (oldSongName === undefined) {
          res.json(newPayload);
          return;
        } else if (!currSongData) {
          res.json(newPayload);
          return;
        } else if (oldSongName === currSongData.name) {
          res.json(newPayload);
          return;
        } else {
          // GET NEW LYRICS SEND AS JSON 
          if (!currSongData) {
            res.json(newPayload);
            return;
          } else {
            spotify.getTrack(foundUser.accessToken, currSongData.id, function (songData) {
              if (!songData) {
                res.json(newPayload);
                return;
              } else {
                var artists = [];
                if (songData.artists && songData.artists.length > 0) {
                  songData.artists.forEach(function (artist) {
                    artists.push(artist.name);
                  });
                }
                Track.find({
                  'name': currSongData.name
                }, function (err, foundTracks) {
                  if (err) {
                    console.log(err);
                  } else {
                    if (!foundTracks) {
                      // null track
                      res.json(newPayload);
                      return;
                    } else if (foundTracks.length > 0) {
                      foundTracks.forEach(function (track) {
                        if (track.artist === currSongData.artist) {
                          var finalLyrics = '';
                          for (var i = 0; i < track.lyrics.length; i++) {
                            if (track.lyrics[i] === '\n' || track.lyrics[i] === '') {
                              if (i >= 1) finalLyrics += '<br>';
                            } else {
                              finalLyrics += track.lyrics[i];
                            }
                          }
                          res.json({
                            songName: currSongData.name,
                            songArtist: currSongData.artist,
                            progress_ms: currSongData.progress_ms,
                            songLyrics: finalLyrics
                          });
                          return;
                        }
                      });
                    } else {
                      // we must scrape for lyrics since not in local db
                      getUrl.musixmatch(currSongData.name, artists, function (url) {
                        if (!url) {
                          res.json(newPayload);
                        } else {
                          scrape.musix(url, function (lyrics) {
                            if (!lyrics) {
                              res.json(newPayload);
                            } else {
                              var finalLyrics = '';
                              lyrics.forEach(function (line) {
                                if (line === '\n' || ' ') {
                                  finalLyrics += '<br>'
                                }
                                finalLyrics += line;
                              });

                              res.json({
                                songName: currSongData.name,
                                songArtist: currSongData.artist,
                                progress_ms: currSongData.progress_ms,
                                songLyrics: finalLyrics
                              });

                              var dbLyrics = '';
                              lyrics.forEach(function (line) {
                                dbLyrics += line
                              });
                              // Build Track document
                              var newTrack = {
                                name: currSongData.name,
                                artist: currSongData.artist,
                                artists: artists,
                                album: songData.album.name,
                                spotifyID: songData.id,
                                lyrics: dbLyrics
                              }
                              Track.create(newTrack, function (err, track) {
                                if (err) {
                                  console.log(err);
                                }
                              });
                            }
                          });
                        }
                      });
                    }
                  }
                });
              }
            });
          }
        }
      });
    })
    .catch(function (e) {
      console.log("[/l/update] ERROR: ", e);
    });
});

app.get('/l/error', function (req, res) {
  res.render('error');
});

app.get('/l/auth/spotify',
  passport.authenticate('spotify', {
    scope: [
      'user-read-email',
      'user-read-private',
      'user-read-playback-state'
    ],
    showDialog: true
  }),
  function (req, res) {
    // doesn't get called
  }
);

app.get('/l/login', function (req, res) {
  res.render('login');
});

app.get('/l/logout', function (req, res) {
  req.logout();
  res.redirect('/l/login');
});

app.get('*', function (req, res) {
  res.render('404');
});

app.listen(port, function () {
  console.log(`Listening on Port: ${port}`);
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', "Please login to Spotify first.");
  res.redirect('/l/login');
  console.log("--------------------------------------------------------");
  console.log('User not authenticated/logged in.');
  console.log("--------------------------------------------------------\n");

}