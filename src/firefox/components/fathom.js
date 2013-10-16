/* -*- mode: javascript; js-indent-level: 2; js-expr-indent-offset: 2; -*-
 * ***** BEGIN LICENSE BLOCK *****
 *
 * Copyright (c) 2011-2012 International Computer Science Institute (ICSI).
 * All rights reserved.
 *
 * See LICENSE for license and terms of usage. 
 *
 * ***** END LICENSE BLOCK *****
 */

/* this is for Android debugging */
var old_dump = dump;
var dump = function (msg) {
	old_dump("Fathom: " + msg);
}

var client_policy = null;
var this_nsprfile = null;
Components.utils.import("resource://gre/modules/AddonManager.jsm");
AddonManager.getAddonByID("fathom@icir.org", function (addon) {
	var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
	var uri = addon.getResourceURI("content/libs/" + os + "/libnspr4.so");
	if (uri instanceof Components.interfaces.nsIFileURL) {
		this_nsprfile = uri.file;
		Logger.info("nspr4 location: " + this_nsprfile.path);
	}
});

const Ci = Components.interfaces;
const Cc = Components.classes;

const EXTENSION_ID = "fathom@icir.org";

Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/* Load modules required for fathom.proto namespace */
Components.utils.import("resource://fathom/http.jsm");
Components.utils.import("resource://fathom/DNS/dns.jsm");

Components.utils.import("resource://fathom/libParse.jsm");

var GlobalFathomObject = null;

var workerFactory = null;

/*
 * FathomService keeps track of preferences, loads our own modules once they
 * become available, and handles other administrative work.
 */
function FathomService() {
  this.wrappedJSObject = this;
}

FathomService.prototype = {
  classDescription : "Fathom JavaScript XPCOM Component",
  classID : Components.ID("{0e524489-5086-4791-b0c8-99fd7f3f76be}"),
  contractID : "@icir.org/fathom-service;1",
  _xpcom_categories : [ {
    category : "profile-after-change"
  } ],
  QueryInterface : XPCOMUtils.generateQI([ Ci.nsIFathom, Ci.nsIObserver ]),

  /* Factory that creates a singleton instance of the component */
  _xpcom_factory : {
    createInstance : function() {
      if (FathomService.instance == null) {
        FathomService.instance = new FathomService();
      }
      return FathomService.instance;
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // Internal Data
  // /////////////////////////////////////////////////////////////////////////

  _initialized : false,
  _profileAfterChangeCompleted : false,

  _prefService : null,
  _rootPrefs : null,

  _requestObservers : [],

  _prefNameToObjectMap : null,

  _compatibilityRules : [],
  _topLevelDocTranslationRules : [],

  _uninstall : false,

  // /////////////////////////////////////////////////////////////////////////
  // Utility
  // /////////////////////////////////////////////////////////////////////////

  _init : function() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    try {
      this._loadLibraries();
      this._register();
      this._initializePrefSystem();
      // Note that we don't load user preferences at this point because the user
      // preferences may not be ready. If we tried right now, we may get the
      // default preferences.
    } catch (e) {
      Logger.error("exception from _init(): " + e);
    }
  },

  _syncFromPrefs : function() {
    // Load the logging preferences before the others.
    this._updateLoggingSettings();
  },

  _updateLoggingSettings : function() {
    Logger.enabled = this.prefs.getBoolPref("log");
    Logger.level = this.prefs.getIntPref("log.level");
  },

  _registerAddonListener : function() {
    const fathomSrvc = this;
    var addonListener = {
      onDisabling : function(addon, needsRestart) {
        if (addon.id != EXTENSION_ID) {
          return;
        }
        Logger.debug("Addon set to be disabled.");
        fathomSrvc._uninstall = true;
      },
      onUninstalling : function(addon, needsRestart) {
        if (addon.id != EXTENSION_ID) {
          return;
        }
        Logger.debug("Addon set to be uninstalled.");
        fathomSrvc._uninstall = true;
      },
      onOperationCancelled : function(addon, needsRestart) {
        if (addon.id != EXTENSION_ID) {
          return;
        }
        Logger.debug("Addon operation cancelled.");
        // Just because an operation was cancelled doesn't mean there isn't
        // a pending operation we care about. For example, a user can choose
        // disable and then uninstall, then clicking "undo" once will cancel
        // the uninstall but not the disable.
        var pending = addon.pendingOperations
            & (AddonManager.PENDING_DISABLE | AddonManager.PENDING_UNINSTALL);
        if (!pending) {
          Logger.debug("No pending uninstall or disable.");
          fathomSrvc._uninstall = false;
        }
      }
    };
    AddonManager.addAddonListener(addonListener);
  },

  _register : function() {
    var os = Cc['@mozilla.org/observer-service;1']
        .getService(Ci.nsIObserverService);
    os.addObserver(this, "xpcom-shutdown", false);
    os.addObserver(this, "profile-after-change", false);
    os.addObserver(this, "quit-application", false);
    this._registerAddonListener();
  },

  _unregister : function() {
    try {
      var os = Cc['@mozilla.org/observer-service;1']
          .getService(Ci.nsIObserverService);
      os.removeObserver(this, "xpcom-shutdown");
      os.removeObserver(this, "profile-after-change");
      os.removeObserver(this, "quit-application");
    } catch (e) {
      Logger.dump(e + " while unregistering.");
    }
  },

  _shutdown : function() {
    this._unregister();
  },

  _initializePrefSystem : function() {
    // Get the preferences branch and setup the preferences observer.
    this._prefService = Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefService);

    this.prefs = this._prefService.getBranch("extensions.fathom.")
        .QueryInterface(Ci.nsIPrefBranch2);
    this.prefs.addObserver("", this, false);

    this._rootPrefs = this._prefService.getBranch("").QueryInterface(
      Ci.nsIPrefBranch2);
  },

  /*
   * Take necessary actions when preferences are updated.
   * 
   * prefName Name of the preference that was updated.
   */
  _updatePref : function(prefName) {
    switch (prefName) {
    case "log":
    case "log.level":
      this._updateLoggingSettings();
      break;
    default:
      break;
    }
  },

  _loadLibraries : function() {
    //workerFactory = Cc["@mozilla.org/threads/workerfactory;1"]
    //.createInstance(Ci.nsIWorkerFactory);

    var modules = ["Logger.jsm"];
    for (var i in modules) {
      filename = modules[i];
      try {
        Components.utils.import("resource://fathom/" + filename);
      } catch (e) {
        // Indicate the filename because the exception doesn't have that
        // in the string.
        var msg = "Failed to load module " + filename + ": " + e;
        
        // TODO: catch errors from here and _init and, if detected, set a
        // flag that the extension is broken and indicate that to the user.
        throw msg;
      }
    }
    Components.utils.import("resource://gre/modules/AddonManager.jsm");
  },

  // /////////////////////////////////////////////////////////////////////////
  // nsIFathom interface
  // /////////////////////////////////////////////////////////////////////////

  prefs : null,

  // /////////////////////////////////////////////////////////////////////////
  // nsIObserver interface
  // /////////////////////////////////////////////////////////////////////////

  observe : function(subject, topic, data) {
    switch (topic) {
    case "nsPref:changed":
      this._updatePref(data);
      break;
    case "profile-after-change":
      this._init();
      // "profile-after-change" means that user preferences are now
      // accessible. If we tried to load preferences before this, we would get
      // default preferences rather than user preferences.
      this._syncFromPrefs();
      break;
    case "xpcom-shutdown":
      this._shutdown();
      break;
    case "quit-application":
      if (this._uninstall) {
        this._handleUninstallOrDisable();
      }
      break;
    default:
      Logger.error("uknown topic observed: " + topic);
    }
  }

};

/**
 * FathomAPI provides the objects that are added to DOM windows. A separate
 * FathomAPI object is created for each window and then the value returned
 * from the init() function is added to the window's properties.
 */
function FathomAPI() {
  this.chromeworkers = {};
  this.requests = {};
  this.nextrequestid = 1;
  this.socketworkermap = {};
  this.nextsocketid = 1;
  this.scriptworkers = {};
  this.nextscriptid = 1;
  this.commands = {};
  this.allowed_destinations = [];
  this.nsprfile = null; // Path to NSPR shared lib on this system
  client_policy = [];
}

