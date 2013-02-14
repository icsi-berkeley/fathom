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

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var upload = {

	POST_URL: "http://fathom.icsi.berkeley.edu/upload.php",

	getKey: function(desc) {
	
		var pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
		var id = pref.getCharPref("extensions.fathom.installationID");
	
		return id + "==" + desc + "==" + Date.now();
	},

	file: function(name) {
		// zip the file
		var zipFile = FileUtils.getFile("TmpD", ["tmp.zip"], false);
		if (zipFile.exists()) {
			zipFile.remove(false);
		}
		zipFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0644);
		
		var savedFile = FileUtils.getFile("ProfD", [name]);
		var zipWriter = Cc["@mozilla.org/zipwriter;1"].createInstance(Ci.nsIZipWriter);
		zipWriter.open(zipFile, FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE);
		zipWriter.addEntryFile(name, zipWriter.COMPRESSION_BEST, savedFile, false);
		zipWriter.close();
		
		// send the zip file
		upload.send(upload.getKey(name), "/tmp/tmp.zip", upload.POST_URL, true);
	},
	
	// untested, maybe don't even need this
	
	/*entry: function(table, field, value) {
		
		var retval = [];
		var file = FileUtils.getFile("ProfD", ["baseline_" + table + ".sqlite"]);
		var db = Services.storage.openDatabase(file);
		var q1 = "SELECT * FROM " + table + " WHERE " + field + " = " + value;
		
		execQuery(db, [q1]);
		
		function execQuery(db, query) {			
			var mozIStorageStatementCallback_obj = {
				handleResult: function(aResultSet) {
					var data = [];
					for (var row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
						var value = row.getResultByName("json");
						data.push(value);
					}
					if(data.length)
						retval.push(data);
				},

				handleError: function(aError) {
					dump("Error: " + aError.message);
				},

				handleCompletion: function(aReason) {
					if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED)
						dump("Query canceled or aborted!");

					// send the data
					upload.send(upload.getKey(table), JSON.stringify(retval), upload.POST_URL, false);
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
	},*/
	
	send: function(key, data, url, isFile) {
	
		var formData = new FormData();
		formData.append('key', key);
		formData.append('result', (isFile ? new File(data) : data));
	
		var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);  
		req.open('POST', url, true);

		req.onreadystatechange = function() {
			if(req.readyState == 4) {
				if(req.status == 200)
					dump(req.responseText);
			}
		};
		
		req.send(formData);  
	}

};
