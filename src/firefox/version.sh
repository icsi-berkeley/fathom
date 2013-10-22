#!/bin/sh
#
# This file is the central defintion of version and build number.
#
version=0.2
build=`svn info | grep 'Revision:' | awk '{print $2}'`

# This is a public key
updatekey='MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCaww+igknCDR2\/kWisLU8lnxGqCr50lL1oIRJHvKokqskEtyB+p1FS5Tiq1rkCdiNb3RFU9e9PYNiLT\/zqx3hMn6u+EFbpjInKgit79YTTQa+LveB1oOgkXJHYXfDE7aNB06xMGhIFzt3cu2o7VSs32bijHsjESI4AHCdKTFHODwIDAQAB'

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
