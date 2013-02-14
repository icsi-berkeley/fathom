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

var Cc = Components.classes;
var Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/NetUtil.jsm"); 
Components.utils.import("resource://gre/modules/FileUtils.jsm");  

var EXPORTED_SYMBOLS = ["fathomDataStore"];

function readFile(file) {
	var data = "";
	var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].
		          createInstance(Components.interfaces.nsIFileInputStream);
	var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
		          createInstance(Components.interfaces.nsIConverterInputStream);
	fstream.init(file, -1, 0, 0);
	cstream.init(fstream, "UTF-8", 0, 0); // you can use another encoding here if you wish
	 
	let (str = {}) {
		let read = 0;
		do {
			read = cstream.readString(0xffffffff, str); // read as much as we can and put it in str.value
			data += str.value;
		} while (read != 0);
	}
	cstream.close(); // this closes fstream
	if(data == "")
		data = "{}";
	return JSON.parse(data);
}

var dataStore = FileUtils.getFile("ProfD", ["fathomDataStore"]);
if(!dataStore.exists()) {
	dataStore.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0755);
}

function writeToDisk(file, data) {
	var ostream = FileUtils.openSafeFileOutputStream(file, FileUtils.MODE_WRONLY);
	
	var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);  
	converter.charset = "UTF-8";  
	var istream = converter.convertToInputStream(data);

	NetUtil.asyncCopy(istream, ostream, function(status) {  
		ostream = null;
		converter = null;
		istream = null;
		if (!Components.isSuccessCode(status)) {  
			return;  
		}  
	});
}

function Store() {
	var fathomStorage = readFile(dataStore);
	this.storage = fathomStorage.storage ? fathomStorage.storage : {};
	this.list = fathomStorage.list ? fathomStorage.list : {};
};

Store.prototype = {
	storage: null,
	list: null,
	getItem: function(key) {
		if(key == null)
			return null;
		return this.storage[key];
	},
	
	setItem: function(key, value) {
		if(key != null) {
			this.storage[key] = value;
			var items = key.split("=#@#=");
			if(items[0] == "html")
				this.list[items[1]] = (new Date()).toString();
		}
	}
}

var fathomDataStore = new Store();

var filewrite = {
	observe: function(subject, topic, data) {
		writeToDisk(dataStore, JSON.stringify({
			storage: fathomDataStore.storage,
			list: fathomDataStore.list
		}));
	}
}

// this timer runs every 30 secs and dumps history to disk
var timer_datastore = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
timer_datastore.init(filewrite, 30*1000, Ci.nsITimer.TYPE_REPEATING_PRECISE);