FathomAPI.prototype = {

  classID: Components.ID("{b5f42951-9a05-47ee-8fa8-bb7a16e48335}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDOMGlobalPropertyInitializer,
                                         Ci.nsIObserver]),

  // /////////////////////////////////////////////////////////////////////////
  // Internal data and utilities
  // /////////////////////////////////////////////////////////////////////////

  chromeworkers : null,
  requests : null,
  nextrequestid : null,
  socketworkermap : null,
  nextsocketid : null,
  scriptworkers : null,
  nextscriptid : null,
  commands : null,
  allowed_destinations : null,
  nsprfile : null,

  // TODO: register a listener for window close which calls this.
  //shutdown: function () {
  //  Logger.info('shutdown called');
  //  worker.postMessage({action: 'shutdown'});
  //  // TODO: do other cleanup.
  //},

  // A shortcut for instantiating a local file object.
  _getLocalFile : function(path) {
    var file = Components.classes['@mozilla.org/file/local;1']
        .createInstance(Components.interfaces.nsILocalFile);

    if (path) {
      try {
	file.initWithPath(path);
      } catch (exc) {
	Logger.info("Local file init exception on '" + path + "': " + exc);
	return null;
      }
    }
    
    return file;
  },

  _initChromeWorker : function _initChromeWorker(workername, workerscript) {

    //var worker = workerFactory.newChromeWorker("chrome://fathom/content/workers/" + workerscript + ".js");
    var worker = new ChromeWorker("chrome://fathom/content/workers/" + workerscript + ".js");
    // Tack the name on for logging purposes.
    worker.name = workername;
    try {
      worker.onerror = function(event) {
        msg = event.message + ' [' + event.filename + ':' + event.lineno + ']';
        Logger.error('Worker error: ' + msg);
      };

      const fathomapi = this;
      worker.onmessage = function(event) {
        var data = JSON.parse(event.data);
        
        if (typeof(data.logmsg) != "undefined") {
          Logger.info("ChromeWorker: " + data.logmsg);
          return;
        }

        var result = data.result;
        var requestid = data.requestid;
        var requestinfo = fathomapi.requests[requestid];
        Logger.info('Received response for requestid: ' + requestid);

        if (!requestinfo) {
          Logger.warning('Received response from worker for unknown requestid: ' + requestid);
        } else {

        // TODO: possibly make sure the worker is the one we expect (the one
        // stored in the requestinfo).
        try {
          if(result) {
		      // TODO: call the callback async using setTimeout.
	    var exp = {};
		      for(var props in result) {
//		        result["__exposedProps__"][props] = "r";
			exp[props] = "r";
		      }
		      result["__exposedProps__"] = exp;

		  }
		  requestinfo['callback'](result);
        } catch (e) {
          // TODO: decide on a good way to send this error back to the document.
          Logger.warning('Error when calling user-provide callback: ' + e);
	  Logger.error(e.stack);
        }
	}

        if ((requestinfo && !requestinfo['multiresponse']) || 
	    (result && result['done'])) 
	{
          delete fathomapi.requests[requestid];
        }

	// Anna: adding a way to clean things up inside fathom
	// if the worker closes itself
	if (result && result['closed']) {
	  // the worker has closed itself, remove any references
	  // so this worker object gets garbage collected
	  delete fathomapi.chromeworkers[workername];
          Logger.info('Worker closed: ' + workername);
	}
      };

      Components.utils.import("resource://gre/modules/Services.jsm");
      Components.utils.import("resource://gre/modules/ctypes.jsm");

      if (! this.nsprfile) {
	// Try to locate the NSPR library file. We do this only once
	// and remember the result. It usually, but not always, lives
	// in the XulRunner runtime directory. We try others too. In
	// Fedora 16 as of Feb'12 nspr.so sits in /lib64 or /lib.
	this.nsprfile = this._getLocalFile();

	var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
	var libd = "LibD";
	if(os == "Android" || os == "Linux")
		libd = "LibD";
	else if (os == "Darwin")
		libd = "ULibDir";
	else if(os == "WINNT")
		libd = "CurProcD";

	// Anna: Firefox 22 folds nspr4 to libnss3, detect the version
	var libname = "nspr4";
	var xulAppInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
	var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);
	Logger.info("platformversion: " + xulAppInfo.platformVersion);
	Logger.info("appversion: " + xulAppInfo.version);
	if(versionChecker.compare(xulAppInfo.version, "22.0") >= 0) {
	  // running under Firefox 22.0 or later
	  // TODO: check the correct name for windows!
	  libname = "nss3";
	  Logger.info("libName: " + libname);
	}
  
	var found = false;
	if (os !== "Android") {
	  var dirs = [Services.dirsvc.get("GreD", Ci.nsILocalFile),
		      Services.dirsvc.get(libd, Ci.nsILocalFile)];
	  if (os == "Linux") {
	    dirs.push(this._getLocalFile('/lib64'));
	    dirs.push(this._getLocalFile('/lib'));
	  }
	  for (var i in dirs) {
	    if (! dirs[i])
	      continue;
	    Logger.info("nspr4 candidate dir: " + dirs[i].path);
	    if (! dirs[i].exists())
	      continue;
	    this.nsprfile = dirs[i].clone();
	    this.nsprfile.append(ctypes.libraryName(libname));
	    if (this.nsprfile.exists()) {
	      found = true;
	      break;
	    }
	  }
	} else {
	  // FIXME: figure out how android names the apks, at least -1 and -2
	  // seen on test devices...
	  for (var j = 1; j < 3; j++) {
	    try {
              var nsprFile = this._getLocalFile();
	      nsprFile.initWithPath("/data/app/org.mozilla.firefox-"+j+".apk");
	      Logger.info("nspr4 candidate path: " + nsprFile.path);
	      if (nsprFile.exists()) {
		this.nsprfile = this._getLocalFile();
		if(versionChecker.compare(xulAppInfo.version, "24.0") >= 0) {
		  // Starting from 24.0 the libs are moved to another directory ..
		  this.nsprfile.initWithPath("/data/app/org.mozilla.firefox-"+j+".apk!/assets/lib"+libname+".so");
		} else {
		  this.nsprfile.initWithPath("/data/app/org.mozilla.firefox-"+j+".apk!/lib"+libname+".so");
		}
		found = true;
		break;
	      }
	    } catch (e) {
	      dump(e);
	      continue;
	    }
	  }
	}
	if (!found) {
	  // XXX Flag somehow to the user that we cannot find the NSPR
	  // library. --cpk
	  //throw "Cannot find NSPR.";
	  
          // fallback on the packaged file
          this.nsprfile = this_nsprfile;
	}

	Logger.info("nspr4 location: " + this.nsprfile.path);
      }

      var system = {};
      
      system.arch = Components.classes["@mozilla.org/xre/app-info;1"]
          .getService(Components.interfaces.nsIXULRuntime)
          .XPCOMABI;
      
      system.os = Components.classes["@mozilla.org/xre/app-info;1"]
          .getService(Components.interfaces.nsIXULRuntime)
          .OS;
      
      var obj = {'init' : true, 'nsprpath' : this.nsprfile.path,
		 'nsprname' : libname,  
		 'arch' : system.arch, 'os' : system.os};
      worker.postMessage(JSON.stringify(obj));
    } catch (exc) {
      worker.terminate();
      throw exc;
    }
    this.chromeworkers[workername] = worker;
  },

  _performRequest : function _performRequest(worker, callback, action, args, multiresponse) {

    var requestid = this.nextrequestid++;
    this.requests[requestid] = {worker : worker, callback : callback,
                                multiresponse : multiresponse};

    Logger.info('Performing request for action: ' + action + ' (requestid: ' +
                requestid + ', worker: ' + worker.name + ')');

    var obj = {action: action, requestid: requestid, args: args};
    worker.postMessage(JSON.stringify(obj));
  },

  doNonSocketRequest : function doNonSocketRequest(callback, action, args, multiresponse) {
    
    if (!this.securityCheck())
      return;  

    var multiresponse = multiresponse || false;
    
    var workername = 'nonsocketworker';
    var workerscript = 'chromeworker';
    if (!this.chromeworkers[workername]) {
      this._initChromeWorker(workername, workerscript);
    }
    var worker = this.chromeworkers[workername];

    this._performRequest(worker, callback, action, args, multiresponse);
  },

  doSocketUsageRequest : function doSocketUsageRequest(callback, action, args, multiresponse) {
    
    if (!this.securityCheck())
      return;  	
    
    // Assume socketid will be the first argument.
    var socketid = args[0];
    if (!socketid) {
      Logger.info("Expected socket as the first argument.");
      // TODO: call callback async.
      callback({error:"Expected socket as the first argument.", __exposedProps__: { error: "r" }});
      return;
    }

    Logger.info("Looking up socket " + socketid + " for action " + action);
//    var worker = this.socketworkermap[socketid];
    var worker = this.chromeworkers['socketworker'+socketid];
    if (!worker) {
      Logger.info("Could not find the worker for this socket.");
      // TODO: call callback async.
      callback({error:"Could not find the worker for this socket.", __exposedProps__: { error: "r" }});
      return;
    }

    this._performRequest(worker, callback, action, args, multiresponse);
  },

  /*
   * Each socket gets its own worker (thread). This function will create a new
   * worker and will intercept the callback to the user code in order to
   * provide the socketid (assigned here, not in the chromeworker) back to the
   * user as well as to do some accounting so that future requests for this
   * same socketid can be invoked on the same chromeworker.
   */
  doSocketOpenRequest : function doSocketOpenRequest(callback, action, args) {
    
    if (!this.securityCheck())
      return;
    
    var socketid = this.nextsocketid++;
    var workername = 'socketworker' + socketid;
    var workerscript = 'chromeworker';
    this._initChromeWorker(workername, workerscript);
    var worker = this.chromeworkers[workername];

//    const socketmap = this.socketworkermap;
    function socketRegistrationCallback(result) {
      if (result && !result['error']) {
//        socketmap[socketid] = worker;
        Logger.info("Registered socket worker " + worker.name + " for socketid " + socketid);
        callback(socketid);
      } else {
        result["__exposedProps__"] = { error: "r" };
        Logger.info("Socket open request failed, not registering socket worker: " + worker.name);
        callback(result);
      }
    }

    this._performRequest(worker, socketRegistrationCallback, action, args);
  },

  /*
   * Anna: same as above but return the id to the client right away without
   * callbacks.
   */
  doSyncSocketOpenRequest : function doSyncSocketOpenRequest(callback, action, args, multiresponse) {    
    if (!this.securityCheck())
      return;

    var multiresponse = multiresponse || false;
    var socketid = this.nextsocketid++;
    var workername = 'socketworker' + socketid;
    var workerscript = 'chromeworker';
    this._initChromeWorker(workername, workerscript);
    var worker = this.chromeworkers[workername];
//    this.socketworkermap[socketid] = worker;
    this._performRequest(worker, callback, action, args, multiresponse);
    return socketid;
  },

  _initScriptWorker : function _initScriptWorker(sourcecode, dataOutFunc, errorFunc) {
    
    if (!this.securityCheck())
      return;
    
    // On at least Fx 9 and Fx 12, this fails to load. There may be security restrictions
    // being enforced, but Firefox is not very helpful and only says "Failed to load script".
    // One solution may be to read the script into a string, create a Blob from it,
    // create an object url from that, and pass the object url instead of the chrome url.
    // See here for an example:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=701345
    // (Note: I also tried using a resource url and that had the same error.)

    // Anna: does not work on Firefox 22 - throws SecurityError
    var worker = this.window.Worker("chrome://fathom/content/workers/scriptworker.js");

    try {
      // This should only be called for bugs in our code, not the executing
      // fathom script. For errors in the fathom script (and also for some
      // bugs in our code), we'll just call the registered errorFunc.
      worker.onerror = function(event) {
        msg = event.message + ' [' + event.filename + ':' + event.lineno + ']';
        Logger.error('Script worker error: ' + msg);
      };

      const window = this.window;
      const fathomapi = this;

      worker.onmessage = function(event) {
        var data = JSON.parse(event.data);
        var action = data.action;

        if (action == 'dataOut') {
          // TODO: sanitize/copy data.
          var sanitizeddata = data.data;
          
          // The first arg is the 'this' context for the function. We call it
          // with the scope being the window object of the window we're executing
          // this script for. The second argument is the first argument to the
          // function we're calling.
          dataOutFunc.call(window, sanitizeddata);
        } else if (action == 'errorOut') {
          // TODO: sanitize/copy data.
          var sanitizeddata = data.data;

          Logger.error(sanitizeddata);

          // The first arg is the 'this' context for the function. We call it
          // with the scope being the window object of the window we're executing
          // this script for. The second argument is the first argument to the
          // function we're calling.
          if (errorFunc) {
            errorFunc.call(window, sanitizeddata);
          }
        } else {
          // Note: this is a requestid that is meaningful to the script. It's
          // not the same as a the requestid that is used by _newRequest().
          var requestid = data.requestid;
          var requesttype = data.requesttype;
          var multiresponse = data.multiresponse;
          var callback = function (result) {
            var obj = {action: 'response', requestid: requestid, result: result};
            worker.postMessage(JSON.stringify(obj));
          };
          var args = data.args;

          if (requesttype == "SOCKET_OPEN_REQUEST") {
            fathomapi.doSocketOpenRequest(callback, action, args, multiresponse);
          } else if (requesttype == "SOCKET_USAGE_REQUEST") {
            fathomapi.doSocketUsageRequest(callback, action, args, multiresponse);
          } else if (requesttype == "NON_SOCKET_REQUEST") {
            fathomapi.doNonSocketRequest(callback, action, args, multiresponse);
          } else {
            Logger.error("Unrecognized requesttype: " + requesttype);
          }
        }
      };


      // TODO: now that we figured out we need to manually JSON.stringify()
      // objects we pass to postMessage for this worker, we should make the
      // argument a stringified object with an 'init' property.
      worker.postMessage(sourcecode);
    } catch (exc) {
      worker.terminate();
      throw exc;
    }

    var dataInFunc = function (scriptid, data) {
        // TODO: sanitize/copy data.
        var sanitizeddata = data;

        // We get a "could not clone object" error when trying to pass anything
        // but a string as the arguement to this postMessage call. So, we
        // convert to JSON and parse the JSON on the other side.
        // Somewhat related (though this is for ChromeWorkers):
        // https://bugzilla.mozilla.org/show_bug.cgi?id=667388
        var obj = {dataIn: sanitizeddata};
      var worker = this.scriptworkers[scriptid];
        worker.postMessage(JSON.stringify(obj));
      };


    var scriptid = this.nextscriptid++;
    this.scriptworkers[scriptid] = worker;
    var self = this;
    return {scriptid: scriptid, 
	    dataIn: dataInFunc.bind(self), 
	    __exposedProps__ : { dataIn : "r",
			       scriptid : "r"}
	   };
  },

  /*
   * We listen for "inner-window-destroyed" which means this window will never
   * be used again, even for history navigation. However, we still need to deal
   * with the case where the page is frozen and put in the back-forward cache.
   * In that situation, scripts will continue executing from where they were.
   * Also, the page in the bfcache can still be interacted with as long as the
   * interaction is initiated externally (afaict). So, its own timers won't run
   * but any callbacks from that page which get called should run.
   *
   * More info on the back-forward cache:
   * https://developer.mozilla.org/En/Working_with_BFCache
   *
   * So, what should we do with open sockets when a page is put in the bfcache?
   * Just leaving any fathom scripts running and sockets open seems like a bad
   * idea for the user because of the chance of such running code eating up
   * bandwidth, CPU, and memory without the user having any indication this is
   * still happening or a way to stop it. The best solution is probably for
   * concerned pages to listen for pagehide/pageshow events and take action
   * accordingly. For example, when the page gets a pagehide event it can
   * close sockets, record the time at which it is stopping the measurements it
   * was doing, and generally stop using fathom. Then, when the page gets a
   * pageshow event, it can open up whatever sockets it wants to open and
   * continue its measurements. However, enforcing this by cleaning up the
   * page's fathom state on pagehide events may be messy.
   *
   * For now, there's some commented out code in init() which adds a listener
   * for pagehide that in turn calls shutdown().
   */
  observe : function(subject, topic, data) {
    switch (topic) {
    case "inner-window-destroyed":
      try{
		  var windowID = subject.QueryInterface(Ci.nsISupportsPRUint64).data;
		  var innerWindowID = this.window.QueryInterface(Ci.nsIInterfaceRequestor).
		      getInterface(Ci.nsIDOMWindowUtils).currentInnerWindowID;
		  if (windowID == innerWindowID) {
		    Logger.info("Calling shutdown()");
		    this.shutdown("inner-window-destroyed");
		    delete this.window;
		    Services.obs.removeObserver(this, "inner-window-destroyed");
		  }
	  } catch(e) {
	  	dump("Inner-window-destroyed: " + e);
	  }
      break;
    default:
      Logger.error("uknown topic observed: " + topic);
    }
  },

  /*
   * The shutdown function should clean up any state that couldn't be
   * automatically garbage collected but it should also leave the fathom
   * instance in a working state. The reason fathom still needs to work is that
   * we are using shutdown() to also handle the case where the page is
   * navigated away from (i.e. pagehide) rather than being completely closed.
   * If the user goes back/forward in their history to this same page, we want
   * fathom to work the same as if the page had first loaded.
   */
  shutdown : function(cause) {
    try {
      var util = this.window.QueryInterface(Ci.nsIInterfaceRequestor).
          getInterface(Ci.nsIDOMWindowUtils);
      var windowid = util.currentInnerWindowID;
      Logger.debug(cause + " :: shutdown() called for window: " + windowid);
    } catch (e) {
      Logger.error("Failed to log shutdown() message: " + e);
    }

    var jsonobj = JSON.stringify({action: 'shutdown'});

    // With the requests object reset, from this moment on we will not call the
    // page's callbacks for any pending requests that complete.
    this.requests = {};

    this.socketworkermap = {};
	
    for (var name in this.chromeworkers) {
      Logger.info("[shutdown] Sending shutdown message to chromeworker: " + name);
      this.chromeworkers[name].postMessage(jsonobj);
      delete this.chromeworkers[name];
    }

    for (var name in this.scriptworkers) {
      Logger.info("[shutdown] Sending shutdown message to scriptworkers: " + name);
      this.scriptworkers[name].postMessage(jsonobj);
      delete this.scriptworkers[name];
    }

    for (var name in this.commands) {
      // TODO: may want to do process killing and file deletion async.
      if (this.commands[name].process.isRunning) {
        Logger.info("[shutdown] Killing command process: " + name + " (" +
		    this.commands[name].cmd + " " + this.commands[name].args + ")");
        try {
          // TODO: This is only killing the wrapper process, not the process
          // started by the wrapper (which is really what we want to kill).
          this.commands[name].process.kill();
        } catch (e) {
          Logger.warning("Failed to kill process: " + e);
          continue;
        }
      }
      if (this.commands[name].outfile.exists()) {
        this._deleteFile(this.commands[name].outfile);
      }
      if (this.commands[name].errfile.exists()) {
        this._deleteFile(this.commands[name].errfile);
      }
      delete this.commands[name];
    }
  },

  _getTempDirObj : function() {
    var dirservice = Cc["@mozilla.org/file/directory_service;1"]
        .getService(Ci.nsIProperties); 
    return dirservice.get("TmpD", Ci.nsIFile);
  },

  _readFile : function(fileobj, datacallback) {
    NetUtil.asyncFetch(fileobj, function(inputStream, status) {
      if (!Components.isSuccessCode(status)) {
        datacallback({error: 'reading file failed: ' + status, __exposedProps__: { error: "r" }});
        return;
      }

      try {
        var data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
      } catch (e) {
        if (e.name == "NS_BASE_STREAM_CLOSED") {
          // The file is empty.
          data = "";
        } else {
          //Logger.info("Failed reading file " + fileobj.path + " : " + e);
          datacallback({error: e, __exposedProps__: { error: "r" }});
          return;
        }
      }
      datacallback(data);
      try {
		  fileobj.remove(false);
		} catch (e) {
		  Logger.warning("Unable to delete file " + fileobj.path + " : " + e);
		}
    });
  },

  _deleteFile : function(fileobj) {
    try {
      fileobj.remove(false);
    } catch (e) {
      Logger.warning("Unable to delete file " + fileobj.path + " : " + e);
    }
  },
  
  _writeCommandWrapper : function() {
    // Write the wrapper if it doesn't exist.
    // TODO: We should probably do this once the first time fathom is used in
    // each session and only worry about cleaning up the wrapper file when
    // fathom is uninstalled.
    // Note that here we are writing the file syncronously on the main thread
    // which is something we generally shouldn't be doing.
    var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
    if (os == "WINNT") {
      var wrappername = "cmdwrapper.bat";
      var wrapperlines = ['@ECHO OFF',
                          'set errorlevel=',
                          '%3 %4 %5 %6 %7 %8 %9 > %~s1 2> %~s2',
                          'exit /b %errorlevel%'];
      var wrappercontents = wrapperlines.join('\r\n') + '\r\n';

		var dirservice = Cc["@mozilla.org/file/directory_service;1"]
				.getService(Ci.nsIProperties); 
			var profdir = dirservice.get("TmpD", Ci.nsIFile);
			var wrapperfile = profdir.clone();
		
		wrapperfile.append(wrappername);
		var foStream = Cc["@mozilla.org/network/file-output-stream;1"].
		    createInstance(Ci.nsIFileOutputStream);
		// write, create, truncate
		foStream.init(wrapperfile, 0x02 | 0x08 | 0x20, 0755, 0); 

		// "if you are sure there will never ever be any non-ascii text in data you
		// can  also call foStream.writeData directly" --- To be safe, we'll use
		// the converter.
		var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].
		    createInstance(Components.interfaces.nsIConverterOutputStream);
		converter.init(foStream, "UTF-8", 0, 0);
		converter.writeString(wrappercontents);
		converter.close(); // this also closes foStream

		var wrappername = "hidecmd.js";
		var wrapperlines = [	'var dir = WScript.ScriptFullName.replace(/[\\/\\\\]+[^\\/\\\\]*$/, "");',
					'var Shell = WScript.CreateObject("Wscript.Shell");',
					'Shell.CurrentDirectory = dir;',
					'var objArgs = WScript.Arguments;',
					'var arg = "";',
					'for(var i = 0; i < objArgs.length; i++) {',
					'	arg = arg + " " + objArgs(i);',
					'}',
					'Shell.Run("cmdwrapper.bat " + arg, 0, true);'];

		var wrappercontents = wrapperlines .join('\r\n') + '\r\n';

    } else if (os == "Linux" || os == "Android" || os == "Darwin") {
      wrappername = "cmdwrapper.sh";
      wrapperlines = ['#!/bin/sh',
                      'OUTFILE="$1"',
                      'ERRFILE="$2"',
                      'shift',
                      'shift',
                      '$@ >"$OUTFILE" 2>"$ERRFILE"'];
      wrappercontents = wrapperlines.join('\n') + '\n';
    } else {
      throw 'Unhandled OS: ' + os;
    }

	/*if(os == "Android") {
		var wrapperfile = this._getLocalFile("/storage/sdcard0/Fathom/");
	} else*/ {
		var dirservice = Cc["@mozilla.org/file/directory_service;1"]
		    .getService(Ci.nsIProperties); 
		var profdir = dirservice.get("TmpD", Ci.nsIFile);
		var wrapperfile = profdir.clone();
    }
    wrapperfile.append(wrappername);
    var foStream = Cc["@mozilla.org/network/file-output-stream;1"].
        createInstance(Ci.nsIFileOutputStream);
    // write, create, truncate
    foStream.init(wrapperfile, 0x02 | 0x08 | 0x20, 0755, 0); 

    // "if you are sure there will never ever be any non-ascii text in data you
    // can  also call foStream.writeData directly" --- To be safe, we'll use
    // the converter.
    var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].
        createInstance(Components.interfaces.nsIConverterOutputStream);
    converter.init(foStream, "UTF-8", 0, 0);
    converter.writeString(wrappercontents);
    converter.close(); // this also closes foStream

    return wrapperfile.path;
  },
  
  _getCommandWrapperPath : function() {
    if (!this.cmdwrapperpath) {
      this.cmdwrapperpath = this._writeCommandWrapper()
    }
    return this.cmdwrapperpath;
  },

  _executeCommandAsync : function(callback, cmd, args, incrementalCallback) {
    
    if (!this.securityCheck())
      return; 
    
    var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
    
    if (!args) {
      args = []; 
    } else {
      // TODO: make sure args is an array
      if (args.length > 4) {
        throw 'At the moment you cannot pass more than 4 arguments to a command';
      }
    }

    var commandid = Math.random().toString();

	/*if(os == "Android")
		var tmpdir = this._getLocalFile("/storage/sdcard0/Fathom/");
	else*/
	    var tmpdir = this._getTempDirObj();
    var outfile = tmpdir.clone()
    outfile.append('fathom-command.' + commandid + '.out');
    var errfile = tmpdir.clone()
    errfile.append('fathom-command.' + commandid + '.err');

//    Logger.debug("outfile: " + outfile.path);
//    Logger.debug("errfile: " + errfile.path);

    const fathomapi = this;

    var observer = {
      observe: function(subject, topic, data) {
        if (topic != "process-finished" && topic != "process-failed") {
          dump("\n" + 'Unexpected topic observed by process observer: ' + topic + "\n");
          throw 'Unexpected topic observed by process observer: ' + topic;
        }
        
        var exitstatus = subject.exitValue;

        function handleOutfileData(outdata) {
        	 function handleErrfileData(errdata) {
           	try {
	             callback({exitstatus: exitstatus, stdout: outdata, stderr: errdata, __exposedProps__: { exitstatus: "r", stdout: "r", stderr: "r" }});
    	        callback = null;
    	        incrementalCallback = false;
    	    } catch(e) {
    	    	dump("\n" + "Error executing the callback function: " + e + "\n");
    	    }
          }
          try{
          	fathomapi._readFile(errfile, handleErrfileData);
          	//fathomapi._deleteFile(errfile);
		  } catch(e) {
		  }
	  	  // kill the process          
          try{
          	if (subject.isRunning) {
	    		subject.kill();
	  	  	}
	  	  } catch (e) {
    			dump("\n" + "Failed to kill process: " + e + "\n");
      			Logger.warning("Failed to kill process: " + e);
    	  }
        }

		try{
	        fathomapi._readFile(outfile, handleOutfileData);
        	//fathomapi._deleteFile(outfile);
        } catch(e) {
        }
      }
    };

    var wrapperpath = this._getCommandWrapperPath();
    var wrapperfile = this._getLocalFile(wrapperpath);

    var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    if(os == "Android") {
    	// get sh executable
		var shPath = this._getLocalFile("/system/bin/");
		var sh = shPath.clone();
		sh.append('sh');
		process.init(sh);
    } else
	    process.init(wrapperfile);

    /*this.commands[commandid] = {process:process, cmd:cmd, args:args,
      outfile:outfile, errfile:errfile};*/

	if(os == "Android")
		var wrapperargs = [wrapperfile.path, outfile.path, errfile.path, cmd].concat(args);
	else
    	var wrapperargs = [outfile.path, errfile.path, cmd].concat(args);

    process.runAsync(wrapperargs, wrapperargs.length, observer);

	/* incremental output for traceroute */
	if(incrementalCallback == true) {
		var file = FileUtils.getFile("TmpD", [outfile.leafName]);
	
		var index = 0, timeout = 250, count = 120;
		var event = {  
		  observe: function(subject, topic, data) {  
			index++;
			if (index >= count || !incrementalCallback)
			  timers.cancel();
			try{
				NetUtil.asyncFetch(file, function(inputStream, status) {
				  if (!Components.isSuccessCode(status)) {  
					// Handle error!  
					return;  
				  }  
				  
				  // The file data is contained within inputStream.  
				  // You can read it into a string with  
				  var outdata = NetUtil.readInputStreamToString(inputStream, inputStream.available());
				  //dump(outdata);
				  callback({exitstatus: null, stdout: outdata, stderr: null, __exposedProps__: { exitstatus: "r", stdout: "r", stderr: "r" }});
				});
			}catch(e){
				dump("\n" + "Error executing the NetUtil.asyncFetch callback function: " + e + "\n");
			}
		  }  
		}  
		var timers = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);  
		const TYPE_REPEATING_PRECISE = Components.interfaces.nsITimer.TYPE_REPEATING_PRECISE;  
	
		timers.init(event, timeout, TYPE_REPEATING_PRECISE);
	}

  },
  
  /*
   * Before any API invocation, a security check is performed to determine if 
   * the call is allowed or not. Currently, the API call is allowed if the
   * extension is activated and the user has given permission for the specific
   * website. The API call will fail if the extension is not activated or the
   * invoking domain is not whitelisted by the user.
   */
  securityCheck: function () {

    // jsamuel: disabling securityCheck as I believe we're now using a different
    // approach than this.
    return true;

    var prompt = Cc["@mozilla.org/embedcomp/prompt-service;1"]  
	.getService(Ci.nsIPromptService);
    var loc = this.window.location;
    
    // if this API has been invoked from extension code, e.g from SysUtils.jsm
    // then do not perform any security check, just return.
    if (loc.protocol == "chrome:" || loc == "about:blank") {
      //prompt.alert(null, "", "Location = " + loc);
      return true;
    }

    try {
      // jsamuel: I would need to be convinced that using localStorage here is
      // secure. This should be documented to indicate why a webpage can't just
      // write to localStorage to bypass this check. For now, I'm going to
      // assume this wasn't meant to be secure but just to demo the security
      // check functionality.
      var localStorage = this.window.localStorage;
      var prefFathom = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);

      if (!prefFathom.getBoolPref("extensions.fathom.status")) {
	// if the extension is temporarily disabled then return false
	return false;
      } else if (localStorage.getItem("enableFathom") == "true") {
	// if the user has already whitelisted the host then return immediately
	return true;
      } else {
	// the default of check is false so that the user must explicitly whitelist 
	var check = {value: false};
	
	var result = prompt.confirmCheck(null, "Script requesting use of Fathom" +
					 " APIs", "A script on this page is requesting use of Fathom APIs. You" +
					 " can stop the script now or allow the script to use Fathom APIs.",
					 "Always enable for " + loc, check);

	if (check.value) {
	  // if check value is true, then store this info in the whitelist
	  localStorage.setItem("enableFathom", true);
	}
	
	return result;
      }
    } catch (e) {
      return false;
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // API
  // /////////////////////////////////////////////////////////////////////////

  /*
   * The object returned from the init method is the object lazily added to
   * each web page. The init() method accepts an nsIDOMWindow argument which
   * provides access to the window.
   */
  init: function (aWindow) {
    let self = this;
    this.window = XPCNativeWrapper.unwrap(aWindow);

    try {
      var util = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).
	  getInterface(Ci.nsIDOMWindowUtils);
      var windowid = util.currentInnerWindowID;
      Logger.debug("init() called for window: " + windowid + " (" +
		   this.window.document.location.href + ")");
    } catch (e) {
      Logger.error("Failed to log init() message: " + e);
    }

    // It's possible to have init() called more than once for the same window.
    // I don't have a reliable test for this, but I was able to do it killing
    // Firefox, doing a "start new session" at the restore tabs screen,
    // clicking "back" to go back to the restore session page and again
    // clicking "start new session". Doing this over and over again resulted in
    // init() sometimes being called for the same window id.
    if (!this.window.fathominitialized) {
      this.window.fathominitialized = true;
      Services.obs.addObserver(this, "inner-window-destroyed", false);

      // A pagehide event is where the user navigates away from the page but it
      // is still in the bfcache. We clean up all fathom resources when the page
      // is hidden. If sites using fathom want to handle this gracefully, they
      // should also listen for pagehide events.
      function onPageHide(aEvent) {
        try{
        	if (aEvent.originalTarget instanceof Ci.nsIDOMHTMLDocument) {
            var doc = aEvent.originalTarget;
            Logger.dump("page hidden:" + doc.location.href);
            self.shutdown("pagehide");
          }
        } catch(e) {
        	dump("PAGEHIDE: " + e);
        }
      }
      this.window.addEventListener("pagehide", onPageHide, false);
    } else {
      Logger.debug("init() called on window that has already been initialized");
    }

   	gFathomObject.obj = GlobalFathomObject = this.fullapi = {

      proto: {
      	http: {
      		create : self.proto.http.create.bind(self),
      		open : self.proto.http.open.bind(self),
      		send : self.proto.http.send.bind(self),
      		receive : self.proto.http.receive.bind(self),
      		getCertificateChain: self.proto.http.getCertificateChain.bind(self),
      		__exposedProps__: {
		      create: "r",
		      open: "r",
		      send: "r",
		      receive: "r",
		      getCertificateChain: "r"
	      }
      	},
      
	dns: {
    	open : self.proto.dns.open.bind(self),
		lookup : self.proto.dns.lookup.bind(self),
		// lower APIs to build higher functionality
		create: self.proto.dns.create.bind(self),
		query: self.proto.dns.query.bind(self),
		response: self.proto.dns.response.bind(self),
		sendRecv: self.proto.dns.sendRecv.bind(self),
		__exposedProps__: {
		  open: "r",
          lookup: "r",
          create: "r",
          query: "r",
          response: "r",
          sendRecv: "r"
        }
	},
	
	tcpspeaker: {
	  client: {
            open : self.proto.tcpspeaker.client.open.bind(self),
            __exposedProps__: {
		      open: "r"
	      }
	  },
	  server: {
      	    open : self.proto.tcpspeaker.server.open.bind(self),
      	    __exposedProps__: {
		      open: "r"
	      }
	  },
	  __exposedProps__: {
		      client: "r",
		      server: "r"
	      }
	},     

	upnp: {
          open : self.proto.upnp.open.bind(self),
          __exposedProps__: {
		      open: "r"
	      }
	},
    __exposedProps__: {
          dns: "r",
          http: "r",
          tcpspeaker: "r",
          upnp: "r",
        }
      },

      script: {
      	loadURL : self.script.loadURL.bind(self),
        run : self.script.run.bind(self),
        __exposedProps__: {
		      loadURL: "r",
		      run: "r"
	      }
      },

      socket: {
	broadcast: {
          openSendSocket : self.socket.broadcast.openSendSocket.bind(self),
          openReceiveSocket : self.socket.broadcast.openReceiveSocket.bind(self),
          closeSocket : self.socket.broadcast.closeSocket.bind(self),
          send : self.socket.broadcast.send.bind(self),
          receive : self.socket.broadcast.receive.bind(self),
          __exposedProps__: {
		      openSendSocket: "r",
		      openReceiveSocket: "r",
		      closeSocket: "r",
		      send: "r",
		      receive: "r"
	      }
	},
	
	multicast: {
          openSendSocket : self.socket.multicast.openSendSocket.bind(self),
          openReceiveSocket : self.socket.multicast.openReceiveSocket.bind(self),
          closeSocket : self.socket.multicast.closeSocket.bind(self),
          send : self.socket.multicast.send.bind(self),
          receive : self.socket.multicast.receive.bind(self),
          receiveDetails : self.socket.multicast.receiveDetails.bind(self),
          __exposedProps__: {
		      openSendSocket: "r",
		      openReceiveSocket: "r",
		      closeSocket: "r",
		      send: "r",
		      receive: "r",
		      receiveDetails: "r"
	      }
	},	

	tcp: {
          openSendSocket : self.socket.tcp.openSendSocket.bind(self),
          openReceiveSocket : self.socket.tcp.openReceiveSocket.bind(self),
          acceptstart : self.socket.tcp.acceptstart.bind(self),
          acceptstop : self.socket.tcp.acceptstop.bind(self),
          closeSocket : self.socket.tcp.closeSocket.bind(self),
          send : self.socket.tcp.send.bind(self),
          receive : self.socket.tcp.receive.bind(self),
          getHostIP : self.socket.tcp.getHostIP.bind(self),
          getPeerIP : self.socket.tcp.getPeerIP.bind(self),
          __exposedProps__: {
		      openSendSocket: "r",
		      openReceiveSocket: "r",
		      acceptstart: "r",
		      acceptstop: "r",
		      closeSocket: "r",
		      send: "r",
		      receive: "r",
		      getHostIP: "r",
		      getPeerIP: "r"
	      }
	},
	
	udp: {
          open : self.socket.udp.open.bind(self),
          bind : self.socket.udp.bind.bind(self),
          close : self.socket.udp.close.bind(self),
          connect : self.socket.udp.connect.bind(self),
          send : self.socket.udp.send.bind(self),
          recv : self.socket.udp.recv.bind(self),
          sendrecv : self.socket.udp.sendrecv.bind(self),
          recvstart : self.socket.udp.recvstart.bind(self),
          recvstop : self.socket.udp.recvstop.bind(self),
          sendto : self.socket.udp.sendto.bind(self),
          recvfrom : self.socket.udp.recvfrom.bind(self),
          recvfromstart : self.socket.udp.recvfromstart.bind(self),
          recvfromstop : self.socket.udp.recvfromstop.bind(self),
          setsockopt : self.socket.udp.setsockopt.bind(self),
		  netprobe : self.socket.udp.netprobe.bind(self),
		  getHostIP : self.socket.udp.getHostIP.bind(self),
		  getPeerIP : self.socket.udp.getPeerIP.bind(self),
		  __exposedProps__: {
		      open: "r",
		      bind: "r",
		      close: "r",
		      connect: "r",
		      send: "r",
		      recv: "r",
		      sendrecv: "r",
		      recvstart: "r",
		      recvstop: "r",
		      sendto: "r",
		      recvfrom: "r",
		      recvfromstart: "r",
		      recvfromstop: "r",
		      setsockopt: "r",
//			  netprobe: "r", (disabling - anna)
			  getHostIP: "r",
			  getPeerIP: "r",
	      }
	    },
	    __exposedProps__: {
			tcp: "r",
		    udp: "r",
		    multicast: "r",
		    broadcast: "r"
	    }
      },
      
      system: {
        doTraceroute : self.system.doTraceroute.bind(self),
        doPing : self.system.doPing.bind(self),
        getWifiInfo : self.system.getWifiInfo.bind(self),
        getNameservers : self.system.getNameservers.bind(self),
        getHostname : self.system.getHostname.bind(self),
        getActiveInterfaces : self.system.getActiveInterfaces.bind(self),
        getActiveWifiInterfaces : self.system.getActiveWifiInterfaces.bind(self),
        getArpCache : self.system.getArpCache.bind(self),
        getProxyInfo : self.system.getProxyInfo.bind(self),
        getBrowserMemoryUsage : self.system.getBrowserMemoryUsage.bind(self),
        getEndHostInfo : self.system.getEndHostInfo.bind(self),
        getRoutingTable : self.system.getRoutingTable.bind(self),
        getIfaceStats : self.system.getIfaceStats.bind(self),
        getWifiStats : self.system.getWifiStats.bind(self),
        getLoad : self.system.getLoad.bind(self),
        getMemInfo: self.system.getMemInfo.bind(self),
        getLastKnownInterface: self.system.getLastKnownInterface.bind(self),
	
		win: {
          getCpuLoad : self.system.win.getCpuLoad.bind(self),
          getProcLoad : self.system.win.getProcLoad.bind(self),
          getMemLoad : self.system.win.getMemLoad.bind(self),
          __exposedProps__: {
		      getCpuLoad: "r",
		      getProcLoad: "r",
		      getMemLoad: "r",
		    }
        },
        __exposedProps__: {
		    doTraceroute: "r",
		    doPing: "r",
			getWifiInfo: "r",
			getNameservers: "r",
			getHostname: "r",
			getActiveInterfaces: "r",
			getActiveWifiInterfaces: "r",
			getArpCache: "r",
			getProxyInfo: "r",
			getRoutingTable: "r",
			getIfaceStats: "r",
			getWifiStats: "r",
			getLoad: "r",
			getMemInfo: "r",
			//getLastKnownInterface: "r",
			getEndHostInfo: "r",
			win: "r"
		}
      },
      
      util: {
        baseline : self.util.baseline.bind(self),
        insertTables : self.util.insertTables.bind(self),
        updateTables : self.util.updateTables.bind(self),
      	hostIP : self.util.hostIP.bind(self),
        log : self.util.log.bind(self),
        os : self.util.os.bind(self),
      	systemInfo : self.util.systemInfo.bind(self),
      	processNextEvent: self.util.processNextEvent.bind(self),
        test : self.util.test.bind(self),
		
		timer: {
          init : self.util.timer.init.bind(self),
          __exposedProps__: {
          	init: "r"
          }
		},
		__exposedProps__: {
          baseline: "r",
          //insertTables: "r",
          //updateTables: "r",
          hostIP: "r",
          log: "r",
          os: "r",
          systemInfo: "r",
      	  //processNextEvent: "r",
          test: "r"
        }	
      },

      // Anna: ported network measurement tools
      // adding a separate module to keep things clean
      tools: {
	iperf : self.tools.iperf.bind(self),
	iperfStop : self.tools.iperfStop.bind(self),
//	ping : self.tools.ping.bind(self),
//	traceroute : self.tools.traceroute.bind(self),
	__exposedProps__: {
          iperf: "r",
          iperfStop: "r",
	}
      },
      
      // Temporary location for deprecated APIs
      depr: {
      },
    };
    
    //var Application = Components.classes["@mozilla.org/fuel/application;1"].getService(Components.interfaces.fuelIApplication);
    //Application.storage.set("gFathomObject", GlobalFathomObject);

    this.api = {

      init : self.misc.fathominit.bind(self),

      proto: {},
      script: {},
      socket: {},
      system: {},
      util: {},
      tools: {},

      depr: {},

      __exposedProps__: {
        init: "r",
        devtest: "r", // XXX What's this --cpk

	proto: "r",
	script: "r",
	socket: "r",
	system: "r",
	util: "r",
	tools: "r"
      }
    };

	/*
	 * parse client policy
	 */
	var data = "";
	 
	try {
		var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
		file.append("client_policy.xml");
	
		var fstream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
		var cstream = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
		fstream.init(file, -1, 0, 0);
		cstream.init(fstream, "UTF-8", 0, 0);

		let (str = {}) {
			let read = 0;
			do { 
				read = cstream.readString(0xffffffff, str);
				data += str.value;
			} while (read != 0);
		}
		cstream.close();
	} catch (e) {
//		dump(e);
		Logger.info("No client policy available.");
	}
	
	var lines = data.split("\n");
	for(var i = 0; i < lines.length - 1; i++) {
		var line = lines[i];
		var items = line.split(" ");
		var allow = (items[0].trim() == "<allow-api-access-from");
		var domain = items[1].split("=")[1].trim().split('"')[1].trim();
		var api_list = items[2].split("=")[1].trim().split("/>")[0].split('"')[1].trim();
		var apis = api_list.split(",");
		var api = [];
		for(var k = 0; k < apis.length; k++)
			api.push(apis[k].trim());
		dump(allow + " : " + domain + " : " + api + "\n");
		client_policy[domain] = [allow, api];
	}

    return this.api;
  },

  checkDestinationPermissions : function (callback, requested_destination) {
  
    // Check if this is already known to be an allowed destination.
    for (var i = 0; i < this.allowed_destinations.length; i++) {
      destination = this.allowed_destinations[i];
      if (destination == requested_destination) {
        callback({});
        return;
      }
    }

	function getIP() {
	  var file = FileUtils.getFile("ProfD", ["baseline_endhost.sqlite"]);
	  var db = Services.storage.openDatabase(file);
	  
	  var data = "";
	  
	  try {
		var q1 = "SELECT * FROM endhost ORDER BY id DESC LIMIT 1";
	  	var statement = db.createStatement(q1);
	    if (statement.executeStep()) {
	      data = statement.getString(1);
	    }
	  } catch(e) {
		dump(e);
	  } finally {
		statement.reset();
	  }

	  if (data && data.length > 0) {
	    try{
	      // get the top most entry in the db
	      return JSON.parse(data).interface.ip;
	    } catch(e) {
	    }
	  }
	  return null;
	}

    /*function getIP() {
	  var obj = GlobalFathomObject.util.baseline("traffic");
	  var traffic = obj;
	  var len = traffic.length;

	  if(!len)
			return '';

	  if(traffic[len-1].interface == null)
			return '';

	  return traffic[len-1].ip;
	}*/
	
	var dnsService = Cc["@mozilla.org/network/dns-service;1"].createInstance(Ci.nsIDNSService);
	var selfhostname = dnsService.myHostName;
	try {
		var selfIP = dnsService.resolve(selfhostname, Ci.nsIDNSService.RESOLVE_CANONICAL_NAME).getNextAddrAsString();
	} catch (e) {
		selfIP = null;
	}
	var hostIP = getIP();

	function parseManifest(data) {
		var lines = data.trim().split("\n");
		for(var i = 0; i < lines.length - 1; i++) {
			var line = lines[i];
			var items = line.split(" ");
			var allow = (items[0].trim() == "<allow-access-from");
			var domain = items[1].split("=")[1].trim().split('"')[1].trim();
			//dump(allow + " :: " + domain + " :: " + selfIP + " :: " + selfhostname + "\n");
			if(domain == hostIP || domain == selfIP || domain == selfhostname)
				return allow;
		}
		// use the action on the security dialog
		return true;
	}

    var url = 'http://' + requested_destination + '/fathom.xml';
    let self = this;

	// this enables chrome scripts to bypass this restriction
  	//dump("\nWindow url == " + this.window.content.location.href + "\n");
	var src = this.window.content.location.href;
	if (this.window.content instanceof Ci.nsIDOMWindow && 
			(src.substring(0, 9) == "chrome://" || //src.substring(0, 7) == "file://" ||
			this.window.content.document.documentURI.match(/^about:neterror/) ||
			this.window.content.document.documentURI.match(/^about:certerror/))) {
		self.allowed_destinations.push(requested_destination);
        callback({});
        return;
	}

    function stateChanged() {
      try {
        if (req.readyState === 4) {
          if (req.status === 200) {
            Logger.info("Successfully downloaded " + url);
            // For now we consider it a success if fathom.json exists.
            // TODO: check the contents of fathom.json.
            dump("\n" + req.responseText);
            if(parseManifest(req.responseText)) {
            	self.allowed_destinations.push(requested_destination);
            	callback({});
            } else {
            	dump("Error: Host " + requested_destination + " is not an allowed destination.");
            	callback({error:"Host " + requested_destination + " is not an allowed destination.", __exposedProps__: { error: "r" }});
            }
          } else {
            // For now, considering this a success so that we don't break
            // experiments people are working on at the moment.
            Logger.info("Failed to download " + url);
            callback({error:"Host " + requested_destination + " is not an allowed destination.", __exposedProps__: { error: "r" }});
            // TODO: don't consider a failure to be a success.
            //self.allowed_destinations.push(requested_destination);
            //callback({});
          }
        }
      } catch(e) {
        Logger.error("Error while checking " + url + ": " + e.description);
        callback({error:"Error while checking " + url + ": " + e.description, __exposedProps__: { error: "r" }});
      }
    }

    var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
        .createInstance(Components.interfaces.nsIXMLHttpRequest);
    req.onreadystatechange = stateChanged;
    req.open("GET", url);
    req.send(null);
  },

  // TODO: stop passing socketid to the worker in all requests. Now that we
  // are using a separate worker for each socket, the worker already knows
  // which file descriptor to use for any socket actions.

  misc: {
    fathominit : function (callback, manifest, win) {
      
      var requested_apis = [];
      if (manifest && manifest['api']) {
        for (let i in manifest['api']) {
          apiname = manifest['api'][i];
          let parts = apiname.split('.');
          if (parts.length != 2 || !parts[0] || !parts[1]) {
            callback({'error': "Invalid API format in manifest: " + apiname, __exposedProps__: { error: "r" }});
          }
          if (!this.fullapi[parts[0]]) {
            callback({'error': "Unknown API module in manifest: " + parts[0], __exposedProps__: { error: "r" }});
          }
          if (parts[1] == '*') {
            //this.api[parts[0]] = this.fullapi[parts[0]];
          } else {
            if (!this.fullapi[parts[0]][parts[1]]) {
              callback({'error': "Unknown API function in manifest: " + apiname, __exposedProps__: { error: "r" }});
            }
            //this.api[parts[0]][parts[1]] = this.fullapi[parts[0]][parts[1]];
          }
          requested_apis.push([parts[0], parts[1]]);
        }
      }
      // TODO: are hostnames (including wildcard subdomains) only useful as
      // destinations if we either:
      //   a) do a DNS lookup right now and assume they'll stay the same, or
      //   b) provide higher-level APIs that allow tcp/udp by hostname where
      //      we check the hostname is allowed and then do the dns lookup
      //      ourselves?
      var requested_destinations = [];
      if (manifest && manifest['destinations']) {
        for (let i in manifest['destinations']) {
          // TODO: sanitize/validate destinations
          // TODO: We should allow:
          // * IPv4 addresses and ranges
          // * IPv6 addresses and ranges
          // * hostnames
          // * hostnames with wildcard subdomains
          // * what about specific ports?
          destination = manifest['destinations'][i];
          requested_destinations.push(destination);
        }
      }
      var windowargs = {
      	host: this.window.content.location.host, 
        url: this.window.content.location.href,
        callback: callback,
        requested_apis: requested_apis,
        requested_destinations: requested_destinations,
        api: this.api,
        fullapi: this.fullapi,
        allowed_destinations: this.allowed_destinations,
      };
      windowargs.wrappedJSObject = windowargs;
      
      if (win) {
	// do not show the dialog box for baseline measurements
	var src = win.location.href;
	if (win instanceof Ci.nsIDOMWindow && (src == "about:blank" ||
						win.document.documentURI.match(/^about:neterror/) ||
						win.document.documentURI.match(/^about:certerror/) ||
				  	      src.substring(0, 9) == "chrome://")) {
	  var requested_apis = windowargs['requested_apis'];
	  var api = windowargs['api'];
	  var fullapi = windowargs['fullapi'];
	  
	  for (var i=0; i<requested_apis.length; i++) {
	    var apimodule = requested_apis[i][0];
	    var apifunc = requested_apis[i][1];
	    if (apifunc == '*') {
	      api[apimodule] = fullapi[apimodule];
	    } else {
	      api[apimodule][apifunc] = fullapi[apimodule][apifunc];
	    }
	  }
	  
	  // enable some specific apis for chrome:// and about:error pages only
	  // TODO: check on android
	  // system
	  api["system"]["__exposedProps__"]["getEndHostInfo"] = "r";
	  api["system"]["__exposedProps__"]["getLastKnownInterface"] = "r";
	  // util
	  api["util"]["__exposedProps__"]["insertTables"] = "r";
	  api["util"]["__exposedProps__"]["updateTables"] = "r";
	  api["util"]["__exposedProps__"]["processNextEvent"] = "r";
	  
	  return;
	}
      }

      // need to check for fathom status
      var prefFathom = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
      if (!prefFathom.getBoolPref("extensions.fathom.status")) {
	// if the extension is temporarily disabled then return false
	return;
      }
      
      var api_flag = true;
      // check for client policy
      (function() {
      
      	var api = windowargs['api'];
		var fullapi = windowargs['fullapi'];
      	var host = windowargs.host ? windowargs.host : windowargs.url;
		
		var requested_policy_apis = [];
		for(var domain in client_policy) {
			var str = "." + domain;
			var re = new RegExp(str, "ig");
			if(host.match(re)) {
				dump("Matched == " + host + " :: " + domain);
				// get the apis
				var policy_apis = client_policy[domain][1];
				for (let i = 0; i < policy_apis.length; i++) {
					apiname = policy_apis[i];
					let parts = apiname.split('.');
					if (parts.length != 2 || !parts[0] || !parts[1]) {
						callback({'error': "Invalid API format in manifest: " + apiname, __exposedProps__: { error: "r" }});
					}
					if (!fullapi[parts[0]]) {
						callback({'error': "Unknown API module in manifest: " + parts[0], __exposedProps__: { error: "r" }});
					}
					if(parts[1] == '*') {
						//this.api[parts[0]] = this.fullapi[parts[0]];
					} else {
						if (!fullapi[parts[0]][parts[1]]) {
							callback({'error': "Unknown API function in manifest: " + apiname, __exposedProps__: { error: "r" }});
						}
						//this.api[parts[0]][parts[1]] = this.fullapi[parts[0]][parts[1]];
					}
					requested_policy_apis.push([parts[0], parts[1]]);
				}
				
				// fix the apis
				var allow = client_policy[domain][0];
				for (var i=0; i<requested_policy_apis.length; i++) {
					var apimodule = requested_policy_apis[i][0];
					var apifunc = requested_policy_apis[i][1];
					dump("\n" + apimodule + " :: " + apifunc)
					if (apifunc == '*') {
					  api[apimodule] = (allow ? fullapi[apimodule] : null);
					} else {
					  api[apimodule][apifunc] = (allow ? fullapi[apimodule][apifunc] : null);
					}
				}
			}
		}

		/* if all manifest apis are covered then do nothing, else invoke the security dialog for the requested apis */
		for(var j = 0; j < requested_apis.length; j++) {
			var temp0 = requested_apis[j];
			var requested_api = temp0[0] + "." + temp0[1];
			var temp_flag = false;
			for(var i = 0; i < requested_policy_apis.length; i++) {
				var temp1 = requested_policy_apis[i];
				var client_policy_api = temp1[0] + "." + temp1[1];
				if(requested_api == client_policy_api) {
					temp_flag = true;
					break;
				}
			}
			api_flag &= temp_flag;
		}		
      })();
       
       if(!api_flag) {
			// all apis are not covered, invoke the security dialog
//			dump("APIs not covered.");
		} else {
			// all apis are covered, do nothing
//			dump("APIs covered.");
			callback({});
			return;
		}
      
      try {
      
      	var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      
        if(os == "Android") {
        	  var dest = "", privs = "";
			  (function writeBody() {
				if (requested_apis.length > 0) {
				  for (var i=0; i<requested_apis.length; i++) {
					apimodule = requested_apis[i][0];
					apifunc = requested_apis[i][1];
					privs += apimodule + '.' + apifunc + ",";
				  }
				}

				if (requested_destinations.length > 0) {
				  for (var i=0; i<requested_destinations.length; i++) {
					dest += requested_destinations[i] + ",";
				  }
				}
			  })();
	
			var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
			var result = prompts.confirm(null, "A web page is requesting Fathom privileges.", "Url: " + windowargs.url + "\nAPIs: " + privs + "\nDestination: " + dest + "\n\nWould you like to grant access to Fathom APIs.");
		
		    if(result) {
		    	var requested_apis = windowargs['requested_apis'];
				var api = windowargs['api'];
				var fullapi = windowargs['fullapi'];

				for (var i = 0; i < requested_apis.length; i++) {
					var apimodule = requested_apis[i][0];
					var apifunc = requested_apis[i][1];
					if (apifunc == '*') {
						api[apimodule] = fullapi[apimodule];
					} else {
						api[apimodule][apifunc] = fullapi[apimodule][apifunc];
					}
				}
				// need to check this
				callback({});
		    }
        } else {
        	var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
            	.getService(Components.interfaces.nsIWindowWatcher);
        	var win = ww.openWindow(null, "chrome://fathom/content/page_permissions.html",
                                null, "chrome,centerscreen,modal,dependent,width=600,height=400",
                                windowargs);
        }
      } catch (e) {
        var result = {'error': e.toString(), __exposedProps__: { error: "r" }}
        callback(result);
      }
    }
  },

  /**
   * The socket module provides APIs for basic TCP and UDP socket
   * I/O.  For specific app-layer protocols, take a look at the
   * proto module instead.
   *
   * @module fathom.socket
   */
  socket : {

    /**
     * @class broadcast
     *
     * @description This component provides functions for sending and
     * receiving broadcast messages using UDP over IPv4.
     *
     * @namespace fathom.socket
     */
    broadcast : {
      /**
       * @method openSendSocket
       * @static
       *
       * @description This function opens a socket suitable for
       * transmitting broadcast messages.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  If successful, its only argument is
       * a numerical socket ID.  On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       */	
      openSendSocket : function (callback) {
	this.doSocketOpenRequest(callback, 'broadcastOpenSendSocket', []);
      },

      /**
       * @method openReceiveSocket
       * @static
       *
       * @description This function opens a broadcast socket and binds
       * it to the given port.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  If successful, its only argument is
       * a numerical socket ID.  On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {integer} port The local port on which the socket will
       * listen for broadcast messages.
       */	
      openReceiveSocket : function (callback, port) {
	this.doSocketOpenRequest(callback, 'broadcastOpenReceiveSocket', [port]);
      },

      /**
       * @method closeSocket
       * @static
       *
       * @description This function closes a broadcast socket.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes. On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @socketid {integer} socketid The socket handle previously
       * obtained from one of the opening functions.
       */
      closeSocket : function (callback, socketid) {
	this.doSocketUsageRequest(callback, 'closeSocket', [socketid]);	
      },

      /**
       * @method send
       * @static
       *
       * @description This function transmits data on a broadcast socket.
       *
       * [% INCLUDE todo.tmpl msg='This function should report the number of bytes successfully transmitted to the callback.' %]
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes. On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       * 
       * @param {integer} socketid  The socket handle previously
       * obtained from one of the opening functions.
       * 
       * @param {string} msg  The message to transmit.
       *
       * @param {string} ip The broadcast IPv4 address to send to.
       *
       * @param {integer} port  The (UDP) port to send to.
       */
      send : function (callback, socketid, msg, ip, port) {
	this.doSocketUsageRequest(callback, 'broadcastSend', [socketid, msg, ip, port]);
      },

      /**
       * @method receive
       * @static
       * 
       * @description On a socket created via openReceiveSocket(),
       * this function receives data.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  If successful, its only argument is
       * a string containing the received message.  On error, its only
       * argument is a dictionary whose member "error" describes the
       * problem that occurred.
       * 
       * @param {integer} socketid  The socket handle previously
       * obtained from one of the opening functions.
       */
      receive : function (callback, socketid) {
	this.doSocketUsageRequest(callback, 'broadcastReceive', [socketid]);
      },
    },
    
    /**
     * @class multicast
     *
     * @description This component provides functions for sending and
     * receiving multicast messages using UDP over IPv4.
     *
     * @namespace fathom.socket
     */
    multicast : {
      /**
       * @method openSendSocket
       * @static
       *
       * @description This function opens a socket suitable for
       * transmitting multicast messages.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {integer} ttl The multicast TTL, i.e., the number of
       * hops the datagram can traverse, doubling as the multicast
       * "threshold" of host/network/site/etc.
       */
      openSendSocket : function (callback, ttl) {
	this.doSocketOpenRequest(callback, 'multicastOpenSendSocket', [ttl]);
      },

      /**
       * @method openReceiveSocket
       * @static
       *
       * @description This function opens a multicast socket and binds
       * it to the given IP address and port.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  If successful, its only argument is
       * a numerical socket ID.  On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {string} ip  The IPv4 address of the multicast group to join.
       *
       * @param {integer} port The local port on which the socket will
       * listen for multicast messages.
       */	
      openReceiveSocket : function (callback, ip, port) {
	this.doSocketOpenRequest(callback, 'multicastOpenReceiveSocket', [ip, port]);
      },

      /**
       * @method closeSocket
       * @static
       *
       * @description This function closes a multicast socket.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes. On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @socketid {integer} socketid  The socket handle previously
       * obtained from one of the opening functions.
       */
      closeSocket : function (callback, socketid) {
	this.doSocketUsageRequest(callback, 'closeSocket', [socketid]);	
      },

      /**
       * @method send
       * @static
       *
       * @description This function transmits data via UDP on a
       * multicast socket.
       *
       * [% INCLUDE todo.tmpl msg='This function should report the number of bytes successfully transmitted to the callback. The underlying implementation should do better error handling.' %]
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes. On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       * 
       * @param {integer} socketid  The socket handle previously
       * obtained from one of the opening functions.
       * 
       * @param {string} msg  The message to transmit.
       *
       * @param {string} ip The IPv4 address of the multicast group to
       * send to.
       *
       * @param {integer} port  The (UDP) port to send to.
       */
      send : function (callback, socketid, msg, ip, port) {
	this.doSocketUsageRequest(callback, 'multicastSend', [socketid, msg, ip, port]);
      },

      /**
       * @method receive
       * @static
       * 
       * @description On a socket created via openReceiveSocket(),
       * this function receives data.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  If successful, its only argument is
       * a string containing the received message.  On error, its only
       * argument is a dictionary whose member "error" describes the
       * problem that occurred.
       * 
       * @param {integer} socketid  The socket handle previously
       * obtained from one of the opening functions.
       */
      receive : function (callback, socketid) {
	this.doSocketUsageRequest(callback, 'multicastReceive', [socketid]);
      },
      
      /**
       * @method receiveDetails
       * @static
       * 
       * @description Like receive(), but upon success the callback
       * receives dictionary with the following key/val structure:
       * "text" contains the received data, "peer" is another
       * dictionary with members "ip" for the sender's IPv4 address
       * and "port" for the sender's port.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  If successful, its only argument is
       * a string containing the received message.  On error, its only
       * argument is an associative array whose member "error"
       * describes the problem that occurred.
       * 
       * @param {integer} socketid  The socket handle previously
       * obtained from one of the opening functions.
       */
      receiveDetails : function (callback, socketid) {
	this.doSocketUsageRequest(callback, 'multicastReceiveDetails', [socketid]);
      },
    },

    /**
     * @class tcp
     *
     * @description This component provides APIs for communication over
     * TCP.
     *
     * @namespace fathom.socket
     */
    tcp : {
      /** 
       * @method openSendSocket
       * @static
       *
       * @description This function creates a TCP socket and connects
       * it to the given destination.
       *
       * [% INCLUDE todo.tmpl msg='Rename to openConnectSocket or some such, to avoid the impression that this socket is useful for sending only.' %]
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  When successful, its only argument
       * is a socket descriptor.  On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {string} destip  IP address to connect to.
       *
       * @param {integer} destport  Port to connect to.
       */ 
      openSendSocket : function (callback, destip, destport) {
	let self = this;
	function destPermCheckCompleted(result) {
          if (result['error']) {
            result["__exposedProps__"] = { error: "r" };
            // TODO: use setTimeout instead of calling callback() directly.
            callback(result);
          } else {
            self.doSocketOpenRequest(callback, 'tcpOpenSendSocket', [destip, destport]);
          }
	}
	this.checkDestinationPermissions(destPermCheckCompleted, destip);
      },

      /** 
       * @method  openReceiveSocket
       * @static
       *
       * @description This function creates a TCP socket, binds it
       * locally to the given port, and listens for connections.
       *
       * [% INCLUDE todo.tmpl msg='(1) Rename to openListenSocket or some such, to avoid the impression that this socket is useful for receiving only. (2) What interface does this bind to on a multihomed host?  (3) How does one accept() connections?' %]
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  When successful, its only argument
       * is a socket descriptor.  On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {integer} port  Port to listen on.
       */ 
      openReceiveSocket : function (callback, port) {
	this.doSocketOpenRequest(callback, 'tcpOpenReceiveSocket', [port]);
      },

      acceptstart : function(callback, socketid) {
	var handler = function(resp) {
	  // FIXME: broken
//	  if (resp.socket) {
	    // create a new chromeworker for the incoming connection
//            Logger.debug("connection from " + resp.address);
//	    this.doSocketOpenRequest(callback, 'tcpAcceptSocket', [resp.socket]);
//	  }
	};
	var multiresponse = true;
	this.doSocketUsageRequest(handler, 'tcpAcceptstart', [socketid], multiresponse);	
      },

      acceptstop : function(callback, socketid) {
	this.doSocketUsageRequest(callback, 'tcpAcceptstop', [socketid]);	
      },

      /**
       * @method closeSocket
       * @static
       *
       * @description This function closes a TCP socket.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes. On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @socketid {integer} socketid  The socket handle previously
       * obtained from one of the opening functions.
       */
      closeSocket : function (callback, socketid) {
	this.doSocketUsageRequest(callback, 'closeSocket', [socketid]);	
      },

      /** 
       * @method send
       * @static
       *
       * @description This function sends data over the TCP connection
       * identified by the given socket ID.
       *
       * [% INCLUDE todo.tmpl msg='This function should report back the number of bytes sent successfully, and also needs error semantics.' %]
       *
       * @param {function} callback The callback Fathom invokes once
       * the send call returns.
       *
       * @param {integer} socketid  The socket handle previously
       * obtained from one of the opening functions.
       *
       * @param {string} data  The data chunk to transmit.
       */ 
      send : function (callback, socketid, msg) {
	this.doSocketUsageRequest(callback, 'tcpSend', [socketid, msg]);
      },

      /** 
       * @method receive
       * @static
       *
       * @description This function receives data on a TCP connection.
       *
       * @param {function} callback The callback Fathom invokes either
       * when an error has occurred or when data has arrived.  When
       * successful, its only argument is the received data chunk.  On
       * error, its only argument is a dictionary whose member "error"
       * describes the problem that occurred.
       *
       * @param {integer} socketid  The socket handle previously
       * obtained from one of the opening functions.
       */ 
      receive : function (callback, socketid, asstring) {
	if (asstring == undefined) {
	  asstring = false;
	}
	this.doSocketUsageRequest(callback, 'tcpReceive', [socketid, asstring]);
      },

      /** 
       * @method getHostIP
       * @static
       *
       * @description This function returns the IP address of the
       * local endpoint of a given TCP connection.
       *
       * @param {function} callback The callback Fathom invokes either
       * when an error has occurred or when data has arrived.  When
       * successful, its only argument is the local IP address.  On
       * error, its only argument is a dictionary whose member "error"
       * describes the problem that occurred.
       *
       * @param {integer} socketid  The socket handle previously
       * obtained from one of the opening functions.
       */ 
      getHostIP : function (callback, socketid) {
	this.doSocketUsageRequest(callback, 'tcpGetHostIP', [socketid]);
      },

      /** 
       * @method getPeerIP
       * @static
       *
       * @description This function returns the IP address of the
       * remote endpoint of a given TCP connection.
       *
       * @param {function} callback The callback Fathom invokes either
       * when an error has occurred or when data has arrived.  When
       * successful, its only argument is the remote IP address.  On
       * error, its only argument is a dictionary whose member "error"
       * describes the problem that occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained from one of the opening functions.
       */ 
      getPeerIP : function (callback, socketid) {
	this.doSocketUsageRequest(callback, 'tcpGetPeerIP', [socketid]);
      },
    },
    
    /**
     * @class udp
     *
     * @description This component provides APIs for unicast
     * communication over UDP.  For multicast and broadcast options,
     * see the respective namespaces.
     *
     * @namespace fathom.socket
     */
    udp : {
      /** 
       * @method open
       * @static
       *
       * @description This function creates a UDP socket.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  When successful, its only argument
       * is a socket descriptor ID.  On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       */ 
      open : function(callback) {
	this.doSocketOpenRequest(callback, 'udpOpen', []);
      },

      /**
       * @method close
       * @static
       *
       * @description This function closes a UDP socket.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes. On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @socketid {integer} socketid  The socket handle previously
       * obtained for this UDP flow.
       */
      close : function (callback, socketid) {
	this.doSocketUsageRequest(callback, 'closeSocket', [socketid]);	
      },

      /** 
       * @method bind
       * @static
       *
       * @description This function binds a UDP socket to a local IP
       * address and port.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes. On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained for this UDP flow.
       *
       * @param {string} addr  IP address to bind to.
       *
       * @param {integer} port  Port to listen on.
       */ 
      bind : function(callback, socketid, addr, port) {
	this.doSocketUsageRequest(callback, 'udpBind', [socketid, addr, port]);
      },

      /** 
       * @method bind
       * @static
       *
       * @description This function connects a UDP socket to a remote
       * IP address and port.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes. On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained for this UDP flow.
       *
       * @param {string} addr  IP address to connect to.
       *
       * @param {integer} port  Port to connect to.
       */ 
      connect : function(callback, socketid, addr, port) {
	this.doSocketUsageRequest(callback, 'udpConnect', [socketid, addr, port]);
      },

      /** 
       * @method send
       * @static
       *
       * @description This function sends data over a UDP socket.
       *
       * [% INCLUDE todo.tmpl msg='This function should report back the number of bytes sent successfully, and also needs error semantics.' %]
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes. On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained for this UDP flow.
       *
       * @param {string} data  Data to send.
       */ 
      send : function(callback, socketid, data) {
	this.doSocketUsageRequest(callback, 'udpSend', [socketid, data]);
      },

      /** 
       * @method recv
       * @static
       *
       * @description This function receives data on a UDP socket.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  If successful, the function
       * receives a dictionary with two members: "data" for the data
       * actually read, and "length" for the full length of the data
       * chunk received.  On error, its only argument is a dictionary
       * whose member "error" describes the problem that occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained for this UDP flow.
       *
       * @param {integer} length Maximum length of the data chunk to
       * read.  This is an optimization, for cases when you do not
       * care to actually process all of the data received.  To ignore
       * this feature, pass 0.
       */ 
      recv : function(callback, socketid, length, timeout) {
	this.doSocketUsageRequest(callback, 'udpRecv', [socketid, length, timeout]);
      },

      /** 
       * @method sendrecv
       * @static
       *
       * @description This function sends data on a UDP socket and
       * reads subsequently returned responses.  This function is an
       * optimization, saving one message-passing roundtrip into the
       * Fathom core to read the response after having sent data.
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  If successful, the function
       * receives a dictionary with two members: "data" for the data
       * actually read, and "length" for the full length of the data
       * chunk received.  On error, its only argument is a dictionary
       * whose member "error" describes the problem that occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained for this UDP flow.
       *
       * @param {string} data  Data to send.
       *
       * @param {integer} length Maximum length of the data chunk to
       * read.  This is an optimization, for cases when you do not
       * care to actually process all of the data received.  To ignore
       * this feature, pass 0.
       */ 
      sendrecv : function(callback, socketid, data, length) {
	this.doSocketUsageRequest(callback, 'udpSendrecv', [socketid, data, length]);
      },

      /**
       * @method recvstart
       * @static 
       *
       * @description This function establishes a callback to get
       * invoked automatically whenever data arrive on a given UDP
       * socket.  To stop receiving, call recvstop().
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  If successful, the function
       * receives a dictionary with two members: "data" for the data
       * actually read, and "length" for the full length of the data
       * chunk received.  On error, its only argument is a dictionary
       * whose member "error" describes the problem that occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained for this UDP flow.
       *
       * @param {integer} length Maximum length of the data chunk to
       * read.  This is an optimization, for cases when you do not
       * care to actually process all of the data received.  To ignore
       * this feature, pass 0.
       */     
      recvstart : function(callback, socketid, length, asstring) {
	var multiresponse = true;
	if (asstring == undefined) {
	  asstring = false;
	}
	this.doSocketUsageRequest(callback, 'udpRecvstart', [socketid, length, asstring], multiresponse);
      },

      /**
       * @method recvstop
       * @static 
       *
       * @description This function cancels the callbacks previously
       * installed via recvstart().
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained for this UDP flow.
       */     
      recvstop : function(callback, socketid) {
	this.doSocketUsageRequest(callback, 'udpRecvstop', [socketid]);
      },

      /** 
       * @method sendto
       * @static
       *
       * @description This function sends data over a UDP socket, to a
       * specific destination.
       *
       * [% INCLUDE todo.tmpl msg='This function should report back the number of bytes sent successfully, and also needs error semantics.' %]
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes. On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained for this UDP flow.
       *
       * @param {string} data  Data to send.
       *
       * @param {string} ip  IP address to send to.
       *
       * @param {integer} port  Port to send to.

       */ 
      sendto : function(callback, socketid, data, ip, port) {
	this.doSocketUsageRequest(callback, 'udpSendto', [socketid, data, ip, port]);
      },

      /** 
       * @method recv
       * @static
       *
       * @description This function receives data on a UDP socket,
       * from a specific sender.
       *
       * [% INCLUDE todo.tmpl msg='This function is not complete. It still needs the IP address and port we want to receive from.' %]
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  If successful, the function
       * receives a dictionary with two members: "data" for the data
       * actually read, and "length" for the full length of the data
       * chunk received.  On error, its only argument is a dictionary
       * whose member "error" describes the problem that occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained for this UDP flow.
       */ 
      recvfrom : function(callback, socketid) {
	this.doSocketUsageRequest(callback, 'udpRecvfrom', [socketid]);
      },

      /**
       * @method recvfromstart
       * @static 
       *
       * @description This function establishes a callback to get
       * invoked automatically whenever data arrive on a given UDP
       * socket, from a specific sender.  To stop receiving, call
       * recvfromstop().
       *
       * [% INCLUDE todo.tmpl msg='This function is not complete. It still needs the IP address and port we want to receive from.' %]
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  If successful, the function
       * receives a dictionary with two members: "data" for the data
       * actually read, and "length" for the full length of the data
       * chunk received.  On error, its only argument is a dictionary
       * whose member "error" describes the problem that occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained for this UDP flow.
       */     
      recvfromstart : function(callback, socketid, asstring) {
	var multiresponse = true;
	if (asstring == undefined) {
	  asstring = false;
	}
	this.doSocketUsageRequest(callback, 'udpRecvfromstart', [socketid, asstring], multiresponse);
      },

      /**
       * @method recvfromstop
       * @static 
       *
       * @description This function cancels the callbacks previously
       * installed via recvfromstart().
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained for this UDP flow.
       */     
      recvfromstop : function(callback, socketid) {
	this.doSocketUsageRequest(callback, 'udpRecvfromstop', [socketid]);
      },

      /**
       * @method setsockopt
       * @static
       *
       * @description This function sets options on a given UDP socket.
       *
       * @param {function} callback The callback Fathom invokes when
       * the operation complets.  On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {integer} socketid The socket handle previously
       * obtained for this UDP flow.
       * 
       * @param {string} name The name of the option.  Currently,
       * Fathom only supports "reuseaddr".
       * 
       * @param {integer} value The option value.  For "reuseaddr", 1
       * requests the option, 0 clears it.
       */
      setsockopt : function(callback, socketid, name, value) {
	this.doSocketUsageRequest(callback, 'udpSetsockopt', [socketid, name, value]);
      },

      netprobe : function(callback, args) {
	this.doNonSocketRequest(callback, 'netprobe', [args]);
      },

      /** 
       * @method getHostIP
       * @static
       *
       * @description This function returns the IP address of the
       * local endpoint of a given UDP flow.
       *
       * @param {function} callback The callback Fathom invokes either
       * when an error has occurred or when data has arrived.  When
       * successful, its only argument is the local IP address.  On
       * error, its only argument is a dictionary whose member "error"
       * describes the problem that occurred.
       *
       * @param {integer} socketid  The socket handle identifying the
       * UDP flow.
       */ 
      getHostIP : function (callback, socketid) {
	this.doSocketUsageRequest(callback, 'udpGetHostIP', [socketid]);
      },

      /** 
       * @method getPeerIP
       * @static
       *
       * @description This function returns the IP address of the
       * remote endpoint of a given UDP flow.
       *
       * @param {function} callback The callback Fathom invokes either
       * when an error has occurred or when data has arrived.  When
       * successful, its only argument is the remote IP address.  On
       * error, its only argument is a dictionary whose member "error"
       * describes the problem that occurred.
       *
       * @param {integer} socketid  The socket handle identifying the
       * UDP flow.
       */ 
      getPeerIP : function (callback, socketid) {
	this.doSocketUsageRequest(callback, 'udpGetPeerIP', [socketid]);
      },
    },
  },

  /**
   * The proto module provides implementations of various
   * application-layer protocols.
   *
   * @module fathom.proto
   */
  proto : {
    
    /**
     * @class http
     *
     * @description This component provides an API for the HTTP protocol.
     *
     * @namespace fathom.proto
     */
    http : {
    
		// creates an HTTPRequest object
	 /**
       * @method create
       * @static
       *
       * @description  This function creates and returns an HTTP object.
       *
       */
    	create: function() {
    		return new HTTPRequest(GlobalFathomObject);
    	},
    	
		// creates an HTTPRequest object
	 /**
       * @method open
       * @static
       *
       * @description  This function opens an HTTP connection to the specified URI/IP.
       *
       * @param {object} httpObj  This is the HTTP object created using the 'create' API.
       * @param {string} url  This is the URL to be fetched.
       * @param {function} lookup    This is a lookup function to resolve the domain of the given url and return the associated IP address.
       * @param {string} IP    This is the IP address of the host. If the IP address is provided then url and lookup function are not used. IP address can be nullbut then both the url and lookup functions must be provided to establish the conenction. 
       */   
    	open: function(httpObj, url, lookup, ip) {
    		httpObj.httpOpen(url, lookup, ip);
    	},

	 /**
       * @method send
       * @static
       *
       * @description  This function sends an HTTP request to the the specified host.
       *
       * @param {object} httpObj  This is the HTTP object created using the 'create' API.
       * @param {string} method  This is the HTTP method to be used -- GET, POST, etc.
       * @param {string} data    This is the query string for the request. It can null in case of GET.
       * @param {object} headers    This represents the HTTP headers associated with the request. 
       */     	
    	send: function(httpObj, method, data, headers) {
    		httpObj.httpSend(method, data, headers);
    	},
    	
	 /**
       * @method receive
       * @static
       *
       * @description  This function gets an HTTP response.
       *
       * @param {object} httpObj  This is the HTTP object created using the 'create' API.
       * @param {function} recvCallback    This function is invoked when the response headers are available or chunked (or complete) response is available. This callback's signature is callback(type, data), where type can be 1 for HTTP headers, 3 for chunked response and 4 for complete response.
       */     	
    	receive: function(httpObj, recvCallback) {
    		httpObj.httpRecv(recvCallback);
    	},
    	
    /**
       * @method getCertificateChain
       * @static
       *
       * @description  This function gets a certificate chain information for the specified uri.
       *
       * @param {string} uri  This is uri for which certificate information is desired.
       * @param {function} callback    This is a callback that is invoked when then complete certificate chain information is available. The information is available as a JSON string.
       */ 	
    	getCertificateChain: function(uri, callback) {
    	
    		function makeURI(aURL, aOriginCharset, aBaseURI) {  
				var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);  
				return ioService.newURI(aURL, aOriginCharset, aBaseURI);  
			} 

			function getSecurityInfo(channel) {

				var certificate = function () {
				}
				certificate.prototype = {
					nickname: null,
					emailAddress: null,
					subjectName: null,
					commonName: null,
					organization: null,
					organizationalUnit: null,
					sha1Fingerprint: null,
					md5Fingerprint: null,
					tokenName: null,
					issuerName: null,
					serialNumber: null,
					issuerCommonName: null,
					issuerOrganization: null,
					issuerOrganizationUnit: null,
					validity: null,
					dbKey: null
				};

				var info = {
					security: {
						state: null,
						description: null,
						errorMsg: null
					},
					certs: []
				};

				try {
					if (! channel instanceof  Ci.nsIChannel) {
						info = null;
						return;
					}
		
					var secInfo = channel.securityInfo;
					if (secInfo instanceof Ci.nsITransportSecurityInfo) {
						secInfo.QueryInterface(Ci.nsITransportSecurityInfo);
			
						if ((secInfo.securityState & Ci.nsIWebProgressListener.STATE_IS_SECURE) == Ci.nsIWebProgressListener.STATE_IS_SECURE)
							info.security.state = "Secure";
			
						else if ((secInfo.securityState & Ci.nsIWebProgressListener.STATE_IS_INSECURE) == Ci.nsIWebProgressListener.STATE_IS_INSECURE)
							info.security.state = "Insecure";
				
						else if ((secInfo.securityState & Ci.nsIWebProgressListener.STATE_IS_BROKEN) == Ci.nsIWebProgressListener.STATE_IS_BROKEN)
							info.security.state = "Unknown";
			
						info.security.description = secInfo.shortSecurityDescription;
						info.security.errorMsg = secInfo.errorMessage;
					}
					else
						info.security = null;
		
					// Get SSL certificate details
					if (secInfo instanceof Ci.nsISSLStatusProvider) {
			
						var status = secInfo.QueryInterface(Ci.nsISSLStatusProvider).SSLStatus.QueryInterface(Ci.nsISSLStatus);
			
						var serverCert = status.serverCert;
						if (serverCert instanceof Ci.nsIX509Cert) {
							var certChain = serverCert.getChain().enumerate();

							while (certChain.hasMoreElements()) {
								var cert = certChain.getNext().QueryInterface(Ci.nsIX509Cert2);
	
								var tmp = new certificate();
								for(var i in tmp)
									if(cert[i])
										tmp[i] = cert[i];
					
								info.certs.push(tmp);
							}
						}
					}
					return info;
				} catch(e) {
					return null;
				}
			}

			var httpRequest = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
			httpRequest.mozBackgroundRequest = true;
			httpRequest.open("GET", makeURI(uri, null, null).prePath, true); 
			httpRequest.onreadystatechange = function (aEvt) {  
				if (httpRequest.readyState == 4) {
					var info = getSecurityInfo(httpRequest.channel);
					callback(JSON.stringify(info));
				}
			};
			httpRequest.send(null);
    	}
    },
    
    /**
     * @class dns
     *
     * @description This component provides an API for the DNS protocol.
     *
     * @namespace fathom.proto
     */
    dns : {
      // XXX This is supposed to open an mDNS listening socket.  We
      // bumped into problems here when a host-local mDNS daemon is
      // already listening.  Resolve?
      open : function(callback, ip, port, ttl) {
	this.doSocketOpenRequest(callback, 'dnsOpen', [ip, port, ttl]);
      },      

      /**
       * @method lookup
       * @static
       *
       * @description  This function implements an asynchronous DNS lookup.
       *
       * [% INCLUDE todo.tmpl msg='(1) Needing to provide a URL is cumbersome and unintuitive.  (2) Error semantics are missing.' %]
       *
       * @param {function} callback Fathom invokes this callback upon
       * arrival of the DNS response.  If successful, the callback
       * receives a dictionary whose members convey the DNS response.
       *
       * @param {string} url  URL containing the name to look up.
       */
      lookup : function(callback, url) {
	// XXX A URL as argument? --cpk
	
	if (!this.securityCheck())
	  return;
	
	if (url == "about:blank" || url == "about:home")
	  url = "http://www.google.com/";
	
	var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
	try {
	  var aURI = ioService.newURI(url, null, null);
	} catch (e) {
	  url = "http://www.google.com/";
	  aURI = ioService.newURI(url, null, null);
	}
	// instantiate the nsIDNSService
	var service = Components.classes["@mozilla.org/network/dns-service;1"].getService(Components.interfaces.nsIDNSService);
	var flag = Components.interfaces.nsIDNSService.RESOLVE_BYPASS_CACHE | Components.interfaces.nsIDNSService.RESOLVE_CANONICAL_NAME;
	var dns = {
	  uri : url,
	  ip : [],
	  cname : null,
	  __exposedProps__: {
		  uri: "r",
		  ip: "r",
		  cname: "r"
		}
	}
	var dnsCallback = {
	  onLookupComplete: function(request, record, status){
	    if (record != null){
	      while (record.hasMore()) {
		dns.ip.push(record.getNextAddrAsString());
	      }
	      dns.cname = record.canonicalName;
	    }
	    callback(dns);
	  }
	};
	var thread = Components.classes["@mozilla.org/thread-manager;1"].getService(Components.interfaces.nsIThreadManager).currentThread;
	if (aURI && aURI.host)
	  service.asyncResolve(aURI.host, flag, dnsCallback, thread);
      },	
      
      // lower level DNS APIs which can be used to build higher functionalities
      // create, query, response, sendRecv
      
      // returns a DNS object;
     /**
       * @method create
       * @static
       *
       * @description  This function creates and returns a DNS object.
       *
       * @param {string} proto  Indicates the protocol to be used for communication with the resolver, i.e., either 'udp' or 'tcp'.
       */
      create: function(proto) {
      	return new DNS(proto, GlobalFathomObject);
      },
      
      // returns a DNS query;
     /**
       * @method query
       * @static
       *
       * @description  This function creates a DNS query.
       *
       * @param {object} dnsObj  This is the DNS object created using the 'create' API.
       * @param {string} domain  This is the domain to be resolved.
       * @param {integer} type    This is the DNS record type, e.g., 1 for 'A' as mentioned in RFC1035 (and other RFCs), etc.
       * @param {integer} recordClass    This is the DNS record class, e.g., 1 for 'IN', 2 for 'CS', 3 for 'CH', 4 for 'HS', etc.
       * @param {integer} flags    This is the DNS flag options, e.g., '0x0100' for query.
       */      
      query: function(dnsObj, domain, type, recordClass, flags) {
				return dnsObj.query(domain, type, recordClass, flags);
      },
      
      // invokes a callback once a complete DNS response is received;
     /**
       * @method response
       * @static
       *
       * @description  This function creates a DNS response from the data received.
       *
       * @param {object} dnsObj  This is the DNS object created using the 'create' API.
       * @param {array} buf  This is a buffer for the response received.
       * @param {string} domain    This is the domain to be resolved.
       * @param {function} callback    This is a callback to be invoked on receiveing a valid DNS response.
       */        
      response: function(dnsObj, buf, domain, callback) {
			dnsObj.response(buf, domain, callback);
      },
      
      // sends a DNS query and receives its response;
     /**
       * @method sendRecv
       * @static
       *
       * @description  This API performs low-level socket operations based on the protocol selected and sends and receives data.
       *
       * @param {object} dnsObj  This is the DNS object created using the 'create' API.
       * @param {string} server  This is the IP for the DNS resolver.
       * @param {integer} port  This the port to be used on the resolver.
       * @param {array} data    This is typically the return value of the query API.
       * @param {function} sendCallback    This is a callback to be invoked on a socket send operation.
       * @param {function} receiveCallback    This is a callback to be invoked on a socket receive operation. Typically, it should invoke the response API to parse the response into a DNS response.
       */      
      sendRecv: function(dnsObj, server, port, data, sendCallback, receiveCallback) {
			dnsObj.proto.sendRecv(server, port, data, sendCallback, receiveCallback);
      }
      
    },
    
    tcpspeaker : {
      client : {
	open : function(host, port, data, listener) {
	  if (!this.securityCheck())
	    return;
	  Components.utils.import("resource://fathom/TCPClient.jsm");
	  var tcp = new TCPClient(host, port, data, listener);
	  return tcp;
	},
      },  
      
      server : {
	open : function(port, respFunc, consFunc) {
	  if (!this.securityCheck())
	    return;
	  Components.utils.import("resource://fathom/ServerSocket.jsm");
	  var ss = new ServerSocket(port, respFunc, consFunc);
	  return ss;
	},
      },
    },
    
    /**
     * @class upnp
     *
     * @description This module provides an API for the UPnP protocol.
     *
     * @module fathom.upnp
     */
    upnp : {

      /**
       * @method open
       * @static
       *
       * @description This function opens a multicast listening socket
       * suitable for initiating the UPnP discovery phase.
       *
       * [% INCLUDE todo.tmpl msg='(1) Seems the IP and port should have default values.  (2) Why the argument?' %]
       *
       * @param {function} callback The callback Fathom invokes once
       * the operation completes.  When successful, its only argument
       * is a socket descriptor.  On error, its only argument is a
       * dictionary whose member "error" describes the problem that
       * occurred.
       *
       * @param {string} ip The IP address to listen on.
       *
       * @param {integer} port The port to listen on.
       *
       * @param {integer} ttl The IP TTL to set on the socket.
       */
      open : function(callback, ip, port, ttl) {
	this.doSocketOpenRequest(callback, 'upnpOpen', [ip, port, ttl]);
      },
    },
  },
  
  script : {
    // this is only for testing, since web sites can use XHR and then use script.run
    loadURL : function(url, dataOutFunc, errorFunc) {
      if (!this.securityCheck())
	return;
      
      var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Components.interfaces.nsIXMLHttpRequest);
      req.open("GET", url, false/*true*/);
      req.send(null);
      //if (req.status == 200 && req.readyState == 4) {
      if (req.status == 0) {
	return req.responseText;		  
      }
    },

    run : function run(sourcecode, dataOutFunc, errorFunc) {
      // Current favorite idea:
      // Have the user optionally pass in an object that has one or both of the
      // following functions:
      //   dataOut()
      //   dataIn()
      // The dataOut function is called by the executing fathom script and can 
      // therefore be used to send data to a webpage by having it call a dataOut
      // function in the global scope of the fathom script.
      // The dataIn function can be used by the webpage to send additional data
      // to the executing fathom script (which must implement a dataIn function
      // which we'll call).
      //
      // We don't put those in the sandbox context but instead put wrappers in
      // the context. All arguments are deep copied and only the following are
      // allowed to be passed through:
      //   ints
      //   floats
      //   strings
      //   arrays
      //   objects (which we create a new, empty-prototyped object for the copy)

      // We return the object returned by _initScriptWorker which contains the
      // properties 'scriptid' and 'dataIn', the latter being a function which
      // will postMessage to the script worker and ultimately call the dataIn
      // function in the script worker.
      return this._initScriptWorker(sourcecode, dataOutFunc, errorFunc);
    }
  },

  /**
   * The system module provides APIs for invoking specific commands on
   * the host and retrieveing configuration and status information.
   *
   * @module fathom.system
   * @namespace fathom.system
   */
  system : {

    /**
     * @class system
     *
     * @description This component provides functions for invoking
     * specific commands on the host and retrieveing configuration and
     * status information.
     *
     * [% INCLUDE todo.tmpl msg='This entire module needs a fair bit of work, both in terms of error checking as well as normalizing the returned output to abstract platform idiosyncrasies. Ideally, for functions that involve incremental results (such as ping or traceroute), it would also invoke the callbacks repeatedly, conveying enough context to allow the caller to piece together the results.' %]
     *
     * @namespace fathom
     */

    /** 
     * @method doTraceroute
     * @static
     *
     * @description This function runs a traceroute to the given
     * destination and, upon completion, returns the textual results.
     *
     * @param {function} callback The callback Fathom invokes once the
     * call completes. If successful, the result is a dictionary with
     * three members: "exitstatus" (the numeric exit status of the
     * invocation), "stdout" (data rendered to standard output), and
     * "stderr" (data rendered to standard error).
     *
     * @param {string} host The host (name or IP address) to run a
     * traceroute to.
     */
    doTraceroute : function(callback, host, incrementaloutput, iface, fast) {
      // TODO: maybe we should detect first whether the system has a traceroute
      // or tracert and call the callback immediately with an error if there
      // isn't one.
      // TODO: the output should probably be parsed and put into a common
      // format (some array of objects, maybe) that is independent of the
      // individual traceroute implementation.
      var inc = (incrementaloutput == undefined || incrementaloutput); // do incremental output?
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      if (os == "WINNT") {
        cmd = "tracert";
        args = [host];
      } else if (os == "Linux" || os == "Darwin"){
			cmd = "traceroute";
//			args = ["-q3", "-m30", host];
	// anna: added few more params
	args = [];
	if (iface!==undefined) {
          args.push("-i"+iface);
	}
	if (fast) {
	  // anna: just one query per hop and wait at most 2s for response
          args.push("-w2");
          args.push("-q1");
	} else {
          args.push("-q3");
          args.push("-m30");
	}
	args.push(host);

		} else if (os == "Android")
			return;	// no traceroute on Android
			
	  function cbk(info) {
      	var output = {
      		name: "traceroute",
      		os: os,
      		params: [host]
      	};
      	var data = libParse(output, info);
      	callback(data);
      }
      dump("\n in traceroute.... " + cmd + " --- " + args + " inc="  + inc + "\n");
      
      //this._executeCommandAsync(callback, cmd, args, true);
      this._executeCommandAsync(cbk, cmd, args, inc);
    },

    /** 
     * @method doPing
     * @static
     *
     * @description This function runs an ICMP ping to the given
     * destination and, upon completion, returns the textual results.
     *
     * @param {function} callback The callback Fathom invokes once the
     * call completes. If successful, the result is a dictionary with
     * three members: "exitstatus" (the numeric exit status of the
     * invocation), "stdout" (data rendered to standard output), and
     * "stderr" (data rendered to standard error).
     *
     * @param {string} host The host (name or IP address) to ping.
     *
     * @param {integer} count The number of pings to attempt.
     */
    doPing : function(callback, host, count, iface) {
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      if (os == "WINNT") {
        cmd = "ping";
        args = [host];//[(count == -1) ? ("-n 4") : ("-n " + count), host];
      } else if (os == "Linux" || os == "Android" || os == "Darwin") {
        cmd = "ping";
//        args = [(count == -1) ? ("-c 5") : ("-c " + count), host];
	args = [];
	if (count) {
          args.push("-c" + count);
	} else {
          args.push("-c5");
	}
	if (iface) {
	  if (os == "Darwin") {
            args.push("-S"+iface); // must be IP address ... -I does not work..
	  } else {
            args.push("-I"+iface);
	  }	
	}
	args.push(host);
      }
      //dump("\n in ping.... " + host + " --- " + args + "\n")
      
      function cbk(info) {
      	var output = {
      		name: "ping",
      		os: os
      	};
      	var data = libParse(output, info);
      	callback(data);
      }
      
      //this._executeCommandAsync(callback, cmd, args);
      this._executeCommandAsync(cbk, cmd, args);
    },

    /** 
     * @method getWifiInfo
     * @static
     *
     * @description This function retrieves status information from
     * the wireless interfaces on the system and, upon completion,
     * returns the textual results.
     *
     * @param {function} callback The callback Fathom invokes once the
     * call completes. If successful, the result is a dictionary with
     * three members: "exitstatus" (the numeric exit status of the
     * invocation), "stdout" (data rendered to standard output), and
     * "stderr" (data rendered to standard error).
     */
    getWifiInfo : function(callback) {
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      if (os == "WINNT") {
        cmd = "netsh";
        args = ["wlan", "show", "interfaces", "mode=bssid"];
      } else if (os == "Linux") {
        cmd = "iwlist";
        args = ["scan"];
      } else if (os == "Darwin") {
      	cmd = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/A/Resources/airport";
        args = ["-s"];
      } else if(os == "Android")
			return; // TODO: check if we can do something similar to iwlist scan
			
	  function cbk(info) {
      	var output = {
      		name: "wifiInfo",
      		os: os
      	};
      	var data = libParse(output, info);
      	callback(data);
      }		
			
      //this._executeCommandAsync(callback, cmd, args);
      this._executeCommandAsync(cbk, cmd, args);
    },

    /** 
     * @method getNameservers
     * @static
     *
     * @description This function retrieves information about the
     * client's DNS resolver configuration.
     *
     * @param {function} callback The callback Fathom invokes once the
     * call completes. If successful, the result is a dictionary with
     * three members: "exitstatus" (the numeric exit status of the
     * invocation), "stdout" (data rendered to standard output), and
     * "stderr" (data rendered to standard error).
     */
    getNameservers : function(callback) {
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      if (os == "WINNT") {
        dump("\n os = windows");
        cmd = "ipconfig";
        args = ["/all"];
      } else if (os == "Linux" || os == "Darwin") {
        cmd = "cat";
        args = ["/etc/resolv.conf"];
      } else if(os == "Android") {
		cmd = "getprop";
		args = ["net.dns1"];
	  }
	  
      function cbk(info) {
      	var output = {
      		name: "nameserver",
      		os: os
      	};
      	var data = libParse(output, info);
      	callback(data);
      }
      
      //this._executeCommandAsync(callback, cmd, args);
      this._executeCommandAsync(cbk, cmd, args);
    },

    /** 
     * @method getHostname
     * @static
     *
     * @description Get hostname
     *
     * @param {function} callback The callback Fathom invokes once the
     * call completes. If successful, the result is a dictionary with
     * three members: "exitstatus" (the numeric exit status of the
     * invocation), "stdout" (data rendered to standard output), and
     * "stderr" (data rendered to standard error).
     */
    getHostname : function(callback) {
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      if (os == "WINNT") {
	// FIXME: should check the right command for windoze
	callback("hostname");
      } else if (os == "Linux" || os == "Darwin") {
        cmd = "hostname";
	args = [];
      } else if(os == "Android") {
	cmd = "getprop";
	args = ["net.hostname"];
      } else {
	throw "unknown OS " + os;
      }
	  
      function cbk(obj) {
	var res = undefined;
	if (obj && obj["error"]) {
          res = {error: obj["error"]};
	} else {
          var status = obj.exitstatus;
          var out = obj.stdout;
          var err = obj.stderr;
          if (!out && err) {
            res = {error: "Error: " + err};
          } else {
            res = out.trim();
          }
	}
	callback(res);
      }
      
      //this._executeCommandAsync(callback, cmd, args);
      this._executeCommandAsync(cbk, cmd, args);
    },

    

    /**
     * @method getActiveInterfaces
     * @static
     *
     * @description This function retrieves the current status of the
     * clients' network interfaces.
     *
     * @param {function} callback The callback Fathom invokes once the
     * call completes. If successful, the result is a dictionary with
     * three members: "exitstatus" (the numeric exit status of the
     * invocation), "stdout" (data rendered to standard output), and
     * "stderr" (data rendered to standard error).
     */       
    getActiveInterfaces : function(callback) {
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      // ifconfig or netstat -i
      if (os == "WINNT") {
        cmd = "ipconfig";
        args = ["/all"];
      } else if (os == "Linux" || os == "Darwin") {
        cmd = "ifconfig";
        args = [];
      } else if (os == "Android") {
			cmd = "netcfg";
			args = [];
	  }
	  
	  function cbk(info) {
      	var output = {
      		name: "activeInterfaces",
      		os: os
      	};
      	var data = libParse(output, info);
//      	dump("\nActive Interface\n" + JSON.stringify(info) + "\n");
      	callback(data);
      }
      
      //this._executeCommandAsync(callback, cmd, args);
      this._executeCommandAsync(cbk, cmd, args);
    },

    /**
     * @method getActiveWifiInterfaces
     * @static
     *
     * @description This function retrieves the current status of the
     * clients' wireless network interfaces (iwconfig and friends).
     *
     * @param {function} callback The callback Fathom invokes once the
     * call completes. If successful, the result is a dictionary with
     * three members: "exitstatus" (the numeric exit status of the
     * invocation), "stdout" (data rendered to standard output), and
     * "stderr" (data rendered to standard error).
     */       
    getActiveWifiInterfaces : function(callback) {
      var that = this;
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      if (os == "WINNT") {
	// TODO: test on windoze!!
//        cmd = "ipconfig";
//        args = ["/all"];
	callback();
	return null;
      } else if (os == "Linux") {
        cmd = "iwconfig";
        args = [];
      } else if (os == "Darwin") {
	cmd = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";
        args = ["-I"];
      } else if (os == "Android") {
	cmd = "getprop";
	args = ['wifi.interface'];
      }
	  
      function cbk(info) {
      	var output = {
      	  name: "activeWifiInterfaces",
      	  os: os
      	};
      	var data = libParse(output, info);

	if (os == 'Darwin') {
	  // get the name (and mac) of the wifi interface
	  cmd = "networksetup";
          args = ["-listallhardwareports"];
	  that._executeCommandAsync(function(info2) {
      	    var data2 = libParse(output, info2);
	    data.name = data2.name;
	    data.mac = data2.mac;
      	    callback(data);
	  }, cmd, args);
	} else {
      	  callback(data);
	}
      }
      
      //this._executeCommandAsync(callback, cmd, args);
      this._executeCommandAsync(cbk, cmd, args);
    },

    /**
     * @method getArpCache
     * @static
     *
     * @description This function retrieves the current contents of the ARP cache.
     *
     * @param {function} callback The callback Fathom invokes once the
     * call completes. If successful, the result is a dictionary with
     * three members: "exitstatus" (the numeric exit status of the
     * invocation), "stdout" (data rendered to standard output), and
     * "stderr" (data rendered to standard error).
     */       
    getArpCache : function(callback) {
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      // /usr/sbin/arp -a
      if (os == "WINNT") {
        cmd = "arp";
        args = ["-a"];
      } else if (os == "Linux" || os == "Darwin") {
        cmd = "arp";
        args = ["-a"];
      } else if (os == "Android")
			return; // no arp on Android
			
	  function cbk(info) {
      	var output = {
      		name: "arpCache",
      		os: os
      	};
      	var data = libParse(output, info);
      	callback(data);
      }
      	
      //this._executeCommandAsync(callback, cmd, args);
      this._executeCommandAsync(cbk, cmd, args);
    },

    /**
     * @method getRoutingTable
     * @static
     *
     * @description This function retrieves the client's current routing table.
     *
     * @param {function} callback The callback Fathom invokes once the
     * call completes. If successful, the result is a dictionary with
     * three members: "exitstatus" (the numeric exit status of the
     * invocation), "stdout" (data rendered to standard output), and
     * "stderr" (data rendered to standard error).
     */       
    getRoutingTable : function(callback) {
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      // netstat -rn or route -n
      if (os == "WINNT") {
        cmd = "route";
        args = ["print"];
      } else if (os == "Linux" || os == "Darwin") {
        cmd = "netstat";
        args = ["-rn"];
      } else if(os == "Android") {
			cmd = "cat";
			args = ["/proc/net/route"];
	  }
		
	  function cbk(info) {
      	var output = {
      		name: "routingInfo",
      		os: os
      	};
      	var data = libParse(output, info);
      	callback(data);
      }
		
      //this._executeCommandAsync(callback, cmd, args);
      this._executeCommandAsync(cbk, cmd, args);
    },

     /**
     * @method getLoad
     * @static
     *
     * @description This function retrieves the client's current system load via "top".
     *
     * [% INCLUDE todo.tmpl msg='Windows is currently not supported.' %]
     *
     * @param {function} callback The callback Fathom invokes once the
     * call completes. If successful, the result is a dictionary with
     * three members: "exitstatus" (the numeric exit status of the
     * invocation), "stdout" (data rendered to standard output), and
     * "stderr" (data rendered to standard error).
     */       
    getLoad : function(callback) {
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      // top -n 1
      if (os == "WINNT") {
		return;
      } else if (os == "Linux"){
        cmd = "top";
        args = ['-b -n1'];
      } else if (os == "Darwin") {
        cmd = "top";
        args = ["-l 1"];
      } else if (os == "Android") {
			cmd = "top";
			args = ['-n', '1'];
	  }
	  
	  function cbk(info) {
      	var output = {
      		name: "loadInfo",
      		os: os
      	};

      	var data = libParse(output, info);
      	callback(data);
      }
	  
      //this._executeCommandAsync(callback, cmd, args);
      this._executeCommandAsync(cbk, cmd, args);
    },
    
	/**
	 * @method getMemInfo
	 * @static
	 *
	 * @description This function retrieves the client's current memory load via "proc".
	 *
	 * [% INCLUDE todo.tmpl msg='Windows is currently not supported.' %]
	 *
	 * @param {function} callback The callback Fathom invokes once the
	 * call completes. If successful, the result is a dictionary with
	 * three members: "exitstatus" (the numeric exit status of the
	 * invocation), "stdout" (data rendered to standard output), and
	 * "stderr" (data rendered to standard error).
	 */
	getMemInfo: function (callback) {
		var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
		if (os == "WINNT") {
			return;
		} else if (os == "Linux") {
			cmd = "cat";
			args = ['/proc/meminfo'];
		} else if (os == "Darwin") {
			//TODO:
			return;
		} else if (os == "Android") {
			cmd = "cat";
			args = ['/proc/meminfo'];
		}
		
		function cbk(info) {
		  	var output = {
		  		name: "memInfo",
		  		os: os
		  	};

		  	var data = libParse(output, info);
		  	callback(data);
		  }
		
		//this._executeCommandAsync(callback, cmd, args);
		this._executeCommandAsync(cbk, cmd, args);
	},    
    
    /**
     * @method getProxyInfo
     * @static
     *
     * @description This function retrieves the client's current system load via "top".
     *
     * [% INCLUDE todo.tmpl msg='(1) Windows is currently not supported.  (2) If no proxy applies, the result could be null or some such, not a dictionary with null members, for convenience.  (3) The results are quite Firefox-specific.' %]
     *
     * @param {string} url The URL for which the function looks up the
     * applicable proxy configuration.
     *
     * @return {dictionary} The result describes the proxy.  For
     * explanation of the dictionary keys, see
     * <a href='https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIProxyInfo'>MDN</a>.
     */
    getProxyInfo : function (url) {
      
      if (!this.securityCheck())
	return;

      var proxy = {
      	host : null,
      	port : null,
      	type : null,
      	flags : null,
      	next : null,
      	failoverProxy : null,
      	failoverTimeout : null,
      	__exposedProps__: {
		    host : "r",
		  	port : "r",
		  	type : "r",
		  	flags : "r",
		  	next : "r",
		  	failoverProxy : "r",
		  	failoverTimeout : "r"
		}
      };
      var nextproxy = null, failoverproxy = null;
      
      var protocolProxyService = Cc["@mozilla.org/network/protocol-proxy-service;1"].getService(Ci.nsIProtocolProxyService);
      var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      try {
		var uri = ioService.newURI(url, null, null);
      } catch (e) {
		return proxy;
      }

      var proxyInfo = protocolProxyService.resolve(uri, 0);

      if (proxyInfo) {
	
	if (proxyInfo.failoverProxy) {
	  failoverproxy = {
	    host : proxyInfo.failoverProxy.host,
	    port : proxyInfo.failoverProxy.port,
	    type : proxyInfo.failoverProxy.type,
	    flags : proxyInfo.failoverProxy.flags,
	    next : proxyInfo.failoverProxy.next ? proxyInfo.failoverProxy.next.host : "null",
	    failoverProxy : proxyInfo.failoverProxy.failoverProxy ? proxyInfo.failoverProxy.failoverProxy.host : "null",
	    failoverTimeout : proxyInfo.failoverProxy.failoverTimeout,
	    __exposedProps__: {
		    host : "r",
		  	port : "r",
		  	type : "r",
		  	flags : "r",
		  	next : "r",
		  	failoverProxy : "r",
		  	failoverTimeout : "r"
		}
	  };
	}
	
	if (proxyInfo.next) {
	  nextproxy = {
	    host : proxyInfo.next.host,
	    port : proxyInfo.next.port,
	    type : proxyInfo.next.type,
	    flags : proxyInfo.next.flags,
	    next : proxyInfo.next.next ? proxyInfo.next.next.host : "null",
	    failoverProxy : proxyInfo.next.failoverProxy ? proxyInfo.next.failoverProxy.host : "null",
	    failoverTimeout : proxyInfo.next.failoverTimeout,
	    __exposedProps__: {
		    host : "r",
		  	port : "r",
		  	type : "r",
		  	flags : "r",
		  	next : "r",
		  	failoverProxy : "r",
		  	failoverTimeout : "r"
		}
	  };
	}
	
	proxy.host = proxyInfo.host;
	proxy.port = proxyInfo.port;
	proxy.type = proxyInfo.type;
	proxy.failoverTimeout = proxyInfo.failoverTimeout;
	proxy.flags = proxyInfo.flags;
	proxy.next = nextproxy;
	proxy.failoverProxy = failoverproxy;
      }
      return proxy;
    },
    
    getBrowserMemoryUsage: function(callback) {
		var mgr = Cc["@mozilla.org/memory-reporter-manager;1"].getService(Ci.nsIMemoryReporterManager);
		var e = mgr.enumerateReporters();
		while (e.hasMoreElements()) {
			var mr = e.getNext().QueryInterface(Ci.nsIMemoryReporter);
			if(mr.path == "resident") {
				break;
			}
		}
		var val = {memoryUsage: (mr.amount/(1024 * 1024)).toFixed(3), time: Date.now()};
		callback(val);
    },

	getEndHostInfo : function(callback) {
		// Proxy info
		
		var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
		var xulruntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
		var pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
		
		var val = {
			interface: {
				current: null,
				ip: null,
				version: null
			},
			browser: {
				vendor: appInfo.vendor,
				name: appInfo.name,
				version: appInfo.version
			},
			fathom: {
				build: pref.getCharPref("extensions.fathom.build"),
				version: pref.getCharPref("extensions.fathom.version"),
				installationID: pref.getCharPref("extensions.fathom.installationID")
			},
			os: xulruntime.OS,
			proxy: null,
			dns: null,
			time: Date.now()
		};
		
		GlobalFathomObject.system.getRoutingTable(handler);
      
      	  function handler(outinfo) {
		  
		  	  var dIface = null;
		  	  var ver = null;
		  	  var ip = null;
		  
		  	  if(outinfo && outinfo.defaultEntry && outinfo.defaultEntry.length) {
			  	  dIface = outinfo.defaultEntry[0].interface;
			  	  ver = outinfo.defaultEntry[0].version;
			  }		  
			  
		  	  GlobalFathomObject.system.getActiveInterfaces(cbkfn);
		  	  
		  	  function cbkfn(intfs) {
				// an array of current interfaces
				if(intfs.length > 0) {
					for(var i = 0; i < intfs.length; i++) {
						if(val.os == "WINNT") {
					  		if(intfs[i].address.ipv4 == dIface) {
								dIface = intfs[i].name;
								ip = intfs[i].address.ipv4;
								break;
					  		}
						} else {
					  		if(intfs[i].name == dIface) {
					  			ip = intfs[i].address.ipv4;
								break;
					  		}
						}
				 	}
				}
			
				val.interface = {
					current: dIface,
					ip: ip,
					version: ver
				};
			
				function cbk(info) {
					val.dns = info;
		
					// finally invoke the callback
					callback(val);
				}
	
				GlobalFathomObject.system.getNameservers(cbk);
			}
		}
	},
	
	getLastKnownInterface: function() {
	
		var file = FileUtils.getFile("ProfD", ["baseline_endhost.sqlite"]);
		var db = Services.storage.openDatabase(file);

		var data = "";

		try {
			var q1 = "SELECT * FROM endhost ORDER BY id DESC";
			var statement = db.createStatement(q1);
			while(statement.executeStep()) {
				data = statement.getString(1);
			  if (data && data.length>0) {
				var retval = JSON.parse(data).interface;
				if(retval.current && retval.ip)
					return retval.current + ", IP = " + retval.ip;
			  }
			}
		} catch(e) {
			dump(e);
		} finally {
			statement.reset();
		}

		return false;
	},

    /**
     * @method getIfaceStats
     * @static
     *
     * @description This function retrieves interface performance
     * counters (bytes, packets, errors, etc).
     *
     * @param {function} callback The callback Fathom invokes once the
     * call completes. If successful, the result is a dictionary with
     * three members: "exitstatus" (the numeric exit status of the
     * invocation), "stdout" (data rendered to standard output), and
     * "stderr" (data rendered to standard error).
     */       
    getIfaceStats : function(callback) {
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      if (os == "WINNT") {
        var cmd = "netstat";
        var args = ["-e"];
      } else if (os == "Linux" || os == "Android") {
      	// cat /proc/net/dev
        cmd = "cat";
        args = ["/proc/net/dev"];
      } else if (os == "Darwin") {
      	// netstat -bi
        cmd = "netstat";
        args = ["-bi"];
      }
      
      function cbk(info) {
      
		  var file = FileUtils.getFile("ProfD", ["baseline_endhost.sqlite"]);
		  var db = Services.storage.openDatabase(file);
		  
		  var data = "";
		  
		  try {
			var q1 = "SELECT * FROM endhost ORDER BY id DESC LIMIT 1";
		  	var statement = db.createStatement(q1);
		    if (statement.executeStep()) {
			data = statement.getString(1);
		    }
		  } catch(e) {
			dump(e);
		  } finally {
			statement.reset();
		  }
      
	if (data && data.length>0) {
      	  // get the top most entry in the db
      	  var dIface = JSON.parse(data).interface.current;
			  	  
	  	  var output = {
			name: "interfaceStats",
			os: os,
			params: [dIface]
		  };

		  var data = libParse(output, info);
		  callback(data);
	}

	  }
      
      //this._executeCommandAsync(callback, cmd, args);
      this._executeCommandAsync(cbk, cmd, args);
    },

    /**
     * @method getWifiStats
     * @static
     *
     * @description This function retrieves link quality parameters
     * for WiFi interfaces.
     *
     * @param {function} callback The callback Fathom invokes once the
     * call completes. If successful, the result is a dictionary with
     * three members: "exitstatus" (the numeric exit status of the
     * invocation), "stdout" (data rendered to standard output), and
     * "stderr" (data rendered to standard error).
     * @param {string} name Optional wireless inteface name if the system
     * has multiple wireless interfaces.
     */   
    getWifiStats : function(callback, name) {
      var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
      var params = [];
      if (name)
	params.push(name);

      if (os == "WINNT") {
      	//netsh wlan show networks mode=bssi
        cmd = "netsh";
        args = ["wlan", "show", "interface"];
      } else if (os == "Linux" || os == "Android") {
      	// cat /proc/net/wireless
        cmd = "cat";
        args = ["/proc/net/wireless"];
      } else if (os == "Darwin") {
      	// /System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I
        cmd = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";
        args = ["-I"];
      }
      
      function cbk(info) {
      
      	var output = {
	  name: "wifiStats",
	  os: os,
	  params : params
	};

	  	var data = libParse(output, info);
	  	callback(data);
	  }
      
      //this._executeCommandAsync(callback, cmd, args);
      this._executeCommandAsync(cbk, cmd, args);
    },

    /**
     * @class fathom.system.win
     *
     * @description The win component provides Windows-specific utility functions.
     */
    win : {
      /**
       * @method getMemLoad
       * @static
       *
       * @description This function retrieves the client's memory load
       * via the systeminfo command.
       *
       * [% INCLUDE note.tmpl msg='This function is Windows-specific.' %]
       *
       * @param {function} callback The callback Fathom invokes once the
       * call completes. If successful, the result is a dictionary with
       * three members: "exitstatus" (the numeric exit status of the
       * invocation), "stdout" (data rendered to standard output), and
       * "stderr" (data rendered to standard error).
       */       
      getMemLoad: function(callback) {
    	var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
	if (os != "WINNT")
	  return;
    	// systeminfo
        cmd = "systeminfo";
        args = [];
        this._executeCommandAsync(callback, cmd, args);
      },

      /**
       * @method getProcLoad
       * @static
       *
       * @description This function retrieves the client's process load
       * via the tasklist command.
       *
       * [% INCLUDE note.tmpl msg='This function is Windows-specific.' %]
       *
       * @param {function} callback The callback Fathom invokes once the
       * call completes. If successful, the result is a dictionary with
       * three members: "exitstatus" (the numeric exit status of the
       * invocation), "stdout" (data rendered to standard output), and
       * "stderr" (data rendered to standard error).
       */       
      getProcLoad: function(callback) {
    	var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
	if (os != "WINNT")
	  return;
	cmd = "tasklist";
    	args = [];
        this._executeCommandAsync(callback, cmd, args);
      },

      /**
       * @method getCpuLoad
       * @static
       *
       * @description This function retrieves the client's CPU load
       * via the wmic command.
       *
       * [% INCLUDE note.tmpl msg='This function is Windows-specific.' %]
       *
       * @param {function} callback The callback Fathom invokes once the
       * call completes. If successful, the result is a dictionary with
       * three members: "exitstatus" (the numeric exit status of the
       * invocation), "stdout" (data rendered to standard output), and
       * "stderr" (data rendered to standard error).
       */       
      getCpuLoad: function(callback) {
	var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
	if (os != "WINNT")
	  return;
	// wmic cpu get LoadPercentage
        cmd = "wmic";
        args = ["cpu", "get", "LoadPercentage"];
    	//cmd = "typeperf"; 
    	//args = ['-sc', '1', '"\processor(_total)\% processor time"'];
    	this._executeCommandAsync(callback, cmd, args);
      },
    },
  },
  
  /**
   * The util module provides APIs for various helpers and utilities.
   *
   * @module fathom.util
   * @namespace fathom.util
   */
  util : {

    /**
     * @class util
     *
     * @description This component provides APIs for various helpers and utilities.
     *
     * @namespace fathom
     */

    /**
     * @method baseline
     * @static
     *
     * @description This function returns baseline values for a given metric.
     *
     * [% INCLUDE todo.tmpl msg='(1) Suboptimal naming.  (2) The ffxMemory baseline should get renamed to browserMemory.' %]
     *
     * @param {string} metric The metric to query.  Supported metrics
     * include "cpu", "ffxMemory", "traffic", and "wifi".
     */       
    baseline : function (metric) {
      if (!this.securityCheck())
	return;
	
      var file = FileUtils.getFile("ProfD", ["baseline_" + metric + ".sqlite"]);
      var db = Services.storage.openDatabase(file);
      
      var data = "";
      
      try {
		var q1 = "SELECT * FROM " + metric;
      	var statement = db.createStatement(q1);
		while (statement.executeStep()) {
			data += statement.getString(1);
		}
	  } catch(e) {
		dump(e);
	  } finally {
		statement.reset();
	  }
      
      //dump("\nRETVAL == " + data + "\n");
      return data;
    },
    
    insertTables: function(table, field, value) {
    	var HISTORY_LENGTH = 100;
    	var file = FileUtils.getFile("ProfD", ["baseline_" + table + ".sqlite"]);
      	var db = Services.storage.openDatabase(file);
      	try {
      		if(table == "debugConnection")
				var q1 = 'INSERT INTO ' + table + ' VALUES (NULL, "' + value + '", "", "", "", "", "", "", "", "", "")';
			else if(table == "netError")
				var q1 = 'INSERT INTO ' + table + ' VALUES (NULL, "' + value + '", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "")';
			//dump("\nSQL insert === " + q1 + "\n");
			var statement = db.createStatement(q1);
			statement.executeStep();
			
			var q4 = "DELETE FROM " + table + " WHERE id NOT IN (SELECT id FROM " + table + " ORDER BY id DESC LIMIT " + HISTORY_LENGTH + ")";
			var statement = db.createStatement(q1);
			statement.executeStep();
			
		} catch(e) {
			dump(e);
		} finally {
			statement.reset();
		}
    },
    
    updateTables: function(testID, table, field, value) {
    
    	function isPrivateBrowsing() {
		try {
			// Firefox 20+
			Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
			return PrivateBrowsingUtils.isWindowPrivate(window);
		} catch(e) {
			// pre Firefox 20
			try {
				return Components.classes["@mozilla.org/privatebrowsing;1"].getService(Components.interfaces.nsIPrivateBrowsingService).privateBrowsingEnabled;
			} catch(e) {
				Components.utils.reportError(e);
				return false;
			}
		}
	}

	function maskValues(table, val, field) {
		// get the saved preferences
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		var value = pref.getCharPref("extensions.fathom.dataUploadPreferences");
		if(value) {
			var json = JSON.parse(value)[table];
			// update the val
			if(table == "debugConnection") {
				if(!json[field + "0"])
					return JSON.stringify("");
			} else if(!json[field])
				return JSON.stringify("");
			return val;
		}
		return JSON.stringify("");
	}

    	value = maskValues(table, value, field);
	if(!value || isPrivateBrowsing())
		return;
    
    	//dump("\n#### " + field + " :: " + value);
    	var file = FileUtils.getFile("ProfD", ["baseline_" + table + ".sqlite"]);
      	var db = Services.storage.openDatabase(file);
      	try {
			var q1 = 'UPDATE ' + table + ' SET ' + field + ' = \'' + value + '\' WHERE testid = "' + testID + '"';
			//dump("\nSQL update === " + q1 + "\n");
			var statement = db.createStatement(q1);
			statement.executeStep();
		} catch(e) {
			dump(e);
		} finally {
			statement.reset();
		}
    },
    
    // XXX Do we need this, given getHostIP in socket.{tcp,udp}?
    hostIP : function(callback, param, fd) {
      this.doNonSocketRequest(callback, 'getHostIP', [param, fd]);
    },

    
    /**
     * @method log
     * @static
     *
     * @description  A logging helper routine.
     *
     * [% INCLUDE todo.tmpl msg='Where does this log to?  Seems it should have a notion of log levels.' %]
     * 
     * @param {string} data  Data to log.
     */
    log : function (data) {
      if (!this.securityCheck())
	return;  	
      var file = FileUtils.getFile("TmpD", ["fathom.log"]);
      var ostream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
      ostream.init(file, 0x02|0x08|0x10, 0644, 1);
      
      var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);  
      converter.charset = "UTF-8";  
      var istream = converter.convertToInputStream(data);

      NetUtil.asyncCopy(istream, ostream, function(status) {  
	if (!Components.isSuccessCode(status)) {  
	  return;  
	}  
      });
    },
    
    /**
     * @method os
     * @static
     *
     * @description  This function returns client OS information.
     *
     * [% INCLUDE todo.tmpl msg='(1) Suboptimal naming.  (2) Can be folded into systemInfo?' %]
     * 
     * @return {string} OS information.
     */
    os : function () {
      if (!this.securityCheck())
	return;  	
      return Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
    },

    /**
     * @method systemInfo
     * @static
     *
     * @description  This function various system information strings.
     *
     * [% INCLUDE todo.tmpl msg='(1) Suboptimal naming.' %]
     * 
     * @param {string} param A keyword indicating the kind of
     * information of interest.  Possible values: "architecture",
     * "fullhostname", "hostname", "release", and "system".
     *
     * @return {string} Informative string.
     */
    systemInfo : function(callback, param) {
      this.doNonSocketRequest(callback, 'getSystemInfo', [param]);
    },

    /**
     * @method test
     * @static
     *
     * @description This is an API invocation test function.
     *
     * @return {string} This function returns the string "test" when
     * successful.
     */
    test : function test() {
      if (!this.securityCheck())
	return;    
      return "test";
    },

    /**
     * @method processNextEvent
     * @static
     *
     * @description This is an API invocation to process the next event
     * on the current thread.
     *
     * @return {void} This function does not return any value.
     */    
    processNextEvent: function(bool) {
    	var thread = Cc["@mozilla.org/thread-manager;1"].getService(Ci.nsIThreadManager).currentThread;
    	thread.processNextEvent(bool);
    },
    
    /**
     * @class timer
     * @description A set of APIs to manage timers.
     */
    timer : {
      /**
       * @method init
       * @static
       *
       * @description This function establishes a callback to get
       * invoked periodically, for up to a given number of times.
       *
       * [% INCLUDE todo.tmpl msg='Seems it should be possible to have timers that trigger indefinitly.' %]
       * 
       * @param {function} func The callback function to invoke when
       * the timer goes off.
       *
       * @param {integer} timeout The delay in milliseconds after
       * which the timer triggers.
       *
       * @param {integer} count The maximum number of times to invoke
       * the timeout.
       */
      init : function(func, timeout, count) {
	if (!this.securityCheck())
	  return;
	var i = 0;
	var event = {  
	  observe: function(subject, topic, data) {  
	    func.call(this);
	    i++;
	    if (i >= count)
	      timers.cancel();
	  }  
	}  
	var timers = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);  
	const TYPE_REPEATING_PRECISE = Components.interfaces.nsITimer.TYPE_REPEATING_PRECISE;  
	
	timers.init(event, timeout, TYPE_REPEATING_PRECISE);  
      },
    },    
  },

  tools : {

    /**
     * @method iperf
     * @static
     *
     * @description iperf implementation in nspr directly
     *
     * @param {function} func The callback function to invoke when
     * results are available.
     *
     * @param {object} args command line arguments, these match more or less
     * the arguments (naming and values) that you can give to commandline
     * iperf.
     */
    iperf : function(callback, args) {
      // create new worker and return the id for stop calls
      return this.doSyncSocketOpenRequest(callback, 'iperf', [args], true);
    },
    iperfStop : function(callback, id) {
      this.doSocketUsageRequest(callback, 'iperfStop', [id]);
    },
  },
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([FathomService, FathomAPI]);
