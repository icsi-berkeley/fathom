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

util.registerAction('upnpOpen');

function upnpOpen(ip, port, ttl) {
  var fd = NSPR.sockets.PR_OpenUDPSocket(NSPR.sockets.PR_AF_INET);

  // Set the TTL for the send.
  var opt = new NSPR.types.PRSocketOptionData();
  opt.option = NSPR.sockets.PR_SockOpt_McastTimeToLive;
  opt.value = ttl;
  NSPR.sockets.PR_SetSocketOption(fd, opt.address());

  // Allow binding unless unless the port is actively being listened on.
  var opt = new NSPR.types.PRSocketOptionData();
  opt.option = NSPR.sockets.PR_SockOpt_Reuseaddr;
  opt.value = NSPR.sockets.PR_TRUE;
  NSPR.sockets.PR_SetSocketOption(fd, opt.address());
  
  var addr = new NSPR.types.PRNetAddr();
  NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrAny, NSPR.sockets.PR_AF_INET, port, addr.address());

  if(NSPR.sockets.PR_Bind(fd, addr.address()) != 0) {
    return {error: "Error binding : code = " + NSPR.errors.PR_GetError()};
  }

  var socketid = util.registerSocket(fd);

  function createIGMPRequest(ip) {
    var maddr = NSPR.types.PRMcastRequest();

    maddr.mcaddr = new NSPR.types.PRNetAddr();
    maddr.mcaddr.ip = NSPR.util.StringToNetAddr(ip);
    NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrNull, NSPR.sockets.PR_AF_INET, 0, maddr.mcaddr.address());

    maddr.setInterfaceIpAddrAny();
    //maddr.ifaddr = new NSPR.types.PRNetAddr();
    //NSPR.sockets.PR_SetNetAddr(NSPR.sockets.PR_IpAddrAny, NSPR.sockets.PR_AF_INET, 0, maddr.ifaddr.address());
    return maddr;
  }

  // Construct an IGMP join request structure.
  var req = createIGMPRequest(ip);

  // Send an ADD MEMBERSHIP message via setsockopt.
  opt = new NSPR.types.PRMulticastSocketOptionData();
  opt.option = NSPR.sockets.PR_SockOpt_AddMember;
  opt.value = req;
  if (NSPR.sockets.PR_SetMulticastSocketOption(fd, opt.address()) == NSPR.sockets.PR_FAILURE) {
    closeSocket(socketid);
    return {error: "Failed : SetSocketOption for ADD MEMBERSHIP := " +
                   NSPR.errors.PR_GetError() + " :: " + NSPR.errors.PR_GetOSError()};
  }

  return {};
}
