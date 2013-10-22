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

var NSPR = {};

function newBuffer(size) {
  return ctypes.unsigned_char.array(size)();
}

function newBufferFromString(str) {
  return ctypes.unsigned_char.array()(str);
}

//function getSizeOfLong (cpu, compiler) {
//	// for msvc it does not matter whether cpu is 32 or 64 bit
//	if(compiler == "msvc")
//		return 4;
//	if(cpu == "ppc"){
//		// not sure if "ppc" is the value for both 32 or 64 bit powerpc systems
//		// this can either 4 or 8, depending on 32 or 64 bit
//		return 4; // or 8;
//	}
//	if(cpu == "x86_64")
//		return 8;
//	// assuming default 32 bit, and compiler is gcc
//	return 4;
//}
//
//function getPaddingInfo(arch) {
//	var tmp = arch.split('-');
//	var cpu = tmp[0];
//	var compiler = tmp[1];
//	var padding = {}, inetsize = 0, msocksize = 0;
//	var align = getSizeOfLong(cpu, compiler);
//	// inet addr padding
//	inetsize = align * Math.ceil((ctypes.char.array(104).size + ctypes.uint16_t.size) / align);
//	padding.inetaddr = inetsize - (2 * ctypes.uint16_t.size + ctypes.uint32_t.size + ctypes.char.array(8).size);
//	// multicast socket option padding
//	msocksize = align * Math.ceil((ctypes.int32_t.size + 2 * inetsize) / align);
//	padding.mcastsockopt = msocksize - (ctypes.int32_t.size + 2 * inetsize);
//	// socket option data padding
//	padding.sockopt = msocksize - (ctypes.int32_t.size * (1 + (align/4)));
//	padding.align = align;
//	//throw padding.inetaddr + " :: " + padding.mcastsockopt;
//	
//	return padding;
//}

function openLibrary(name, path) {
  // jsamuel: With my current testing, a standard Firefox installation on
  // 32-bit Windows 7 fails to load the library when given the full path but
  // will load it given only the name. However, on 64-bit Linux with a locally
  // installed Firefox the library doesn't load if we provide only the name.
  // So, the safest bet is to try loading both ways.
  try {
    return ctypes.open(name);
  } catch (e) {
    try {
      return ctypes.open(path);
    } catch (e) {
      throw 'Unable to open library through ctypes: ' + path + ' ' + e;
    }
  }
}

/**
 * Determine the number of bytes between the option and value fields of a
 * PRSocketOptionData whose value is a PRMcastRequest (we call this type of
 * PRSocketOptionData a PRMulticastSocketOptionData). This is the padding
 * before the first PRNetAddr of the PRMcastRequest.
 *
 * Note: This is essentially checking whether the padding is 0 or 4 bytes.
 * It does not appear to be just a 32-bit vs 64-bit issue as at least 32-bit
 * Windows has 4 bytes of padding.
 */
