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

if (!fathomns) {
  var fathomns = {
    mod : {}
  };
}

Components.utils.import("resource://fathom/Logger.jsm",
			fathomns.mod);

/**
 * Provides functionality for the overlay. An instance of this class exists for
 * each tab/window.
 */
fathomns.overlay = {

  _initialized : false,
  _fathomService : null,

  // For things we can't do through the nsIFathom interface, use direct
  // access to the underlying JS object.
  _fathomServiceJSObject : null,

  _overlayId : null,
  _strbundle : null,

  toString : function() {
    return "[fathomns.overlay " + this._overlayId + "]";
  },

  /**
   * Initialize the object. This must be done after the DOM is loaded.
   */
  init : function() {
    try {
      if (this._initialized == false) {
        this._initialized = true;
        this._overlayId = (new Date()).getTime();

        this._fathomService = Components.classes["@icir.org/fathom-service;1"]
            .getService(Components.interfaces.nsIFathom);
        this._fathomServiceJSObject = this._fathomService.wrappedJSObject;

        this._strbundle = document.getElementById("fathomStrings");
      }
    } catch (e) {
      fathomns.mod.Logger.error("Fatal Error, " + e + ", stack was: " + e.stack);
      fathomns.mod.Logger.error("Unable to initialize fathomns.overlay.");
      throw e;
    }
  },

  onWindowClose : function(event) {
  },

  /**
   * Perform the actions required once the window has loaded.
   * 
   * @param {Event}
   *          event
   */
  onLoad : function(event) {
    try {

    } catch (e) {
      fathomns.mod.Logger.error("Fatal Error, " + e + ", stack was: " + e.stack);
      fathomns.mod.Logger.error("Unable to complete fathomns.overlay.onLoad actions.");
      throw e;
    }
  },

  /**
   * Perform the actions required once the DOM is loaded. This may be
   * called for more than just the page content DOM. 
   * 
   * @param {Event}
   *          event
   */
  _onDOMContentLoaded : function(document) {
    fathomns.mod.Logger.warning("_onDOMContentLoaded called.");
  }
};

// Initialize the fathomns.overlay object when the window DOM is loaded.
addEventListener("DOMContentLoaded", function(event) {
  fathomns.overlay.init();
}, false);

// Event handler for when the window is closed. We listen for "unload" rather
// than "close" because "close" will fire when a print preview opened from this
// window is closed.
addEventListener("unload", function(event) {
  fathomns.overlay.onWindowClose(event);
}, false);

// Registers event handlers for documents loaded in the window.
addEventListener("load", function(event) {
  fathomns.overlay.onLoad(event);
}, false);

/* code for handling overlay events */
var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;

// set the extensions.fathom.installationID
pref.setCharPref("extensions.fathom.installationID", Math.random().toString(36).slice(-8));

