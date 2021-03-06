var fs = require('fs');
var _ = require('underscore');
var express = require('express');
var mongoose = require('mongoose');
var remoteStorage = require('./remoteStorage-node-debug');
var JSZip = require('node-zip');

var app = express();

var db = mongoose.createConnection.apply(mongoose, process.env.MONGOHQ_URL ? [process.env.MONGOHQ_URL] : ['localhost', 'rs-backup']);

var User;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {

  var mail = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  var url = /((http|https):\/\/(\w+:{0,1}\w*@)?(\S+)|)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;

  var userSchema = mongoose.Schema({
    mail: {
      type: String,
      match: mail
    },
    interval: {
      type: String,
      match: /1|4|12|24|84|168|336/
    },
    bearerToken: {
      type: String,
      required: true
    },
    storageHref: {
      type: String,
      match: url
    },
    storageType: {
      type: String,
      required: true
    }
  });
  User = db.model('User', userSchema);
});

var nodemailer = require('nodemailer');
var transport = nodemailer.createTransport('SMTP', {
  'service': 'Gmail',
  'auth': {
    'user': 'remotestore.backup@gmail.com',
    'pass': process.env.MAILPASS
  }
});

app.configure(function() {
  app.set('views', '');
  app.set('view options', {
    layout: false
  });
  app.engine('html', require('ejs').renderFile);
  app.use(express.bodyParser());
  app.use(express.static(__dirname));
  app.use(express.logger());
  app.use(express.compress());
});



app.get('/', function(req, res) {
  res.render('index.html');
});

app.post('/lookup', function(req, res) {
  var data = req.body;
  User.findOne(match(data), function(err, user) {
    if (user === null) return;
    data.mail = user.mail;
    data.interval = user.interval;
    res.send(data);
  });
});

app.post('/update', function(req, res) {
  var data = req.body;
  //TODO: validate data here
  User.findOne(match(data), function(err, doc) {
    var user = (doc === null) ? new User() : doc;

    user.mail = data.mail;
    user.interval = data.interval;
    user.storageHref = data.storageHref;
    user.storageType = data.storageType;
    user.bearerToken = data.bearerToken;
    user.save(function (err) {
      if (err) {
        res.send(500, 'We are sorry. Something went wrong.');
      } else {
        res.send(doc === null ?
          'Subscribtion was successful.'
        : 'Settings were successfully updated.'
        );
      }
    });
  });
});

app.post('/download', function(req, res) {
  getRemoteData({
    user: req.body,
    jsZipSettings: {base64: false, compression: 'DEFLATE'},
    cb: function(optn) {
      var file = 'tmp/rs-backup-' + new Date().toGMTString() + '.zip';
      fs.writeFile(file, optn.data, 'binary', function(err) {
        if (err) {
          console.log('Error writing file to tmp/', err);
          res.send(500);
          return;
        }
        res.send(encodeURIComponent(file));
      });
    }
  });
});

app.get('/files/:file', function(req, res) {
  var file = decodeURIComponent(req.params.file);
  res.download(file, function(err) {
    console.log((err ? 'download error: ' : 'download successfully!'), err);
    fs.unlink(file, function (err) {
      if (err) throw err;
      console.log('successfully deleted ' + file);
    });
  });
});

app.post('/leave', function(req, res) {
  var data = req.body;
  User.findOne(match(data), function(err, user) {
    if (user === null) {
      res.send(404, 'We are sorry. Something went wrong.');
      return;
    }
    user.remove(function(err) {
      if (err) {
        console.log(err);
        res.send(500, 'We are sorry. Something went wrong.');
      } else {
        res.send(200, 'Your data was successfully removed from rs-backup.');
      }
    });
  });
});


//only allow requests from SetCronJob
// var setCronJob = '10.66.17.22';

app.get('/cron', function(req, res) {
  console.log('ip: ', req.ip)
  // if (req.ip === setCronJob) {
    sendUpdates(req.query.interval);
    res.send(200);
  // } else {
    // res.send(403);
  // }
});

app.get('/reminder', function(req, res) {
  // if (req.ip === setCronJob) {
    remind('hi@jorin-vogel.com');
    res.send(200);
  // } else {
    // res.send(403);
  // }
});



function match(data) {
  return {
    storageHref: new RegExp('^'+data.storageHref+'$', "i"),
    bearerToken: new RegExp('^'+data.bearerToken+'$', "i")
  };
}

function sendUpdates(interval) {
  User.find({interval: interval}, function(err, users) {
    sendData(users);
  });
}

function sendData(users) {
  interate(users, function(user, next) {
    //TODO: zip data
    getRemoteData({
      user: user,
      cb: sendMail,
      next: next
    });

      next();
  });
}

function getRemoteData(optn) {
  remoteStorage.nodeConnect.setStorageInfo(optn.user.storageType, optn.user.storageHref);
  remoteStorage.nodeConnect.setBearerToken(optn.user.bearerToken);
  remoteStorage.claimAccess('root', 'r');
  remoteStorage.root.use('/');
  remoteStorage.fullSync(function() {
    optn.data = buildData(new JSZip(), '', '/').generate(optn.jsZipSettings);
    remoteStorage.flushLocal();
    optn.cb(optn);
  });
}

function buildData(zip, base, path) {
  _.each(remoteStorage.root.getListing(base + path), function(childPath) {
    var isDir = path.charAt(path.length - 1) === '/';
    if (isDir) {
      // console.log('BUILD: folder - '+childPath.slice(0, -1));
      var folder = zip.folder(childPath.slice(0, -1));
      buildData(folder, base + path, childPath);
    } else {
      // console.log('BUILD: file - '+path+' - '+JSON.stringify(remoteStorage.root.getObject(base + path)));
      zip.file(path, JSON.stringify(remoteStorage.root.getObject(base + path)));
    }
  });
  return zip;
}

function sendMail(optn) {
  var d = new Date();
  var date = d.toDateString() + ' - ' + d.toLocaleTimeString();
  var name = 'rs-backup ' + date + '.zip';
    transport.sendMail({
        from: 'rs backup <remotestore.backup@gmail.com>',
        to: optn.user.mail,
        subject: 'rs backup at ' + date,
        html:
          "Here is the remoteStorage backup for " + optn.user.storageHref + ". \
          To change your settings go to <a href=\"http://rs-backup.herokuapp.com\">rs-backup.herokuapp.com</a>.",
        generateTextFromHTML: true,
        attachments: [{
          fileName: name,
          contents: new Buffer(optn.data, "base64")
        }]
    }, function(error, response) {
      if (error) {
        console.log('Send mail failure: ', error);
      } else {
        console.log("Message sent: " + response.message);
      }
    });
}

function interate(arr, fn) {
  var i = 0, l = arr.length;
  function next() {
    if (i < l) {
      fn(arr[i++], next);
    }
  }
  next();
}

function remind(mail) {
  transport.sendMail({
      from: "rs backup <remotestore.backup@gmail.com>",
      to: mail,
      subject: 'Reminder',
      html: 'Watch out your SetCronJob account is about to expire!<br>' +
            'Go to <a href="https://www.setcronjob.com/">setcronjob.com/</a> and renew your account',
      generateTextFromHTML: true
  }, function(error, response) {
    if (error) {
      console.log('err: ', error);
    } else {
      console.log("Message sent: " + response.message);
    }
  });
}



var port = process.env.PORT || 3000;
app.listen(port);
console.log('Listening on port ', port);