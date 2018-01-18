var mongoose = require('mongoose');

var trackSchema = new mongoose.Schema({
  spotifyID: String,
  name: String,
  artist: String,
  album: String,
  lyrics: String,
  featuredArtists: [{
    type: String
  }]
});

module.exports = mongoose.model('Track', trackSchema);