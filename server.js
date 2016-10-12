'use strict';

/**
 * Module dependencies.
 */
var express = require('express'),
  app = express(),
  http = require('http').createServer(app),
  path = require('path'),
  db = require('./db'),
  _ = require('lodash'),
  config = require('./config'),
  crypto = require('crypto'),
  request = require('request'),
  mongoose = require('mongoose'),
  expressValidator = require('express-validator'),
  bodyParser = require('body-parser'),
  rimraf = require("rimraf"),
  mkdirp = require("mkdirp"),
  multiparty = require('multiparty'),

  // paths/constants
  fileInputName = process.env.FILE_INPUT_NAME || "qqfile",
  uploadedFilesPath = 'store/uploads/',
  chunkDirName = "chunks",
  maxFileSize = process.env.MAX_FILE_SIZE || 0, // in bytes, 0 for unlimited
  fs = require('fs'),
  async = require('async');


app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + '/index.html'));
});


app.use(express.static(__dirname + '/store'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(expressValidator());

var server = http.listen(process.env.PORT || 3000, function() {
  console.log("Great! App is ready.");
});

var io = require('socket.io')(server);
io.on('connection', function(socket) {
  // whenever any user upload file
  socket.on('fileupload', function(userId) {
    // sending to all clients
    io.emit('upload', userId);
  });

  // user send play request
  socket.on('play', function(result) {
    //send play request to all clients
    io.emit('playgame', result);
  });

  socket.on('playfinished', function(result) {
    io.emit('playresult', result);
  });

  socket.on('reloadTV', function(res) {
    io.emit('refresh', res);
  })

  socket.on('uploadfinish', function(msg) {
      io.emit('uploaddone', msg);
    })
    // user send signup request
  socket.on('signup', function(msg) {
    //send play request to all clients
    io.emit('signupOnTV', msg);
  });
});

var user;
mongoose.connection.on('connected', function() {
  user = require('./user')(app);
});

app.route('/addUser')
  .post(function(req, res) {
    // entiries validations
    req.assert('firstname', 'Please enter a valid first name').notEmpty();
    req.assert('lastname', 'Please enter a valid last name').notEmpty();
    req.assert('email', 'Please enter a valid email address').isEmail();
    req.assert('date', 'Please enter a valid date of birth').notEmpty();
    req.assert('postal', 'Please enter a valid postal code').notEmpty();
    req.assert('overage', 'Please agree that you are 19 years of age or older.').equals('true');
    req.assert('notselfexcluded', 'Please indicate that you are not self excluded with OLG Slots & Casinos.').equals('true');
    req.assert('termsandconditions', 'Please agree to the terms and conditions.').equals('true');

    var errors = req.validationErrors();

    if (errors) {
      return res.status(400).send(errors);
    }

    async.auto({
      addUser: function(next) {
        user.addUser(req.body, function(err, user) {
          if (err) return next(err);
          next(null, user);
        });
      },
      sendApi: function(next) {
        var publicKey = config.api.publicKey;
        var privateKey = config.api.privateKey;

        var exampleData = [{
          'data_type': 'utf8text',
          'data_label': 'firstname',
          'data': req.body.firstname
        }, {
          'data_type': 'utf8text',
          'data_label': 'lastname',
          'data': req.body.lastname
        }, {
          'data_type': 'email',
          'data_label': 'email',
          'data': req.body.email
        }, {
          'data_type': 'utf8text',
          'data_label': 'postalcode',
          'data': req.body.postal
        }, {
          'data_type': 'utf8text',
          'data_label': 'dob',
          'data': req.body.date
        }, {
          'data_type': 'integer',
          'data_label': 'checkbox1',
          'data': req.body.overage ? '1' : '0'
        }, {
          'data_type': 'integer',
          'data_label': 'checkbox2',
          'data': req.body.permission ? '1' : '0'
        }, {
          'data_type': 'integer',
          'data_label': 'checkbox3',
          'data': req.body.notselfexcluded ? '1' : '0'
        }, {
          'data_type': 'integer',
          'data_label': 'checkbox4',
          'data': req.body.termsandconditions ? '1' : '0'
        }, {
          'data_type': 'integer',
          'data_label': 'checkbox5',
          'data': req.body.subscription ? '1' : '0'
        }, {
          'data_type': 'timestamp',
          'data_label': 'timestamp',
          'data': Math.round((new Date()).getTime() / 1000)
        }];

        var hash = crypto.createHmac('sha256', privateKey).update(JSON.stringify(exampleData)).digest('hex');
        // request({
        //   url: 'https://remote.wondermakr.com/wondersync/', //URL to hit
        //   method: 'POST',
        //   headers: {
        //     'X-Public': publicKey,
        //     'X-Hash': hash
        //   },
        //   form: {
        //     data: (encodeURIComponent(JSON.stringify(exampleData)))
        //   }
        // }, function(error, response, body) {
        //   if (error) {
        //     console.log(error);
        //   } else {
        //     console.log(response.statusCode, body);
        //   }
        // });
        next(null, 'sent');
      }
    }, function(err, results) {
      if (err) return res.status(500).send(err);
      res.send({
        user: results.addUser
      });
    });
  });

app.route('/getImages')
  .get(function(req, res) {
    user.getImages(req.query, function(err, images) {
      if (err) return res.status(500).send(err);
      res.send({
        images: images
      })
    })
  })

function getImageSlice(path, top, name, callback) {
  var imageMagick = require('gm').subClass({
    imageMagick: true
  });

  imageMagick(path)
    .autoOrient()
    .resize(980, 1200, "!")
    .write(path, function(err) {
      if (err) return callback(err);
      imageMagick(path)
        .crop(980, 400, 0, top)
        .write(name, function(err) {
          if (err) callback(err);
          callback(null);
        });
    })
}

function writeDBandAWS(_id, path, callback) {
  async.auto({
    getFileName: function(next) {
      user.getFileName(_id, function(err, name) {
        if (err) return next(err);
        next(null, name);
      });
    },
    cutImage: function(next) {
      async.auto({
        getTopSlice: function(next) {
          var name = 'store/uploads/' + _id + '_slice_top.jpg';
          getImageSlice(path, 0, name, function(err) {
            if (err) return next(err);
            next(null, name);
          });
        },
        getMiddleSlice: ['getTopSlice', function(next) {
          var name = 'store/uploads/' + _id + '_slice_middle.jpg';
          getImageSlice(path, 400, name, function(err) {
            if (err) return next(err);
            next(null, name);
          });
        }],
        getBottomSlice: ['getMiddleSlice', function(next) {
          var name = 'store/uploads/' + _id + '_slice_bottom.jpg';
          getImageSlice(path, 800, name, function(err) {
            if (err) return next(err);
            next(null, name);
          });
        }]
      }, function(err, results) {
        if (err) return next(err);
        next(null, results);
      })
    },
    updateUser: ['cutImage', 'getFileName', function(next, result) {
      user.updateUser(_id, path, result, function(err, data) {
        if (err) return next(err);
        next(null, 'done');
      });
    }]
  }, function(err, resss) {
    if (err) return callback(err);
    callback(null, 'done');
  });
}

app.post("/upload", onUpload);

function onUpload(req, res) {
  var form = new multiparty.Form();

  form.parse(req, function(err, fields, files) {
    var partIndex = fields.qqpartindex;
    // text/plain is required to ensure support for IE9 and older
    res.set("Content-Type", "text/plain");

    if (partIndex == null) {
      onSimpleUpload(fields, files[fileInputName][0], res, req.query._id);
    } else {
      onChunkedUpload(fields, files[fileInputName][0], res, req.query._id);
    }
  });
}

function onSimpleUpload(fields, file, res, id) {
  var uuid = fields.qquuid,
    responseData = {
      success: false
    };

  file.name = fields.qqfilename;

  if (isValid(file.size)) {
    moveUploadedFile(file, uuid, id, function() {
        responseData.success = true;
        res.send(responseData);
      },
      function() {
        responseData.error = "Problem copying the file!";
        res.send(responseData);
      });
  } else {
    failWithTooBigFile(responseData, res);
  }
}

function onChunkedUpload(fields, file, res, id) {
  var size = parseInt(fields.qqtotalfilesize),
    uuid = fields.qquuid,
    index = fields.qqpartindex,
    totalParts = parseInt(fields.qqtotalparts),
    responseData = {
      success: false
    };

  file.name = fields.qqfilename;

  if (isValid(size)) {
    storeChunk(file, uuid, index, totalParts, id, function() {
        if (index < totalParts - 1) {
          responseData.success = true;
          res.send(responseData);
        } else {
          combineChunks(file, uuid, id, function() {
              responseData.success = true;
              res.send(responseData);
            },
            function() {
              responseData.error = "Problem conbining the chunks!";
              res.send(responseData);
            });
        }
      },
      function(reset) {
        responseData.error = "Problem storing the chunk!";
        res.send(responseData);
      });
  } else {
    failWithTooBigFile(responseData, res);
  }
}

function failWithTooBigFile(responseData, res) {
  responseData.error = "Too big!";
  responseData.preventRetry = true;
  res.send(responseData);
}

function onDeleteFile(req, res) {
  var uuid = req.params.uuid,
    dirToDelete = uploadedFilesPath + uuid;

  rimraf(dirToDelete, function(error) {
    if (error) {
      console.error("Problem deleting file! " + error);
      res.status(500);
    }

    res.send();
  });
}

function isValid(size) {
  return maxFileSize === 0 || size < maxFileSize;
}

function moveFile(destinationDir, sourceFile, destinationFile, id, success, failure) {
  mkdirp(destinationDir, function(error) {
    var sourceStream, destStream;

    if (error) {
      console.error("Problem creating directory " + destinationDir + ": " + error);
      failure();
    } else {
      sourceStream = fs.createReadStream(sourceFile);
      destStream = fs.createWriteStream(destinationFile);

      sourceStream
        .on("error", function(error) {
          console.error("Problem copying file: " + error.stack);
          destStream.end();
          failure();
        })
        .on("end", function() {
          destStream.end();
          writeDBandAWS(id, destStream.path, function(err, result) {
            if (err) console.log(err);
            else success();
          });
        })
        .pipe(destStream);
    }
  });
}

function moveUploadedFile(file, uuid, id, success, failure) {
  var destinationDir = uploadedFilesPath + uuid + "/",
    fileDestination = destinationDir + file.name;

  moveFile(destinationDir, file.path, fileDestination, id, success, failure);
}

function storeChunk(file, uuid, index, numChunks, id, success, failure) {
  var destinationDir = uploadedFilesPath + uuid + "/" + chunkDirName + "/",
    chunkFilename = getChunkFilename(index, numChunks),
    fileDestination = destinationDir + chunkFilename;

  moveFile(destinationDir, file.path, fileDestination, id, success, failure);
}

function combineChunks(file, uuid, id, success, failure) {
  var chunksDir = uploadedFilesPath + uuid + "/" + chunkDirName + "/",
    destinationDir = uploadedFilesPath + uuid + "/",
    fileDestination = destinationDir + file.name;


  fs.readdir(chunksDir, function(err, fileNames) {
    var destFileStream;

    if (err) {
      console.error("Problem listing chunks! " + err);
      failure();
    } else {
      fileNames.sort();
      destFileStream = fs.createWriteStream(fileDestination, {
        flags: "a"
      });

      appendToStream(destFileStream, chunksDir, fileNames, 0, function() {
          rimraf(chunksDir, function(rimrafError) {
            if (rimrafError) {
              console.log("Problem deleting chunks dir! " + rimrafError);
            }
          });
          writeDBandAWS(id, destFileStream.path, function(err, result) {
            if (err) console.log(err);
            else success();
          });
        },
        failure);
    }
  });
}

function appendToStream(destStream, srcDir, srcFilesnames, index, success, failure) {
  if (index < srcFilesnames.length) {
    fs.createReadStream(srcDir + srcFilesnames[index])
      .on("end", function() {
        appendToStream(destStream, srcDir, srcFilesnames, index + 1, success, failure);
      })
      .on("error", function(error) {
        console.error("Problem appending chunk! " + error);
        destStream.end();
        failure();
      })
      .pipe(destStream, {
        end: false
      });
  } else {
    destStream.end();
    success();
  }
}

function getChunkFilename(index, count) {
  var digits = new String(count).length,
    zeros = new Array(digits + 1).join("0");

  return (zeros + index).slice(-digits);
}
