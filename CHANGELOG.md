## [0.25.3](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.25.2...0.25.3) (2022-08-01)


### Bug Fixes

* **nodeclasses:** fixes crash on task ([0285c55](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/0285c552d22e6dfd9169f120e2b7bdbb9c09bfe5))


### Features

* **nodetask:** adds suppport for auto-handling errors during execution ([df32116](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/df32116d9c0ff8c5eac1d5b92ea46dab0f47e8df))



# [0.25.0](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.24.0...0.25.0) (2022-06-07)


### Bug Fixes

* **core:** does not check for namespac m injection on call expressions with no dots ([9a0063a](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/9a0063ae83d2b5a4a64a9e1859a644c7002ced48))
* **nodeclasses:** supports enum values for public fields ([3663198](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/3663198ac34e5c431810afaed382ec75555930a5))



## [0.22.1](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.21.5...0.22.1) (2022-05-23)


### Bug Fixes

* **core:** removes noisy logoutput and exception ([3fd648c](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/3fd648ccd75149e0fd27e0175c852a24e9f2f12d))
* **reflection:** fixes classes not getting added to reflection methods ([3351bd3](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/3351bd3d00947b414a27303841d373488b147352))
* **validation:** correctly handles sitatuions where namespaces are in multiple files when validationg if a namespace import is missing ([1b3a3f5](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/1b3a3f5bb24456f44a7ebf6d5fa4a4e59ff5a9c9))


### Features

