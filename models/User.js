var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
  spotifyID: String,
  accessToken: String,
  refreshToken: String,
});

module.exports = mongoose.model('User', userSchema);