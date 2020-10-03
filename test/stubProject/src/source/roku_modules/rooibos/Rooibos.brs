' /**
'  * @module rooibos
'  */
' /**
'  * @memberof module:rooibos
'  * @name Rooibos_init
'  * @function
'  * @description Entry point for rooibos unit testing framework. Will identify, run, and report all tests in the app, before terminating the application.
'  * @param {Dynamic} preTestSetup - called to do any initialization once the screen is created
'  *                   Use this to configure anything such as globals, etc that you need
'  * @param {Dynamic} testUtilsDecorator - will be invoked, with the test case as a param - the function
'  *                     can then compose/decorate any additional functionality, as required
'  *                   Use this to add things like, rodash, common test utils, etc
'  * @param testsSceneName as string - name of scene to create. All unit tests run in the scene thread
'  *                   and therefore require a screen and scene are created.
'  * @param nodeContext as object - this is the global scope of your tests - so where anonymous methods will run from. This should be m
'  */
function init(preTestSetup = invalid, testUtilsDecoratorMethodName = invalid, testSceneName = invalid, nodeContext = invalid) as void
    args = {}
    if createObject("roAPPInfo").IsDev() <> true then
        print " not running in dev mode! - rooibos tests only support sideloaded builds - aborting"
        return
    end if
    args.testUtilsDecoratorMethodName = testUtilsDecoratorMethodName
    args.nodeContext = nodeContext
    screen = CreateObject("roSGScreen")
    m.port = CreateObject("roMessagePort")
    screen.setMessagePort(m.port)
    if testSceneName = invalid then
        testSceneName = "TestsScene"
    end if
    print "Starting test using test scene with name TestsScene" ; testSceneName
    scene = screen.CreateScene(testSceneName)
    scene.id = "ROOT"
    screen.show()
    m.global = screen.getGlobalNode()
    m.global.addFields({
        "testsScene": scene
    })
    if (preTestSetup <> invalid) then
        preTestSetup(screen)
    end if
    testId = args.TestId
    if (testId = invalid) then
        testId = "UNDEFINED_TEST_ID"
    end if
    print "#########################################################################"
    print "#TEST START : ###" ; testId ; "###"
    args.testScene = scene
    args.global = m.global
    rooibosVersion = "#ROOIBOS_VERSION#"
    requiredRooibosPreprocessorVersion = "1.0.0"
    if not rooibos_Common_isFunction(RBSFM_getPreprocessorVersion) then
        versionError = "You are using a rooibos-preprocessor (i.e. rooibos-cli) version older than 1.0.0 - please update to " + requiredRooibosPreprocessorVersion
    else 'bs:disable-next-line
        if rooibos_versionCompare(RBSFM_getPreprocessorVersion(), requiredRooibosPreprocessorVersion) >= 0 then
            versionError = ""
        else 'bs:disable-next-line
            versionError = "Your rooibos-preprocessor (i.e. rooibos-cli) version '" + RBSFM_getPreprocessorVersion() + "' is not compatible with rooibos version " + rooibosVersion + ". Please upgrade your rooibos-cli to version " + requiredRooibosPreprocessorVersion
        end if
    end if
    if versionError = "" then
        print "######################################################"
        print ""
        print "# rooibos framework version: " ; rooibosVersion
        'bs:disable-next-line
        print "# tests parsed with rooibosC version: " ; RBSFM_getPreprocessorVersion()
        print "######################################################"
        print ""
        if scene.hasField("isReadyToStartTests") and scene.isReadyToStartTests = false then
            print "The scene is not ready yet - waiting for it to set isReadyToStartTests to true"
            scene.observeField("isReadyToStartTests", m.port)
        else
            print "scene is ready; running tests now"
            runner = rooibos_TestRunner(args)
            runner.Run()
        end if
        while (true)
            msg = wait(0, m.port)
            msgType = type(msg)
            if msgType = "roSGScreenEvent" then
                if msg.isScreenClosed() then
                    return
                end if
            else if msgType = "roSGNodeEvent" then
                if msg.getField() = "isReadyToStartTests" and msg.getData() = true then
                    print "scene is ready; running tests now"
                    runner = rooibos_TestRunner(args)
                    runner.Run()
                end if
            end if
        end while
    else
        print ""
        print "#########################################################"
        print "ERROR - VERSION MISMATCH"
        print versionError
        print "#########################################################"
    end if
end function

function rooibos_versionCompare(v1, v2)
    v1parts = v1.split(".")
    v2parts = v2.split(".")
    while v1parts.count() < v2parts.count()
        v1parts.push("0")
    end while
    while v2parts.count() < v1parts.count()
        v2parts.push("0")
    end while
    for i = 0 to v1parts.count() - 1
        if (v2parts.count() = i) then
            return 1
        end if
        if (v1parts[i] <> v2parts[i]) then
            if (v1parts[i] > v2parts[i]) then
                return 1
            else
                return - 1
            end if
        end if
    end for
    if (v1parts.count() <> v2parts.count()) then
        return - 1
    end if
    return 0
end function