* **core:** adds diagnstocis for problems with mismatched observers ([c6cabc0](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/c6cabc0f5d7d55307404f472753fac252f6f7375))
* **core:** adds support for [@inject](https://github.com/inject)LocalM annotation, so that a function can indicate that the compiler should provide m, if not set manually ([1d4d67c](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/1d4d67c7149015ec909ebb7ade35d73a613d141d))
* **core:** adds support for asXXX(simpleValue) ([1381aaa](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/1381aaad31127f65c89f02431aa35b5ecc5b1b07))



## [0.20.3](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.20.2...0.20.3) (2022-04-20)



## [0.20.2](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.20.1...0.20.2) (2022-04-14)


### Bug Fixes

* **imports:** fixes crash when managing dynamic imports on bsc > 0.45.3 ([0ab956d](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/0ab956d1aec2091f6d22c6cab76042e7e46b55fd))
* Fixes issue that prevented lines of code like: getAA(items[0].thing.text) from transpiling ([963d287](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/963d287a6c8de26cc7ec1d5b06bde218982b30af))
* **core:** as_xxx methods must START with as_ to be considered ([14999dc](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/14999dce6b9665da0ed29d42243e255e377568d7))



## [0.18.1](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.18.0...0.18.1) (2022-02-26)



# [0.17.0](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.16.0...0.17.0) (2022-02-14)


### Features

* **NodeClass:** adds [@root](https://github.com/root)Observer so that [@observer](https://github.com/observer) annotations can specify to not callback when the root object did not change ([96b297a](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/96b297a268a449b97426097414d481c4b7428084))



## [0.15.3](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.15.2...0.15.3) (2022-01-19)


### Bug Fixes

* **validation:** fixes issues that caused the validator to go wrong in bsc > 0.41.6 ([e1d8eea](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/e1d8eea70d40901b263251513695bcd732d42b4f))



## [0.15.1](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.15.0...0.15.1) (2022-01-13)


### Bug Fixes

* fixes crash when changing types of functions ([67f1f94](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/67f1f949357ce83684ab6bb5bf69eedc24e0af0d))
* improves stripping of types, changing reutrn types to functions to dynamic, except where already explicitly void ([80e14ad](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/80e14ad54863f9fbfc5b53366c709a99eabfebec))


### Features

* **validation:** adds extra validations for missing imports for class methods, classes, and namespaceS ([9fe1b6b](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/9fe1b6b88c3ed83671ae60e6d01e86bc9af607f9))
* adds config flags to allow files to be excluded from reflection lookup ([bd94e93](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/bd94e93607f346e55adb50e1ddb40129be17e5fd))
* adds flag to allow skipping of param stripping based on function names ([a6f6069](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/a6f6069b12103fe159f02a3657fc2e36827e6042))
* ensure node classes generate inherited fields from super classes that did not have nodes ([f53148d](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/f53148d29e41b776df863617ef39aed6ef1f3f40))



# [0.12.0](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.11.0...0.12.0) (2021-08-27)


### Bug Fixes

* improves handling of class types as nodeclass fields, defaulting them to assocarray in generated xml, and raising diagnostics when unknown classes are referenced ([3eea4d1](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/3eea4d103e274184b12e69690446d065574a7f7b))



# [0.11.0](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.10.0...0.11.0) (2021-05-27)


### Bug Fixes

* do not create observers for parent nodeclass fields ([1facf6f](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/1facf6fec5b472a5be67224ea9485ae1f1b3c0db))


### Features

* enforce strict mode for classes, by default ([c0e9f5e](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/c0e9f5e6fa35247210168ff1a475d964751bff2d))



# [0.10.0](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.9.3...0.10.0) (2021-05-22)


### Features

* adds flag to allow stripping of type declarations on params ([2274ee4](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/2274ee4d5c04c23986cf3091161730db1b6e8317))



## [0.9.3](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.9.1...0.9.3) (2021-05-18)


### Bug Fixes

* fixes fialing test ([cb136e9](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/cb136e9bb7957b2d7f2c177bfe9d7d1bd6f9d25c))
* uses correct default values for wrapper functions ([24648a7](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/24648a78610048082cc8933f911fc9ab44c36ce0))



## [0.9.1](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.9.0...0.9.1) (2021-05-18)


### Bug Fixes

* fixes issues with creating nodeclass test helpers ([9462932](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/94629327d2748d0f22d527e4716b25d9ca2e6e52))



# [0.9.0](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.8.1...0.9.0) (2021-05-17)


### Features

* adds ability to generate node classes with injected global and top, for test scenarios: ([6dfdbeb](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/6dfdbeb630067f6be3efa06237a2b54ef018c7b0))



## [0.8.1](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.8.0...0.8.1) (2021-05-12)


### Features

* can set fields on any node via virtual fields property, as a step to deprecating styles in maestro-roku framework ([78a0a71](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/78a0a716a2ad881ad392352cc933ad103dbb4767))



# [0.8.0](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.7.1...0.8.0) (2021-05-06)



## [0.7.1](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.7.0...0.7.1) (2021-05-03)



# [0.7.0](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.6.3...0.7.0) (2021-04-29)


### Bug Fixes

* **bindings:** Fixes incorrectly named binding function ([b0e18bf](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/b0e18bfe36a717b189cdfa440966a9700eb193f0))
* **tests:** Fixes failing tests ([dc2fbbd](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/dc2fbbdc6eccfee97ddd1afe515cc4dda81dddcd))


### Features

* **config:** Adds addFrameworkFiles setting, to help with unit testing ([2f4e9ae](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/2f4e9aeb3614e826933f3ee7e68bd407e04aa95f))



## [0.6.3](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.6.2...0.6.3) (2021-04-28)


### Features

* **nodeclass:** Adds observerswaitinitialize annotation, which delays wiring up of observers until initialize is called on the parent class ([cb52a10](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/cb52a10e10b8b34aea8c003792ad00c07863bc1c))



## [0.6.2](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.6.1...0.6.2) (2021-04-26)


### Bug Fixes

* **mvvm:** Imrpoves generated binding call, to go via vm ([8d38082](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/8d38082ce2a3416dec099a0ca1dc5af5da90918d))



## [0.6.1](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.6.0...0.6.1) (2021-04-22)



# [0.6.0](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.5.3...0.6.0) (2021-04-22)



## [0.5.3](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.5.2...0.5.3) (2021-04-22)



## [0.5.2](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.5.1...0.5.2) (2021-04-22)


### Bug Fixes

* **NodeClass:** seems bsc has changed fields to case sensitive -fixes that issue ([f23bc3b](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/f23bc3b70c955a790085159f4600d045b2bd1954))



## [0.5.1](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.5.0...0.5.1) (2021-04-22)


### Bug Fixes

* **NodeClass:** Nodeclasses will now include parent fields in their xml ([7ab829b](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/7ab829bc728f350484131627961327e7d2205cdc))



# [0.5.0](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.3.6...0.5.0) (2021-04-17)


### Bug Fixes

* **nodeClass:** some optimizations, using event.getData() instead of rendezvous prone looking up on m.top ([4686b89](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/4686b89c4f29401af9d9dada4c7f8b2d9cfab03c))



## [0.3.6](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.3.5...0.3.6) (2021-03-04)



## [0.3.5](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.3.4...0.3.5) (2021-03-02)



## [0.3.4](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.3.3...0.3.4) (2021-03-01)



## [0.3.3](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.3.2...0.3.3) (2021-03-01)



## [0.3.2](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.3.1...0.3.2) (2021-02-26)



## [0.3.1](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.2.6...0.3.1) (2021-02-25)



## [0.2.6](https://github.com/georgejecook/maestro-roku-bsc-plugin/compare/0.2.0...0.2.6) (2021-02-23)


### Bug Fixes

* calls correct util method for getting static binding path ([c6f3d7b](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/c6f3d7b111db5e2704a64742cd00a6af9a5573c3))
* ensure that full path is maintined for static bindings ([87d5c43](https://github.com/georgejecook/maestro-roku-bsc-plugin/commit/87d5c43f1e8181e60aa2b82810d1b925e01b400e))



# 0.2.0 (2021-02-09)


