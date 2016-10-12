'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  crypto    = require('crypto'),
  config = require('./config'),
  _   = require('lodash'),
  db = {};

/*
 * For injection attacks
 */
var escapeProperty = function(value) {
  return _.escape(value);
};

/*
 * Email validation
 */
var validateUniqueEmail = function(value, callback) {
  var User = mongoose.model('User');
  User.find({
    $and: [{
      email: value
    }, {
      _id: {
        $ne: this._id
      }
    }]
  }, function(err, user) {
    callback(err || user.length === 0);
  });
};

// User model
var UserSchema = new Schema({
  firstname: {
    type: String,
    required: true,
    get: escapeProperty
  },
  lastname: {
    type: String,
    required: true,
    get: escapeProperty
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/, 'Please enter a valid email'],
    validate: [validateUniqueEmail, 'E-mail address is already in-use']
  },
  winnerIndex: {
    type: Number,
    default: 0
  },
  subscription: {
    type: Boolean,
    default: false
  },
  permission: {
    type: Boolean,
    default: false
  },
  postal: String,
  date: Date,
  createdAt: Date,
  image: {
    name: String,
    sliceTop: String,
    sliceMiddle: String,
    sliceBottom: String
  }
});

mongoose.model('User', UserSchema);
mongoose.connect(config.database.host, config.database.name, function(err) {
  if (err) {
    console.log('Could not connect to database: ' + err);
    process.exit(1);
  }
});
