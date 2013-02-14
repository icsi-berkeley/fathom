var callbackFn = function (o, fn) {
  if(o && o["error"])
    fn(o["error"]);
  else {
    var status = o.exitstatus;
    var out = o.stdout;
    var err = o.stderr;
    if(err)
      return;
    else
      fn(out);
  }
  o = fn = null;
}

var logger = new mLog();
var log = function() {
	logger.log.apply(logger, arguments);
}
var print = function() {
	logger.print.apply(logger, arguments);
}
var logText = function() {
	return logger.text.apply(logger, arguments);
}

function loadTest(sURL) {
	var retval = null;
	try {    
		var oRequest = new XMLHttpRequest();
		oRequest.open("GET", sURL, false);
		oRequest.overrideMimeType('text/plain');
		oRequest.send(null);

		if (oRequest.status === 0) {
			retval = eval(oRequest.responseText);
		}
	} catch (e) {
		alert(e + " :: " + sURL);
	}
    return retval;
}