if(os == "Android") {
	var fathom_toggleHelpers = {
	
		menuID: null,
		
		fathom_on: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAQCAYAAAAWGF8bAAAAAXNSR0IArs4c6QAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAACxQAAAsUBidZ/7wAAAAd0SU1FB9sKEgIOCw5Y4ZEAAAKdSURBVDjLlZRLSJRRFMf/Z95+4zQ5OuJoRGE1SPhgChIJpIZQF6IESS4kmTBJXBhtLFr0LYJWQQiKQhhZGsxCibQ2oREEOWTmO0TtoenkY3TGkW++eZwWOTKhUnPgLs69f36He+75X2A7mDmuJb1IK5nrPFYYzaOhQBxBRCSKooKISKsM9x0xbgzU19cnx2riAoZfps7fsrV6HQ5HokcSngPAVdv723EBQ72Wc/6eQwONjY3GTVkzpFGG9HUFn+8+G829CQCHD3iqRVFU/TdQDinteo1ceCWrt+2+64IDAKwmd93Hr6Y1BjhZ8Js8Hk/6vkCbrTLdnFRy4/zZKqsoioo7byvuAUCW2V3h9QoRKaRaSNQGdAaDIccrCV0AYE7YOLMn0GQobvsytrqw5Q8/+DDonmprdvUZjcbg9LKhfXZZF1QoFAnM9BQALmUNXkpQBWYAoMw6VLQLmGetyAgEIjWxBdY9ctHw8Pey/OrZhuyapetNTU2+xS29CwDMen/miiRMAoBSwSm7gD8WNyv36uHEyFr5KrM3GAzKAqBv7M7raX6tfVX32Ny6spU4BwBSUGXcBTyZZ+rbC5hjSxolIgMAbAE+p9OpbGia73L19w89fHd6PMLg8UXjTFS/89x2+/Gp6cn1N94N2R7dS0sXvlksie0a4Cj/cZNPR3QiAsDHvCwQZTg7ddeKS81PdoY/1nq1tbVq98/gxYmxtfJcm2kkJVX7qKWl5ZeWqBKAFGDuVhMVEJApM3doiHIB5MjMHUT099X286wWyFQDVQJgYWaogSo1kL99VqoBLsd6WfWvwZaYZ3RE8DMvaohOAUAQ+AQAEeAggJG4vSwxR5seBjDGzAEtUfY2fDxWq4rnc5CZh2PSbAaWmDkUq/kNN85GkCwTvVUAAAAASUVORK5CYII=",

		fathom_off: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAQCAYAAAAWGF8bAAAAAXNSR0IArs4c6QAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAACxQAAAsUBidZ/7wAAAAd0SU1FB9sKEgIOHxSCNewAAAKQSURBVDjLlZRNaBNBGIbfmU13ya9GywZSEMP2JvUi6FGsh1IQ6qGbRKGXgBZ6sj3WQw7Fk9i7hdJLSzbMJfQQT4I5aKUBFTRYKCVo7SoNTSFJN0l3Z9bLFkJT0HwwMAMv7zzz/QyBF67rYpAoFAqTjuNY09PTJQAghAAA6CAmuq4TxhjVdZ1QSouyLL9bXV292qsZyHBmZuaXLMuN8fHxkBDCAIBIJLLYqyH/evLm5uY9IUT25ORkKhgMrlNKH3S73WXLsl5Fo9EDznndcZxYMpl0/otQCHGfUnpXluWVer2eAYChoaG5VqtVB+BKknSl1WrFz/S+8wZLS0vx4+PjlKqqRU3Tdi3LehGNRp8ripJsNBpzQogDSumI3++/KYTIUUofU0rvAPjZRzg/P79Sq9UOHMdZNk1zp1wuFwOBgN1ut9fa7bZNCPEDWAeAYDCoE0L2ACAQCEz0EWaz2RHO+ZPeCzqdzoRpmlPb29vPXNd9b9t2M5lMlhVFgSRJGuec+Xw+EEKG+6rcbDYfXZTDw8PDhxsbGw3O+akkScH9/f1CtVp9U6lUXnPOq15BL/URqqpaNE3z5XnDWCz2Vdf1MKUUnPPm1taWRCnNUUo/qaraicfjrmVZe32EmqbtKIryttcsFAr9CIVCa5TSBAAwxpqSJF0HgFwuVyuVShHG2NOjo6O5PkNd18Xo6OhkIpFIh8NhQ9O0xUQicTuTydQA3ADQ8tpouKd3h23b7i4sLJxe2Dazs7M2gLy3AADpdFoD4COEfPRmVgOw6+2vua5rDzR6hmHsEUI+GIbxO5VK3fIoP3uElwF8H3iWDcM4SzoH8I0x1k2lUmOeeaVX6xvkc8jn8196jmOu6/5hjDm9mr/FCSB9UsYsVQAAAABJRU5ErkJggg==",

		getCurrentStatus: function () {
			return pref.getBoolPref("extensions.fathom.status");
		},

		setCurrentStatus: function (val) {
			pref.setBoolPref("extensions.fathom.status", val);
		},

		toggleCurrentStatus: function () {

			var version = pref.getCharPref("extensions.fathom.version");
			var build = pref.getCharPref("extensions.fathom.build");

			var datauri = fathom_toggleHelpers.fathom_on;

			var cur = this.getCurrentStatus();
			if (cur) {
				datauri = fathom_toggleHelpers.fathom_off;
				fathom_toggleHelpers.setCurrentStatus(false);
			} else {
				datauri = fathom_toggleHelpers.fathom_on;
				fathom_toggleHelpers.setCurrentStatus(true);
			}

			fathom_toggleHelpers.menuID = NativeWindow.menu.add("Fathom: v" + version + "." + build, datauri, function () {
				NativeWindow.menu.remove(fathom_toggleHelpers.menuID);
				fathom_toggleHelpers.toggleCurrentStatus();
			});
		}
	}

	window.addEventListener("load", function (e) {

		var version = pref.getCharPref("extensions.fathom.version");
		var build = pref.getCharPref("extensions.fathom.build");

		var cur = fathom_toggleHelpers.getCurrentStatus();
		if (cur) {
			var status = fathom_toggleHelpers.fathom_on;
		} else {
			var status = fathom_toggleHelpers.fathom_off;
		}
		fathom_toggleHelpers.menuID = NativeWindow.menu.add("Fathom: v" + version + "." + build, status, function () {
			NativeWindow.menu.remove(fathom_toggleHelpers.menuID);
			fathom_toggleHelpers.toggleCurrentStatus();
		});
	
	}, false);
} else {
	
	var fathom_toggleHelpers = {

	  getCurrentStatus : function() {
		return pref.getBoolPref("extensions.fathom.status");
	  },

	  setCurrentStatus : function(val){
		pref.setBoolPref("extensions.fathom.status", val);
	  },

	  toggleCurrentStatus : function(prefix) {
		if (this.getCurrentStatus()) {
		  item = document.getElementById("fathom-icon");
		  if(item)
		item.setAttribute("image", "chrome://fathom/content/icons/off.png");

		  item = document.getElementById("toolbar-fathom-button");
		  if(item)
		item.setAttribute("image", "chrome://fathom/content/icons/off.png");

		  item = document.getElementById(prefix + "fathom-disable");
		  if(item)
		item.setAttribute("checked", "true");

		  this.setCurrentStatus(false);
		} else {
		  item = document.getElementById("fathom-icon");
		  if(item)
		item.setAttribute("image", "chrome://fathom/content/icons/on.png");

		  item = document.getElementById("toolbar-fathom-button");
		  if(item)
		item.setAttribute("image", "chrome://fathom/content/icons/on.png");

		  item = document.getElementById(prefix + "fathom-disable");
		  if(item)
		item.setAttribute("checked", "false");

		  this.setCurrentStatus(true);
		}
	  }
	}

	var fathom_helpers = {

	  onLoad: function() {
		var parent = document.getElementById("status-bar");
		var entry = null, item = null;
		if (!fathom_toggleHelpers.getCurrentStatus()) {
		  // set icon-image to off
		  item = document.getElementById("fathom-icon");
		  if(item)
		item.setAttribute("image", "chrome://fathom/content/icons/off.png");

		  item = document.getElementById("toolbar-fathom-button");
		  if(item)
		item.setAttribute("image", "chrome://fathom/content/icons/off.png");
		}
	  },
	  
	  status: function(){
		return fathom_toggleHelpers.getCurrentStatus();
	  },
	  
	  onMenuItemCommand: function(e, type, prefix) {
		var item = null;
		switch(type) {
		case 'toggle':
		  fathom_toggleHelpers.toggleCurrentStatus(prefix);
		  break;

		case 'bugreport':
		  var loc = gBrowser.contentDocument.location;
		  var xulRuntime = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime);
		  var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);;
		  var platform = appInfo.vendor + " " + appInfo.name + " " + appInfo.version + " / " + xulRuntime.OS;
		  
		  var version = pref.getCharPref("extensions.fathom.version");
  		  var build = pref.getCharPref("extensions.fathom.build");
		  
		  gBrowser.loadURI('mailto:fathom-bug@icsi.berkeley.edu?subject=Bug report: Build #v' + version + '.' + build + ', Browser/OS [' + platform + '], URL [' + loc + ']');
		  break;
		  
		case 'about':
		  window.open("chrome://fathom/content/about.xul", "About", "chrome,centerscreen");
		  break;
		  
		case 'status':
		  fathom_toggleHelpers.toggleMessagePanel(prefix);
		  break;
		  
		default:
		  break;
		}
	  },
	  
	  onPopUpShowing: function(e, prefix) {
		var item = null;
		// set status info
		if (fathom_toggleHelpers.getCurrentStatus()) {
		  item = document.getElementById(prefix + "fathom-disable");
		  if(item)
		item.setAttribute("checked", "false");
		} else {
		  item = document.getElementById(prefix + "fathom-disable");
		  if(item)
		item.setAttribute("checked", "true");
		}
		// set version info
		var el = document.getElementById(prefix + "fathom-version");
		if (el) {
		  var version = pref.getCharPref("extensions.fathom.version");
		  var build = pref.getCharPref("extensions.fathom.build");
		  if (build != version) // for local checkouts
		el.label = "Version: " + version + ", build " + build;
		  else
		el.label = "Version: " + version;
		}
	  },

	  onIconClick: function(e) {
		// toggle status on middle button click
		if (e.button == 1) {
		  fathom_toggleHelpers.toggleCurrentStatus();
		}
	  }
	};

	window.addEventListener("load", function(e) { fathom_helpers.onLoad(e); }, false);
}