function getFirstNetAddrPad() {
  let lib = openLibrary(util.nsprname, util.nsprpath);

  try {
    var PR_AF_INET = 2;
    var PR_SockOpt_McastInterface = 10;

    var PRFileDesc = ctypes.StructType("PRFileDesc");

    var PR_OpenUDPSocket = lib.declare("PR_OpenUDPSocket",
        ctypes.default_abi,
        PRFileDesc.ptr,
        ctypes.int32_t);

    // Assume that the PRSockOption enum is 4 bytes.
    // The largest total size we have seen for the PRSocketOptionData struct is
    // 232 bytes, so using 260 bytes should be enough and lets us populate the
    // bytes field with sequential values from 0 to 255.
    var SocketOptionData = ctypes.StructType("PRSocketOptionData",
        [{'option': ctypes.int32_t},
         {'bytes': ctypes.unsigned_char.array(256)}]);

    var GetSocketOption = lib.declare("PR_GetSocketOption",
        ctypes.default_abi,
          ctypes.int32_t,
          PRFileDesc.ptr,
          SocketOptionData.ptr);

  } catch (e) {
    throw 'nspr.js getFirstNetAddrPad error in declarations: ' + e;
  }

  // Figure out if there is padding in PRSocketOptionData between the option
  // field and a following PRNetAddr (the value union's mcast_if member for
  // a PR_SockOpt_McastInterface PR_GetSocketOption call).
  try {
   var fd = PR_OpenUDPSocket(PR_AF_INET);
   if (fd < 0) {
     throw 'getFirstNetAddrPad: failed to open udp socket: ' + fd;
   }

   var opt = new SocketOptionData();

   var getOffset = function() {
     // Initialize the non-option bytes of our PRSocketOptionData so that they
     // contain byte values corresponding to their position (0 to 255). We'll
     // check for what has changed after NSPR function calls modify the data.
     for (var i = 0; i < opt.bytes.length; i++) {
       opt.bytes[i] = i;
     }

     opt.option = PR_SockOpt_McastInterface;

     GetSocketOption(fd, opt.address());

     var offset = -1;
     for (var i = 0; i < opt.bytes.length; i++) {
       if (opt.bytes[i] != i) {
         offset = i;
         break;
       }
     }

     // We expect no padding (offset is 4) or 4 bytes of padding (offset is 8).
     if (offset != 4 && offset != 8) {
       offset = -1;
     }

     return offset;
   }

   let offset = getOffset();
   // If we didn't find the offset, try a few more times to make sure it wasn't
   // coincidence with uninitialized data matching the values we initialized.
   // However, we expected zeros to be written, not uninitialized data, so this
   // is probably not necessary.
   if (offset == -1) {
     offset = getOffset();
   }
   if (offset == -1) {
     offset = getOffset();
   }

   var firstnetaddrpad = -1;
   if (offset == -1) {
     throw 'Could not determine firstnetaddrpad';
   } else {
     // The 4 bytes immediately preceding the ip address are not struct padding
     // but rather the inet.family and inet.port fields. Anything else is the
     // padding between the 4 bytes (we assume the enum will be represented by
     // 4 bytes) of PRSockOption and the first PRNetAddr of the PRMcastRequest
     // (PRMcastRequest.mcaddr).
     firstnetaddrpad = offset - 4;
     util.log('firstnetaddrpad: ' + firstnetaddrpad);
     return firstnetaddrpad;
   }

  } catch (e) {
   throw 'nspr.js error in getFirstNetAddrPad: ' + e;
  }
}


