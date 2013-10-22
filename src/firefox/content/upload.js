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
		upload.send(upload.getKey(name), "/tmp/tmp.zip", upload.POST_URL, true, name);
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
	
	send: function(key, data, url, isFile, name) {
	
		var formData = new FormData();
		formData.append('key', key);
		formData.append('result', (isFile ? new File(data) : data));
	
		var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);  
		req.open('POST', url, true);

		req.onreadystatechange = function() {
			if(req.readyState == 4) {
				if(req.status == 200) {
					//dump(req.responseText);
					setTimeout(function() {
						upload.showAlert(name);
					}, Math.random()*10*1000);
				}
			}
		};
		
		req.send(formData);  
	},

	closeBubbleMessage: function() {
		var doc = gBrowser.selectedBrowser.contentDocument;

		if ( (doc) && (doc.getElementById('fathom-purple-bubble')) ) {
			// Dismiss bubble if already exists
			el = doc.getElementById('fathom-purple-bubble');
			if (el) {
				doc.body.removeChild(el);
			}

		}
	},

	showAlert: function(text) {
		
		var doc = gBrowser.selectedBrowser.contentDocument, anchor = doc.getElementById('fathom-purple-bubble'), body, span, br, pid;

		if (!anchor) {
			// output any of the strings found by adding a div element to this site
			body = doc.getElementsByTagName("body");

			anchor  = doc.createElement('div');

			// Style Definition of message bubble
			anchor.id = 'fathom-purple-bubble';
			anchor.style.display = "block";
			anchor.style.opacity = "0.9";
			anchor.style.filter = "alpha(opacity=90)";
			anchor.style.position = "fixed";
			anchor.style.zIndex = "2147483647";

			anchor.style.top = "15px";
			anchor.style.right = "20px";
			anchor.style.left = "auto";
			
			anchor.style.background = "#330033";
			anchor.style.styleFloat = "right";
			anchor.style.padding = "7px 10px";
			anchor.style.color = "#ffffff";
			anchor.style.border = "solid 2px #fff";
			anchor.style.cssText  = anchor.style.cssText + ' ;text-decoration:none !important; ';
			anchor.style.textAlign = "left";
			anchor.style.font = "13px Arial,Helvetica";
			anchor.style.MozBorderRadius = "5px";
			anchor.style.MozBoxShadow = "0px 0px 20px #000";
			anchor.style.borderRadius = "5px";
			anchor.style.boxShadow = "0px 0px 20px #000";
			anchor.style.textTransform = "none";
			anchor.style.cursor = 'pointer';
			anchor.style.width = 'auto';

			setTimeout(function() {
				upload.closeBubbleMessage();
			}, 5*1000);
			
			doc.body.appendChild(anchor);

			anchor.addEventListener('click', function (e) {
				doc.body.removeChild(this);
				e.preventDefault();
			}, false);
		}

		while(anchor.hasChildNodes()){
		    anchor.removeChild(anchor.lastChild);
		}

		span = doc.createElement('span');
		span.style.fontSize = '12px';
		text = text.split("_")[1].split(".")[0];
		span.textContent = 'Fathom has uploaded the ' + text + ' data.';

		anchor.appendChild(span);
	},

};
