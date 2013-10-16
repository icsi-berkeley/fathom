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

util.registerAction('getSystemInfo');
util.registerAction('getHostIP');

function getSystemInfo(param) {
  var info = newBuffer(256);
  var val = null;
  switch(param) {
  case "architecture":
    val = NSPR.util.PR_SI_ARCHITECTURE;
    break;
  case "fullhostname":
    val = NSPR.util.PR_SI_HOSTNAME_UNTRUNCATED;
    break;
  case "hostname":
    val = NSPR.util.PR_SI_HOSTNAME;
    break;
  case "release":
    val = NSPR.util.PR_SI_RELEASE;
    break;
  case "system":
    val = NSPR.util.PR_SI_SYSNAME;
    break;
  default:
    break;
  }
  if(!val)
    return "No information found. -- param = " + param;
  NSPR.util.PR_GetSystemInfo(val, info, 256);
  return info.readString();
  /*
  for(var tmp = "", i = 0; info[i] != '0'; i++)
    tmp += String.fromCharCode(info[i]);
  return tmp;
 */
}

function getHostIP(param, fd) {
  var sockfd = util.getRegisteredSocket(fd);
  switch(param) {
  case "ipv4":
    return NSPR.util.GetHostIP(sockfd);
  case "ipv6":
  default:
    return "Not available.";
  }
}
