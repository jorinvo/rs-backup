$(function() {

  var $mail = $('#mail');
  var $selectedInterval = $('#selected-interval');
  var $intervals = $('#intervals').find('li');
  var $current = $intervals.filter('.active');
  var $download = $('#download');
  var $leave = $('#leave');
  var $submit = $('#submit');
  var $success = $('#success');
  var $error = $('#error');
  var $controlGroup = $('#control-group');
  var $introLink = $('#intro-link');
  var $backupLink = $('#backup-link');

  remoteStorage.onWidget('ready', function() {
    showView('backup');
    $backupLink.show();
    $.post('lookup', getData(), function(res) {
      if (res) {
        $mail.val(res.mail);
        $intervals.removeClass('active');
        //TODO: select current interval
        $leave.removeClass('disabled');
        $submit.text('update');
      }
    });
  });

  remoteStorage.onWidget('state', function(state) {
    if(state === 'disconnected') {
      showView('intro');
      $backupLink.hide();
      clear();
    }
  });

  remoteStorage.claimAccess({'root':'rw'});
  remoteStorage.displayWidget('remotestorage-connect');
  // remoteStorage.util.silenceAllLoggers();
  // remoteStorage.root.setOnChange(console.log);
  // remoteStorage.root.use('/');

  $('#brand').click(function() {
    showView('intro');
  });

  $introLink.click(function() {
    showView('intro');
  });

  $backupLink.click(function() {
    showView('backup');
  });

  $mail.keyup(function() {
    $controlGroup[validMail() ? 'removeClass' : 'addClass']('error');
  });

  $intervals.click(function(e) {
    e.preventDefault();
    $intervals.removeClass('active');
    $current = $(e.currentTarget);
    $current.addClass('active');
    $selectedInterval.text($current.text());
  });

  $submit.click(function() {
    if (!validMail()) {
      error('Please use a valid mail adress.');
      return;
    }
    $.ajax({
      type: 'POST',
      url: '/update',
      data: getData(),
      success: function(res) {
        $leave.removeClass('disabled');
        success(res);
        $submit.text('update');
      },
      error: function(res) {
        error(res);
      }
    });
  });

  $download.click(function() {
    //TODO: implement download
  });

  $leave.click(function() {
    if ($leave.hasClass('disabled')) return;
    $.ajax({
      type: 'POST',
      url: '/leave',
      data: getData(),
      success: function(res) {
        clear();
        success(res);
        $leave.addClass('disabled');
      },
      error: function(res) {
        error(res);
      }
    });
  });

  function showView(view) {
    if (view === 'intro') {
      $backupLink.removeClass('active');
      $introLink.addClass('active');
      $('.container').removeClass('right');
    } else if ( view === 'backup') {
      $introLink.removeClass('active');
      $backupLink.addClass('active');
      $('.container').addClass('right');
    }
  }

  function getData(what) {
    var data = {
      //TODO: remove line as soon as bearer token works
      bearerToken: '4eb4b398c36e62da87469133e2f0cb3f9574d5b3865051',
      // bearerToken: remoteStorage.getBearerToken(),
      storageHref: remoteStorage.getStorageHref()
    };
    if (what === 'all') {
      data.mail = $mail.val();
      data.interval = $current.find('a').attr('href').slice(1);
    }
    return data;
  }

  function clear() {
    $mail.val('');
    $intervals
      .removeClass('active')
      .eq(3)
      .addClass('active');
    $selectedInterval.text('daily');
    $submit.text('subscribe');
  }

  function success(msg) {
    $success.text(msg);
    $error.hide();
    $success.show();
  }

    function error(msg) {
    $error.text(msg);
    $success.hide();
    $error.show();
  }

  var mailRegEx = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  function validMail() {
    return mailRegEx.test($mail.val());
  }

});