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
 
/*-------------------------- Temporary Logging Start -------------------------*/ 
var Log = function (msg) {
	dump("Fathom: [" + msg + "]");
};

/*--------------------------- Temporary Logging End --------------------------*/ 

const HISTORY_LENGTH = 2000;
const metrics = ["system", "wifi", "traffic", "browserMemory", "endhost", "debugConnection", "netError"];

var loadInProgress = 0;
var totalHTTPsend = 0;
var totalHTTPrecv = 0;

var baselinefiles = {};
var syshistory = {};

Cu.import("resource://fathom/libParse.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm"); 
Cu.import("resource://gre/modules/FileUtils.jsm");  
Cu.import("resource://gre/modules/Services.jsm");

function isPrivateBrowsing() {
	try {
		// Firefox 20+
		Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
		return PrivateBrowsingUtils.isWindowPrivate(window);
	} catch(e) {
		// pre Firefox 20
		try {
			return Cc["@mozilla.org/privatebrowsing;1"].getService(Ci.nsIPrivateBrowsingService).privateBrowsingEnabled;
		} catch(e) {
			Cu.reportError(e);
			return false;
		}
	}
}

/*-------------------------------- I/O Helpers -------------------------------*/

function initTables(table, file) {
	if(table == "debugConnection")
		var q1 = "CREATE TABLE " + table + "(id INTEGER PRIMARY KEY, testid TEXT, uri TEXT, interfaces TEXT, configuration TEXT, auto TEXT, routing TEXT, traceroute TEXT, nameservers TEXT, lookup_standard TEXT, http TEXT)";
	else if(table == "netError")
		var q1 = "CREATE TABLE " + table + "(id INTEGER PRIMARY KEY, testid TEXT, uri TEXT, cause TEXT, interfaces TEXT, configuration TEXT, auto TEXT, routing TEXT, traceroute TEXT, nameservers TEXT, lookup TEXT, lookup_cd TEXT, lookup_public TEXT, lookup_standard TEXT, tcp TEXT, http TEXT, https TEXT, user_proxy TEXT, proxy_available TEXT, http_common TEXT)";
	else
		var q1 = "CREATE TABLE " + table + "(id INTEGER PRIMARY KEY, json TEXT)";
	var db = Services.storage.openDatabase(file);
	execQuery(db, [q1]);
	return db;
}

function updateTables(table, db, json) {
	if(isPrivateBrowsing())
		return;
	var q3 = "INSERT INTO " + table + " (id, json) values (NULL, '" + json + "')";
	var q4 = "DELETE FROM " + table + " WHERE id NOT IN (SELECT id FROM " + table + " ORDER BY id DESC LIMIT " + HISTORY_LENGTH + ")";
	execQuery(db, [q3, q4]);
}

function execQuery(db, query) {

	var mozIStorageStatementCallback_obj = {
		handleResult: function(aResultSet) {
		},

		handleError: function(aError) {
			dump("Error: " + aError.message);
		},

		handleCompletion: function(aReason) {
			if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED)
				dump("Query canceled or aborted!");
		}
	};

	try {
		var statement = [];
		for(var i = 0; i < query.length; i++) {
			var stmt = db.createStatement(query[i]);
			statement.push(stmt);
			stmt.reset();
		}
		db.executeAsync(statement, statement.length, mozIStorageStatementCallback_obj);
	} catch(e) {
		dump(e + " :: " + query[i]);
	}
}

/*-------------------------------- Init Helpers ------------------------------*/

(function () {
  for(var i in metrics) {
    var j = "baseline_" + metrics[i] + ".sqlite";
    // init files
    var baselineFile = FileUtils.getFile("ProfD", [j]);
    if(!baselineFile.exists()) {
      baselineFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0755);
    }
    baselinefiles[metrics[i]] = initTables(metrics[i], baselineFile);
  }
})();

/*------------------------------- Metric Helpers -----------------------------*/

function maskValues(val, list) {
	// get the saved preferences
	var pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
	var value = pref.getCharPref("extensions.fathom.dataUploadPreferences");
	if(value) {
		var json = JSON.parse(value)["passive"];
		// update the val
		for(var i = 0; i < list.length; i++) {
			if(!json[list[i]])
				val[list[i]] = null;
		}
		return val;
	}
	return null;
}

function saveBrowserMemoryUsage(val) {
	val = maskValues(val, ["memoryUsage"]);
	if(!val)
		return;
	updateTables("browserMemory", baselinefiles["browserMemory"], JSON.stringify(val));
	val = null;
}

function saveSystemHistory(val) {
	val = maskValues(val, ["cpu", "memory", "tasks"]);
  if(!val)
		return;
	updateTables("system", baselinefiles["system"], JSON.stringify(val));
  val = null;
}

function saveWiFiHistory(val) {
	val = maskValues(val, ["link", "signal", "noise"]);
	if(!val)
		return;  
  updateTables("wifi", baselinefiles["wifi"], JSON.stringify(val));
  val = null;
}

function saveNWHistory(val) {
  var obj = val;
  obj.httpsend = totalHTTPsend;
  obj.httprecv = totalHTTPrecv;
  val = maskValues(val, ["tx", "rx", "httpsend", "httprecv"]);
  if(!val)
		return;
  updateTables("traffic", baselinefiles["traffic"], JSON.stringify(obj));
  obj = val = null;
}

function saveEndHostHistory(val) {
	val = maskValues(val, ["interface", "browser", "os", "dns"]);	
	if(!val)
		return;  
  updateTables("endhost", baselinefiles["endhost"], JSON.stringify(val));
  val = null;
}

/*------------------------------- Timer Helpers ------------------------------*/

var handleObj = {
	handle: null,
	getHandleToFathom: function() {
		if(this.handle)
		  return this.handle;

		var manifest = {
			'api': ['system.*', 'util.*', ],
			'destinations': ['']
		};

		window.fathom.init(function (arg) {}, manifest, window);

		this.handle = gFathomObject.obj;
		return this.handle;
	}
};

var timerevent = {
  observe: function(subject, topic, data) {
    var sysutils = handleObj.getHandleToFathom();
    if(sysutils) {
      sysutils.system.getLoad(saveSystemHistory);
      sysutils.system.getWifiStats(saveWiFiHistory);
      sysutils.system.getIfaceStats(saveNWHistory);
      sysutils.system.getBrowserMemoryUsage(saveBrowserMemoryUsage);
    }
    sysutils = null;
  }
}

var endhostinfo = {
  observe: function(subject, topic, data) {
	var sysutils = handleObj.getHandleToFathom();
	if(sysutils) {
		sysutils.system.getEndHostInfo(saveEndHostHistory);
	}
	sysutils = null;
	// force garbage collection
    window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils).garbageCollect();
  }
}

// this timer runs every 5 secs to get wifi, cross-traffic, system info, ffxMemuse
var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
timer.init(timerevent, 5*1000, Ci.nsITimer.TYPE_REPEATING_PRECISE);

// this timer runs every 60 secs to update the endhost info
var timer1 = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
timer1.init(endhostinfo, 60*1000, Ci.nsITimer.TYPE_REPEATING_PRECISE);
