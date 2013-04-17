## Introduction
The Fathom project explores the browser as a platform for network measurement and troubleshooting. It provides a wide range of networking primitives directly to in-page JavaScript. Using Fathom's APIs you get direct TCP/UDP socket access, higher-level protocol APIs such as DNS, HTTP, and UPnP, and ready-made functionality such as pings and traceroutes.

Fathom currently supports the Firefox browser in form of a JavaScript-only extension. We're aiming to support other browsers in the near future. (If you're a Chrome guru and would like to help us with the port, consider joining ![our GSoC projects](http://measurementlab.net/gsoc_2013)!) 

## Documentation
API docs ![are available](http://fathom.icsi.berkeley.edu/docs/index.html).

## Demo code
As a proof of concept, Fathom currently includes a connectivity debugger that we built purely using Fathom's APIs. You can run the debugger at any time by clicking "Debug my connection" in Fathom's menu. The analysis also automatically kicks in whenever Firefox flags an error to the user:

![Fathom](http://icir.org/christian/proj/fathom/fathom.png)

## More information
Feel free to take a look at our recent ![IMC paper on Fathom](http://www.icir.org/christian/publications/2012-imc-fathom.pdf) for a lot more details about the platform.

## Contact
If you have questions or suggestions, feel free to contact us at fathom@icsi.berkeley.edu.
