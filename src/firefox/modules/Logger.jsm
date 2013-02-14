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

var EXPORTED_SYMBOLS = ["Logger"]

/**
 * Provides logging methods
 */
Logger = new function() {

  this.LEVEL_OFF = Number.MAX_VALUE; // no logging
  this.LEVEL_ERROR = 1000;
  this.LEVEL_WARNING = 900;
  this.LEVEL_INFO = 800;
  this.LEVEL_DEBUG = 700;
  this.LEVEL_ALL = Number.MIN_VALUE; // log everything

  this._LEVEL_NAMES = {};
  this._LEVEL_NAMES[this.LEVEL_ERROR.toString()] = "ERROR";
  this._LEVEL_NAMES[this.LEVEL_WARNING.toString()] = "WARNING";
  this._LEVEL_NAMES[this.LEVEL_INFO.toString()] = "INFO";
  this._LEVEL_NAMES[this.LEVEL_DEBUG.toString()] = "DEBUG";

  // These can be set to change logging level, what types of messages are
  // logged, and to enable/disable logging.
  this.level = this.LEVEL_INFO;
  this.types = this.TYPE_ALL;
  this.enabled = true;

  // The default printing routine dumps to the native console.
  this.printFunc = dump;
};

Logger._doLog = function(level, message) {
  if (this.enabled && level >= this.level) {
    var levelName = this._LEVEL_NAMES[level.toString()];
    this.printFunc("[Fathom] [" + levelName + "] " + message + "\n");
  }
};

Logger.error = function(message) {
  this._doLog(this.LEVEL_ERROR, message);
};

Logger.warning = function(message) {
  this._doLog(this.LEVEL_WARNING, message);
};

Logger.info = function(message) {
  this._doLog(this.LEVEL_INFO, message);
};

Logger.debug = function(message) {
  this._doLog(this.LEVEL_DEBUG, message);
};

Logger.dump = function(message) {
  this.debug(message);
}

Logger.vardump = function(obj, name, ignoreFunctions) {
  if (name != undefined) {
    this.dump(name + " : " + obj);
  } else {
    this.dump(obj);
  }
  for (var i in obj) {
    try {
      if (typeof obj[i] == 'function') {
        if (!ignoreFunctions) {
          this.dump("    => key: " + i + " / value: instanceof Function");
        }
      } else {
        this.dump("    => key: " + i + " / value: " + obj[i]);
      }
    } catch (e) {
      this.dump("    => key: " + i + " / value: [unable to access value]");
    }
  }
}
