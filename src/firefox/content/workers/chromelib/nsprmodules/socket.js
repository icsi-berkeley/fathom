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

util.registerAction('closeSocket');

function closeSocket(socketid) {
  var fd = util.getRegisteredSocket(socketid);
  if (!fd) {
    throw 'Unable to close socket: unknown socketid: ' + socketid;
  }
  NSPR.sockets.PR_Close(fd);
  util.unregisterSocket(socketid);

  // Anna: sending flags to fathom to clean up this worker
  util.postResult({closed : true});
  setTimeout(close, 1);
}
