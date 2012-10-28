$(function() {


  remoteStorage.onWidget('ready', function() {
    console.log('ready')
    $('.container').addClass('right');
  });

  remoteStorage.onWidget('state', function(state) {
    console.log('state', state)
    if(state == 'disconnected') {
    }
  });

  remoteStorage.displayWidget('remotestorage-connect');
  remoteStorage.util.silenceAllLoggers();
});