try {
  let lib = openLibrary(util.nsprname, util.nsprpath);
  //var padding = getPaddingInfo(system_arch);

  //util.log("padding: " + padding.toString());

  NSPR.types = {
  
    PRFileDesc : ctypes.StructType("PRFileDesc"),
    
    PRSize : ctypes.size_t,
    
    PRProcess : ctypes.StructType("PRProcess"),
    
	// padding affects structs that have unions like PRNetAddr and PRSocketOptionData
	// PRSocketOption data has been split into PRSocketOption, PRMulticastSocketOptionData
	// and other socket option structs that have not been defined, like PRLingerSocketOptionData 
    PRNetAddr : ctypes.StructType("PRNetAddr", 
                    [{'family': ctypes.uint16_t},
                     {'port': ctypes.uint16_t},
                     {'ip': ctypes.uint32_t},
                     {'pad': ctypes.char.array(8)}]),
                     //{'platform_padding' : ctypes.char.array(padding.inetaddr)}]),

    // We use this for PRSocketOptionData when the value union's member is a
    // PRUintn, PRBool, or PRSize. Each of these end up being the size of an
    // integer on the current platform. Thus, we use "ctypes.int" which will
    // be the size of an int on the current platform.
    PRSocketOptionData :
                    ctypes.StructType("PRSocketOptionData",
                    [{'option': ctypes.int32_t},
                     {'value': ctypes.int}]),
//  						(function() {
//			if(padding.align == 8) {
//			return ctypes.StructType("PRSocketOptionData",
//	             [{'option': ctypes.int32_t},
//	              {'value': ctypes.int64_t},
//	              {'platform_padding' : ctypes.char.array(padding.sockopt)}])
//			} else {
//			return ctypes.StructType("PRSocketOptionData",
//	             [{'option': ctypes.int32_t},
//	              {'value': ctypes.int32_t},
//	              {'platform_padding' : ctypes.char.array(padding.sockopt)}])
//			
//			} })(),
  
  	// need to add appropriate padding here
    PRLinger : ctypes.StructType("PRLinger",
                    [{'polarity': ctypes.bool},
                     {'linger': ctypes.uint32_t}]),
                     
	PRFileInfo : ctypes.StructType("PRFileInfo",
					[{'type' : ctypes.uint32_t},
					 {'size' : ctypes.uint32_t},
					 {'creationTime' : ctypes.uint64_t},
					 {'modifyTime' : ctypes.uint64_t}])
  };

  // We don't know the true size of PRNetAddr but only the IP address field of
  // the ifaddr member is ever used.
  NSPR.types.PRMcastRequest = ctypes.StructType("PRMcastRequest",
                     [{'mcaddr': NSPR.types.PRNetAddr},
                      {'ifaddr_blob': ctypes.unsigned_char.array(1024)}]);

  /*
   * As IpAddrAny is all zeros and only the ip field of ifaddr is read we can
   * just set all bytes of ifaddr to zero. We don't need to know where the ip
   * field really is.
   */
  NSPR.types.PRMcastRequest.prototype.setInterfaceIpAddrAny = function() {
    for (var i = 0; i < this.ifaddr_blob.length; i++) {
      this.ifaddr_blob[i] = 0;
    }
  };

  NSPR.types.PRMulticastSocketOptionData = (function() {
    var firstnetaddrpad = getFirstNetAddrPad();
    if(firstnetaddrpad)
      return ctypes.StructType("PRSocketOptionData",
             [{'option': ctypes.int32_t},
              {'firstnetaddrpad' : ctypes.char.array(firstnetaddrpad)},
              {'value': NSPR.types.PRMcastRequest}]);
    else
      return ctypes.StructType("PRSocketOptionData",
             [{'option': ctypes.int32_t},
              {'value': NSPR.types.PRMcastRequest}]); })();

	// these are NSPR's process handling structs
	NSPR.types.PRProcessAttr = ctypes.StructType("PRProcessAttr",
				[{"stdinFd" : NSPR.types.PRFileDesc.ptr},
				 {"stdoutFd" : NSPR.types.PRFileDesc.ptr},
				 {"stderrFd" : NSPR.types.PRFileDesc.ptr},
				 {"currentDirectory" : ctypes.char.ptr},
				 {"fdInheritBuffer" : ctypes.char.ptr},
				 {"fdInheritBufferSize" : NSPR.types.PRSize},
				 {"fdInheritBufferUsed" : NSPR.types.PRSize}]);

  NSPR.sockets = {
  
    // PRSockOption
    PR_SockOpt_Nonblocking    : 0,    /* nonblocking io */
    PR_SockOpt_Linger      : 1,    /* linger on close if data present */
    PR_SockOpt_Reuseaddr    : 2,    /* allow local address reuse */
    PR_SockOpt_Keepalive    : 3,    /* keep connections alive */
    PR_SockOpt_RecvBufferSize  : 4,    /* send buffer size */
    PR_SockOpt_SendBufferSize  : 5,    /* receive buffer size */
    PR_SockOpt_IpTimeToLive    : 6,    /* time to live */
    PR_SockOpt_IpTypeOfService  : 7,    /* type of service and precedence */
    PR_SockOpt_AddMember    : 8,    /* add an IP group membership */
    PR_SockOpt_DropMember    : 9,    /* drop an IP group membership */
    PR_SockOpt_McastInterface  : 10,    /* multicast interface address */
    PR_SockOpt_McastTimeToLive  : 11,    /* multicast timetolive */
    PR_SockOpt_McastLoopback  : 12,    /* multicast loopback */
    PR_SockOpt_NoDelay      : 13,    /* don't delay send to coalesce packets */
    PR_SockOpt_MaxSegment    : 14,    /* maximum segment size */
    PR_SockOpt_Broadcast    : 15,    /* enable broadcast */
    PR_SockOpt_Last        : 16,
  
    // Constants
    PR_TRUE            : true,
    PR_FALSE          : false,
    
    PR_SUCCESS          : 0,
    PR_FAILURE          : -1,
    
    // PRNetAddr Constants
    PR_AF_INET          : 2,
    PR_AF_LOCAL          : 1,
    
    // PRNetAddrValue
    // https://developer.mozilla.org/en/PR_InitializeNetAddr
    // http://doxygen.db48x.net/mozilla/html/nspr_2prnetdb_8h.html#a13fde051a18c829379a1a9ee09cdaf0a
    PR_IpAddrNull : 0,
    PR_IpAddrAny : 1,
    PR_IpAddrLoopback : 2,
    PR_IpAddrV4Mapped : 3,

    /*PR_INADDR_ANY        : 0,
    PR_INADDR_LOOPBACK      : 0x7f000001,*/
    PR_INADDR_BROADCAST      : 0xffffffff,
    
    PR_INTERVAL_NO_WAIT      : 0,
    PR_INTERVAL_NO_TIMEOUT    : 0xffffffff,
  
    PR_INTERVAL_MIN        : 1000,
    PR_INTERVAL_MAX        : 100000,
    
    PR_SetNetAddr : lib.declare("PR_SetNetAddr",
                ctypes.default_abi,
                ctypes.int32_t,
                ctypes.int32_t,
                ctypes.uint16_t,
                ctypes.uint16_t,
                NSPR.types.PRNetAddr.ptr),
                
    PR_InitializeNetAddr : lib.declare("PR_InitializeNetAddr",
                ctypes.default_abi,
                ctypes.int32_t,
                ctypes.int32_t,
                ctypes.uint16_t,
                NSPR.types.PRNetAddr.ptr),
                
    PR_NewTCPSocket : lib.declare("PR_NewTCPSocket",
                ctypes.default_abi,
                NSPR.types.PRFileDesc.ptr),
                              
    PR_NewUDPSocket : lib.declare("PR_NewUDPSocket",
                ctypes.default_abi,
                NSPR.types.PRFileDesc.ptr),
  
    PR_OpenTCPSocket : lib.declare("PR_OpenTCPSocket",
                          ctypes.default_abi,
                          NSPR.types.PRFileDesc.ptr,
                          ctypes.int32_t),
                          
    PR_OpenUDPSocket : lib.declare("PR_OpenUDPSocket",
                          ctypes.default_abi,
                          NSPR.types.PRFileDesc.ptr,
                          ctypes.int32_t),
                          
  
    PR_GetSocketOption : lib.declare("PR_GetSocketOption",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                NSPR.types.PRSocketOptionData.ptr),
  
    PR_GetMulticastSocketOption : lib.declare("PR_GetSocketOption",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                NSPR.types.PRMulticastSocketOptionData.ptr),                        
                      
    PR_SetSocketOption : lib.declare("PR_SetSocketOption",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                NSPR.types.PRSocketOptionData.ptr),
                
    PR_SetMulticastSocketOption : lib.declare("PR_SetSocketOption",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                NSPR.types.PRMulticastSocketOptionData.ptr),              
  
    PR_Bind : lib.declare("PR_Bind",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                NSPR.types.PRNetAddr.ptr),
                      
    PR_Listen : lib.declare("PR_Listen",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                ctypes.int32_t),
                        
    PR_Accept : lib.declare("PR_Accept",
                ctypes.default_abi,
                NSPR.types.PRFileDesc.ptr,
                NSPR.types.PRFileDesc.ptr,
                NSPR.types.PRNetAddr.ptr,
                ctypes.uint32_t),
                
    PR_Connect : lib.declare("PR_Connect",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                NSPR.types.PRNetAddr.ptr,
                ctypes.uint32_t),          
  
    PR_ConnectContinue : lib.declare("PR_ConnectContinue",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                ctypes.uint16_t),
                       
    PR_Close : lib.declare("PR_Close",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr),
        
    PR_Shutdown : lib.declare("PR_Shutdown",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                ctypes.uint8_t),
                       
    PR_Recv : lib.declare("PR_Recv",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                ctypes.voidptr_t,
                ctypes.int32_t,
                ctypes.int32_t,
                ctypes.uint32_t),
                
    PR_Send : lib.declare("PR_Send",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                ctypes.voidptr_t,
                ctypes.int32_t,
                ctypes.int32_t,
                ctypes.uint32_t),
                      
    PR_RecvFrom : lib.declare("PR_RecvFrom",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                ctypes.voidptr_t,
                ctypes.int32_t,
                ctypes.int32_t,
                NSPR.types.PRNetAddr.ptr,
                ctypes.uint32_t),
  
    PR_SendTo : lib.declare("PR_SendTo",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                ctypes.voidptr_t,
                ctypes.int32_t,
                ctypes.int32_t,
                NSPR.types.PRNetAddr.ptr,
                ctypes.uint32_t),
                
    PR_GetSockName : lib.declare("PR_GetSockName",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                NSPR.types.PRNetAddr.ptr),
                
    PR_GetPeerName : lib.declare("PR_GetPeerName",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRFileDesc.ptr,
                NSPR.types.PRNetAddr.ptr),
                
    PR_StringToNetAddr : lib.declare("PR_StringToNetAddr",
                ctypes.default_abi,
                ctypes.int32_t,
                ctypes.char.ptr,
                NSPR.types.PRNetAddr.ptr),
                
    PR_NetAddrToString : lib.declare("PR_NetAddrToString",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRNetAddr.ptr,
                ctypes.voidptr_t,
                ctypes.uint32_t)
  };
  
  NSPR.process = {
  
  	PR_CreateProcess : lib.declare("PR_CreateProcess",
                ctypes.default_abi,
                NSPR.types.PRProcess.ptr,
                ctypes.char.ptr,		// path
                ctypes.char.ptr,		// argv
                ctypes.char.ptr,		// envp
                NSPR.types.PRProcessAttr.ptr),
    
    PR_DetachProcess : lib.declare("PR_DetachProcess",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRProcess.ptr),
                
	PR_WaitProcess : lib.declare("PR_WaitProcess",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRProcess.ptr,
                ctypes.uint32_t.ptr),
    
    PR_KillProcess : lib.declare("PR_KillProcess",
                ctypes.default_abi,
                ctypes.int32_t,
                NSPR.types.PRProcess.ptr),
                
	PR_NewProcessAttr : lib.declare("PR_NewProcessAttr",
                ctypes.default_abi,
                NSPR.types.PRProcessAttr.ptr),

	PR_ResetProcessAttr : lib.declare("PR_ResetProcessAttr",
                ctypes.default_abi,
                ctypes.void_t,
                NSPR.types.PRProcessAttr.ptr),
                
    PR_DestroyProcessAttr : lib.declare("PR_DestroyProcessAttr",
                ctypes.default_abi,
                ctypes.void_t,
                NSPR.types.PRProcessAttr.ptr),
                
	PR_ProcessAttrSetStdioRedirect : lib.declare("PR_ProcessAttrSetStdioRedirect",
                ctypes.default_abi,
                ctypes.void_t,
                NSPR.types.PRProcessAttr.ptr,
                ctypes.uint32_t,
                NSPR.types.PRFileDesc.ptr),

	PR_ProcessAttrSetCurrentDirectory : lib.declare("PR_ProcessAttrSetCurrentDirectory",
                ctypes.default_abi,
                ctypes.uint32_t,
                NSPR.types.PRProcess.ptr,
                ctypes.char.ptr),

	PR_ProcessAttrSetInheritableFD : lib.declare("PR_ProcessAttrSetInheritableFD",
                ctypes.default_abi,
                ctypes.void_t,
                NSPR.types.PRProcess.ptr,
                NSPR.types.PRFileDesc.ptr,
                ctypes.char.ptr)
  };
  
  NSPR.file = {

  	// enum for PRAccessHow
	PR_ACCESS_EXISTS : 1,
	PR_ACCESS_WRITE_OK : 2,
	PR_ACCESS_READ_OK : 3,

	/* Open flags */
	PR_RDONLY : 0x01,
	PR_WRONLY : 0x02,
	PR_RDWR : 0x04,
	PR_CREATE_FILE : 0x08,
	PR_APPEND : 0x10,
	PR_TRUNCATE : 0x20,
	PR_SYNC : 0x40,
	PR_EXCL : 0x80,

	/*
	** File modes : http://mxr.mozilla.org/mozilla-central/source/nsprpub/pr/include/prio.h#626
	**
	** CAVEAT: 'mode' is currently only applicable on UNIX platforms.
	** The 'mode' argument may be ignored by PR_Open on other platforms.
	**
	**   00400   Read by owner.
	**   00200   Write by owner.
	**   00100   Execute (search if a directory) by owner.
	**   00040   Read by group.
	**   00020   Write by group.
	**   00010   Execute by group.
	**   00004   Read by others.
	**   00002   Write by others
	**   00001   Execute by others.
	*/
	
	PR_SEEK_SET : 0,
	PR_SEEK_CUR : 1,
	PR_SEEK_END : 2,
	
  	PR_Open : lib.declare("PR_Open",
                ctypes.default_abi,
                NSPR.types.PRFileDesc.ptr,
                ctypes.char.ptr,
                ctypes.size_t,	// instead of PRIntn we use size_t; this should be platform dependent ?
                ctypes.size_t),
                
	PR_Delete : lib.declare("PR_Delete",
                ctypes.default_abi,
                ctypes.uint32_t,
                ctypes.char.ptr),
	
	PR_GetFileInfo : lib.declare("PR_GetFileInfo",
                ctypes.default_abi,
                ctypes.uint32_t,
                ctypes.char.ptr,
                NSPR.types.PRFileInfo.ptr),
                
	PR_Rename : lib.declare("PR_Rename",
                ctypes.default_abi,
                ctypes.uint32_t,
                ctypes.char.ptr,
                ctypes.char.ptr),

	PR_Access : lib.declare("PR_Access",
                ctypes.default_abi,
                ctypes.uint32_t,
                ctypes.char.ptr,
                ctypes.uint32_t),
                
	PR_Close : lib.declare("PR_Close",
                ctypes.default_abi,
                ctypes.uint32_t,
                NSPR.types.PRFileDesc.ptr),

	PR_Read : lib.declare("PR_Read",
                ctypes.default_abi,
                ctypes.uint32_t,
                NSPR.types.PRFileDesc.ptr,
                ctypes.voidptr_t,
                ctypes.uint32_t),
                
	PR_Write : lib.declare("PR_Write",
                ctypes.default_abi,
                ctypes.uint32_t,
                NSPR.types.PRFileDesc.ptr,
                ctypes.voidptr_t,
                ctypes.uint32_t),

	PR_GetOpenFileInfo : lib.declare("PR_GetOpenFileInfo",
                ctypes.default_abi,
                ctypes.uint32_t,
                NSPR.types.PRFileDesc.ptr,
                NSPR.types.PRFileInfo.ptr)
  };

  NSPR.errors = {
  
    /* Memory allocation attempt failed */
    PR_OUT_OF_MEMORY_ERROR                   : -6000,
  
    /* Invalid file descriptor */
    PR_BAD_DESCRIPTOR_ERROR                  : -5999,
  
    /* The operation would have blocked */
    PR_WOULD_BLOCK_ERROR                     : -5998,
  
    /* Invalid memory address argument */
    PR_ACCESS_FAULT_ERROR                    : -5997,
  
    /* Invalid function for file type */
    PR_INVALID_METHOD_ERROR                  : -5996,
  
    /* Invalid memory address argument */
    PR_ILLEGAL_ACCESS_ERROR                  : -5995,
  
    /* Some unknown error has occurred */
    PR_UNKNOWN_ERROR                         : -5994,
  
    /* Operation interrupted by another thread */
    PR_PENDING_INTERRUPT_ERROR               : -5993,
  
    /* function not implemented */
    PR_NOT_IMPLEMENTED_ERROR                 : -5992,
  
    /* I/O function error */
    PR_IO_ERROR                              : -5991,
  
    /* I/O operation timed out */
    PR_IO_TIMEOUT_ERROR                      : -5990,
  
    /* I/O operation on busy file descriptor */
    PR_IO_PENDING_ERROR                      : -5989,
  
    /* The directory could not be opened */
    PR_DIRECTORY_OPEN_ERROR                  : -5988,
  
    /* Invalid function argument */
    PR_INVALID_ARGUMENT_ERROR                : -5987,
  
    /* Network address not available (in use?) */
    PR_ADDRESS_NOT_AVAILABLE_ERROR           : -5986,
  
    /* Network address type not supported */
    PR_ADDRESS_NOT_SUPPORTED_ERROR           : -5985,
  
    /* Already connected */
    PR_IS_CONNECTED_ERROR                    : -5984,
  
    /* Network address is invalid */
    PR_BAD_ADDRESS_ERROR                     : -5983,
  
    /* Local Network address is in use */
    PR_ADDRESS_IN_USE_ERROR                  : -5982,
  
    /* Connection refused by peer */
    PR_CONNECT_REFUSED_ERROR                 : -5981,
  
    /* Network address is presently unreachable */
    PR_NETWORK_UNREACHABLE_ERROR             : -5980,
  
    /* Connection attempt timed out */
    PR_CONNECT_TIMEOUT_ERROR                 : -5979,
  
    /* Network file descriptor is not connected */
    PR_NOT_CONNECTED_ERROR                   : -5978,
  
    /* Failure to load dynamic library */
    PR_LOAD_LIBRARY_ERROR                    : -5977,
  
    /* Failure to unload dynamic library */
    PR_UNLOAD_LIBRARY_ERROR                  : -5976,
  
    /* Symbol not found in any of the loaded dynamic libraries */
    PR_FIND_SYMBOL_ERROR                     : -5975,
  
    /* Insufficient system resources */
    PR_INSUFFICIENT_RESOURCES_ERROR          : -5974,
  
    /* A directory lookup on a network address has failed */
    PR_DIRECTORY_LOOKUP_ERROR                : -5973,
  
    /* Attempt to access a TPD key that is out of range */
    PR_TPD_RANGE_ERROR                       : -5972,
  
    /* Process open FD table is full */
    PR_PROC_DESC_TABLE_FULL_ERROR            : -5971,
  
    /* System open FD table is full */
    PR_SYS_DESC_TABLE_FULL_ERROR             : -5970,
  
    /* Network operation attempted on non-network file descriptor */
    PR_NOT_SOCKET_ERROR                      : -5969,
  
    /* TCP-specific function attempted on a non-TCP file descriptor */
    PR_NOT_TCP_SOCKET_ERROR                  : -5968,
  
    /* TCP file descriptor is already bound */
    PR_SOCKET_ADDRESS_IS_BOUND_ERROR         : -5967,
  
    /* Access Denied */
    PR_NO_ACCESS_RIGHTS_ERROR                : -5966,
  
    /* The requested operation is not supported by the platform */
    PR_OPERATION_NOT_SUPPORTED_ERROR         : -5965,
  
    /* The host operating system does not support the protocol requested */
    PR_PROTOCOL_NOT_SUPPORTED_ERROR          : -5964,
  
    /* Access to the remote file has been severed */
    PR_REMOTE_FILE_ERROR                     : -5963,
  
    /* The value requested is too large to be stored in the data buffer provided */
    PR_BUFFER_OVERFLOW_ERROR                 : -5962,
  
    /* TCP connection reset by peer */
    PR_CONNECT_RESET_ERROR                   : -5961,
  
    /* Unused */
    PR_RANGE_ERROR                           : -5960,
  
    /* The operation would have deadlocked */
    PR_DEADLOCK_ERROR                        : -5959,
  
    /* The file is already locked */
    PR_FILE_IS_LOCKED_ERROR                  : -5958,
  
    /* Write would result in file larger than the system allows */
    PR_FILE_TOO_BIG_ERROR                    : -5957,
  
    /* The device for storing the file is full */
    PR_NO_DEVICE_SPACE_ERROR                 : -5956,
  
    /* Unused */
    PR_PIPE_ERROR                            : -5955,
  
    /* Unused */
    PR_NO_SEEK_DEVICE_ERROR                  : -5954,
  
    /* Cannot perform a normal file operation on a directory */
    PR_IS_DIRECTORY_ERROR                    : -5953,
  
    /* Symbolic link loop */
    PR_LOOP_ERROR                            : -5952,
  
    /* File name is too long */
    PR_NAME_TOO_LONG_ERROR                   : -5951,
  
    /* File not found */
    PR_FILE_NOT_FOUND_ERROR                  : -5950,
  
    /* Cannot perform directory operation on a normal file */
    PR_NOT_DIRECTORY_ERROR                   : -5949,
  
    /* Cannot write to a read-only file system */
    PR_READ_ONLY_FILESYSTEM_ERROR            : -5948,
  
    /* Cannot delete a directory that is not empty */
    PR_DIRECTORY_NOT_EMPTY_ERROR             : -5947,
  
    /* Cannot delete or rename a file object while the file system is busy */
    PR_FILESYSTEM_MOUNTED_ERROR              : -5946,
  
    /* Cannot rename a file to a file system on another device */
    PR_NOT_SAME_DEVICE_ERROR                 : -5945,
  
    /* The directory object in the file system is corrupted */
    PR_DIRECTORY_CORRUPTED_ERROR             : -5944,
  
    /* Cannot create or rename a filename that already exists */
    PR_FILE_EXISTS_ERROR                     : -5943,
  
    /* Directory is full.  No additional filenames may be added */
    PR_MAX_DIRECTORY_ENTRIES_ERROR           : -5942,
  
    /* The required device was in an invalid state */
    PR_INVALID_DEVICE_STATE_ERROR            : -5941,
  
    /* The device is locked */
    PR_DEVICE_IS_LOCKED_ERROR                : -5940,
  
    /* No more entries in the directory */
    PR_NO_MORE_FILES_ERROR                   : -5939,
  
    /* Encountered end of file */
    PR_END_OF_FILE_ERROR                     : -5938,
  
    /* Seek error */
    PR_FILE_SEEK_ERROR                       : -5937,
  
    /* The file is busy */
    PR_FILE_IS_BUSY_ERROR                    : -5936,
  
    /* The I/O operation was aborted */
    PR_OPERATION_ABORTED_ERROR               : -5935,
  
    /* Operation is still in progress (probably a non-blocking connect) */
    PR_IN_PROGRESS_ERROR                     : -5934,
  
    /* Operation has already been initiated (probably a non-blocking connect) */
    PR_ALREADY_INITIATED_ERROR               : -5933,
  
    /* The wait group is empty */
    PR_GROUP_EMPTY_ERROR                     : -5932,
  
    /* Object state improper for request */
    PR_INVALID_STATE_ERROR                   : -5931,
  
    /* Network is down */
    PR_NETWORK_DOWN_ERROR                    : -5930,
  
    /* Socket shutdown */
    PR_SOCKET_SHUTDOWN_ERROR                 : -5929,
  
    /* Connection aborted */
    PR_CONNECT_ABORTED_ERROR                 : -5928,
  
    /* Host is unreachable */
    PR_HOST_UNREACHABLE_ERROR                : -5927,
  
    /* The library is not loaded */
    PR_LIBRARY_NOT_LOADED_ERROR              : -5926,
  
    /* The one-time function was previously called and failed. Its error code is no longer available */
    PR_CALL_ONCE_ERROR                       : -5925,
  
    /* Placeholder for the end of the list */
    PR_MAX_ERROR                             : -5924,
  
    ERROR_TABLE_BASE_nspr          : -6000,
  
                
    PR_GetError : lib.declare("PR_GetError",
                ctypes.default_abi,
                ctypes.int32_t),
                
    PR_GetOSError : lib.declare("PR_GetOSError",
                ctypes.default_abi,
                ctypes.int32_t),
  
    PR_GetErrorTextLength : lib.declare("PR_GetErrorTextLength",
                ctypes.default_abi,
                ctypes.int32_t),
                
    PR_GetErrorText : lib.declare("PR_GetErrorText",
                ctypes.default_abi,
                ctypes.int32_t,
                ctypes.char.ptr)            
  };

  NSPR.util = {
  
    PR_Now : lib.declare("PR_Now",
      ctypes.default_abi,
      ctypes.uint64_t),

    PR_IntervalNow : lib.declare("PR_IntervalNow",
      ctypes.default_abi,
      ctypes.uint32_t),

    PR_SI_HOSTNAME				: 0,
	PR_SI_SYSNAME				: 1,
	PR_SI_RELEASE				: 2,
	PR_SI_ARCHITECTURE			: 3,
	PR_SI_HOSTNAME_UNTRUNCATED	: 4,
	
	PR_GetSystemInfo : lib.declare("PR_GetSystemInfo",
						ctypes.default_abi,
						ctypes.int32_t,
						ctypes.int32_t,
						ctypes.voidptr_t,
						ctypes.int32_t),
						
	GetHostIP : function() {
		return "Not yet implemented."
	},

    PR_htons : lib.declare("PR_htons",
      ctypes.default_abi,
      ctypes.uint16_t,
      ctypes.uint16_t),

    PR_ntohs : lib.declare("PR_ntohs",
      ctypes.default_abi,
      ctypes.uint16_t,
      ctypes.uint16_t),

    StringToNetAddr : function StringToNetAddr(str) {
      var tmp = new NSPR.types.PRNetAddr();
      NSPR.sockets.PR_StringToNetAddr(str, tmp.address());
      return tmp.ip;
    },
    
    NetAddrToString : function NetAddrToString(addr) {
      var buffer = newBuffer(256);
      NSPR.sockets.PR_NetAddrToString(addr.address(), buffer, 256);
      for(var ip = "", i = 0; i < buffer[i] != '0'; i++)
		ip += String.fromCharCode(buffer[i]);
      return ip;
    }
  };

} catch (e) {
  throw 'nspr.js load error: ' + e;
}
