#!/bin/sh
#
# This file is the central defintion of version and build number.
#
version=0.2
build=`svn info | grep 'Revision:' | awk '{print $2}'`

# This is a public key
updatekey='MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCaZ4+jzpLhBjzVvL5Gji8SVN1pkNQwiCG1WwnB1RQNSIftDlJfYSPBfGDnpOtYJKWh8RuKIZ1k8oUyJWSmBGyp1TCwhDppHflAGVC+DaaN0Ax6XIn9SI9Ung\/AtO5CORKiBH6Qnt\/wDSm5iRsy97MSzRg32eE06COJw7z2wpNUhwIDAQAB'

# We source this script from the documentation extraction script, but
# there don't want to actually update any files.  Thus we use a
# command line argument, and bail if it's found.
if [ "$1" != docbuild ]; then
    cat install.rdf.in \
	| sed "s/@VERSION@/${version}build${build}/" \
	| sed "s/@UPDATEKEY@/${updatekey}/" \
	>install.rdf
	   
    cat defaults/preferences/defaults.js.in \
	| sed "s/@VERSION@/$version/" \
	| sed "s/@BUILD@/$build/" \
	>defaults/preferences/defaults.js
fi
