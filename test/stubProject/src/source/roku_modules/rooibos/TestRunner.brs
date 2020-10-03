' /**
'  * @module TestRunner
'  */
' /**
'  * @memberof module:TestRunner
'  * @name Rooibos_TestRunner
'  * @function
'  * @description Creates an instance of the test runner
'  * @param {Dynamic} args - contains the application launch args, and other settings required for test execution
'  */
function rooibos___TestRunner_builder()
    instance = {}
    instance.new = function(args = {})
        m.RunItGroups = TestRunnerMixin_runItGroups
        m.RunTestCases = TestRunnerMixin_runTestCases
        m.testScene = args.testScene
        m.nodeContext = args.nodeContext
        'bs:disable-next-line
        config = RBSFM_getRuntimeConfig()
        if (config = invalid or not rooibos_Common_isAssociativeArray(config)) then
            print "WARNING : specified config is invalid - using default"
            config = {
                showOnlyFailures: false,
                failFast: false
            }
        end if
        'mix in parsed in args
        if (args.showOnlyFailures <> invalid) then
            config.showOnlyFailures = args.showOnlyFailures = "true"
        end if
        if (args.failFast <> invalid) then
            config.failFast = args.failFast = "true"
        end if
        m.testUtilsDecoratorMethodName = args.testUtilsDecoratorMethodName
        m.config = config
        ' Internal properties
        m.config.testsDirectory = config.testsDirectory
        m.logger = rooibos_Logger(m.config)
        m.global = args.global
    end function
    ' /**
    '  * @memberof module:TestRunner
    '  * @name Run
    '  * @function
    '  * @instance
    '  * @description Executes all tests for a project, as per the config
    '  */
    instance.run = sub()
        if type(RBSFM_getTestSuitesForProject) <> "Function" then
            print " ERROR! RBSFM_getTestSuitesForProject is not found! That looks like you didn't run the preprocessor as part of your test process. Please refer to the docs."
            return
        end if
        totalStatObj = rooibos_Stats_createTotalStatistic()
        m.runtimeConfig = rooibos_UnitTestRuntimeConfig()
        m.runtimeConfig.global = m.global
        totalStatObj.testRunHasFailures = false
        for each metaTestSuite in m.runtimeConfig.suites
            if (m.runtimeConfig.hasSoloTests = true) then
                if (metaTestSuite.hasSoloTests <> true) then
                    if (m.config.logLevel = 2) then
                        print "TestSuite " ; metaTestSuite.name ; " Is filtered because it has no solo tests"
                    end if
                    goto skipSuite
                end if
            else if (m.runtimeConfig.hasSoloSuites) then
                if (metaTestSuite.isSolo <> true) then
                    if (m.config.logLevel = 2) then
                        print "TestSuite " ; metaTestSuite.name ; " Is filtered due to solo flag"
                    end if
                    goto skipSuite
                end if
            end if
            if (metaTestSuite.isIgnored = true) then
                if (m.config.logLevel = 2) then
                    print "Ignoring TestSuite " ; metaTestSuite.name ; " Due to Ignore flag"
                end if
                totalstatobj.ignored++
                totalStatObj.IgnoredTestNames.push("|-" + metaTestSuite.name + " [WHOLE SUITE]")
                goto skipSuite
            end if
            print ""
            print rooibos_Common_fillText("> SUITE: " + metaTestSuite.name, ">", 80)
            if (metaTestSuite.isNodeTest = true and metaTestSuite.nodeTestFileName <> "") then
                print " +++++RUNNING NODE TEST"
                nodeType = metaTestSuite.nodeTestFileName
                print " node type is " ; nodeType
                node = m.testScene.CallFunc("rooibos_createTestNode", nodeType)
                if (type(node) = "roSGNode" and node.subType() = nodeType) then
                    args = {
                        "metaTestSuite": metaTestSuite,
                        "testUtilsDecoratorMethodName": m.testUtilsDecoratorMethodName,
                        "config": m.config,
                        "runtimeConfig": m.runtimeConfig
                    }
                    nodeStatResults = node.callFunc("rooibos_runNodeTests", args)
                    if nodeStatResults <> invalid then
                        rooibos_Stats_mergeTotalStatistic(totalStatObj, nodeStatResults)
                    else
                        print " ERROR! The node " ; nodeType ; " did not return stats from the rooibos_runNodeTests method. This usually means you are not importing rooibosDist.brs, or rooibosFunctionMap.brs. Please refer to : https://github.com/georgejecook/rooibos/blob/master/docs/index.md#testing-scenegraph-nodes"
                    end if
                    m.testScene.RemoveChild(node)
                else
                    print " ERROR!! - could not create node required to execute tests for " ; metaTestSuite.name
                    print " Node of type " ; nodeType ; " was not found/could not be instantiated"
                end if
            else
                if (metaTestSuite.hasIgnoredTests) then
                    totalStatObj.IgnoredTestNames.push("|-" + metaTestSuite.name)
                end if
                m.RunItGroups(metaTestSuite, totalStatObj, m.testUtilsDecoratorMethodName, m.config, m.runtimeConfig, m.nodeContext)
            end if
            skipSuite:
        end for
        m.logger.PrintStatistic(totalStatObj)
        if rooibos_Common_isFunction(RBS_reportCodeCoverage) then
            'bs:disable-next-line
            RBS_reportCodeCoverage()
            if m.config.printLcov = true then
                rooibos_Coverage_printLCovInfo()
            end if
        end if
        m.sendHomeKeypress()
    end sub
    instance.sendHomeKeypress = sub()
        ut = createObject("roUrlTransfer")
        ut.SetUrl("http://localhost:8060/keypress/Home")
        ut.PostFromString("")
    end sub
    return instance
end function
function rooibos_TestRunner(args = {})
    instance = rooibos___TestRunner_builder()
    instance.new(args)
    return instance
end function

'TODO convert to namespace when Bron fixes bug that does not allow ns resoluiton on assignment
' namespace Rooibos.TestRunnerMixin
sub rooibos_TestRunnerMixin_runItGroups(metaTestSuite, totalStatObj, testUtilsDecoratorMethodName, config, runtimeConfig, nodeContext = invalid)
    if (testUtilsDecoratorMethodName <> invalid) then
        testUtilsDecorator = rooibos_Common_getFunctionBruteForce(testUtilsDecoratorMethodName)
        if (not rooibos_Common_isFunction(testUtilsDecorator)) then
            print "[ERROR] Test utils decorator method `" ; testUtilsDecoratorMethodName ; "` was not in scope! for testSuite: " + metaTestSuite.name
        end if
    end if
    for each itGroupData in metaTestSuite.itGroups
        itGroup = rooibos_ItGroup(itGroupData)
        testSuite = itGroup.getRunnableTestSuite()
        if (nodeContext <> invalid) then
            testSuite.node = nodeContext
            testSuite.global = nodeContext.global
            testSuite.top = nodeContext.top
        end if
        if (rooibos_Common_isFunction(testUtilsDecorator)) then
            testUtilsDecorator(testSuite)
        end if
        totalStatObj.Ignored = totalStatObj.Ignored + itGroup.ignoredTestCases.count()
        if (itGroup.isIgnored = true) then
            if (config.logLevel = 2) then
                print "Ignoring itGroup " ; itGroup.name ; " Due to Ignore flag"
            end if
            totalStatObj.ignored = totalStatObj.ignored + itGroup.testCases.count()
            totalStatObj.IgnoredTestNames.push("  |-" + itGroup.name + " [WHOLE GROUP]")
            goto skipItGroup
        else
            if (itGroup.ignoredTestCases.count() > 0) then
                totalStatObj.IgnoredTestNames.push("  |-" + itGroup.name)
                totalStatObj.ignored = totalStatObj.ignored + itGroup.ignoredTestCases.count()
                for each testCase in itGroup.ignoredTestCases
                    if (testcase.isParamTest <> true) then
                        totalStatObj.IgnoredTestNames.push("  | |--" + testCase.name)
                    else if (testcase.paramTestIndex = 0) then
                        testCaseName = testCase.name
                        if (len(testCaseName) > 1 and right(testCaseName, 1) = "0") then
                            testCaseName = left(testCaseName, len(testCaseName) - 1)
                        end if
                        totalStatObj.IgnoredTestNames.push("  | |--" + testCaseName)
                    end if
                end for
            end if
        end if
        if (runtimeConfig.hasSoloTests) then
            if (itGroup.hasSoloTests <> true) then
                if (config.logLevel = 2) then
                    print "Ignoring itGroup " ; itGroup.name ; " Because it has no solo tests"
                end if
                goto skipItGroup
            end if
        else if (runtimeConfig.hasSoloGroups) then
            if (itGroup.isSolo <> true) then
                goto skipItGroup
            end if
        end if
        if (testSuite.testCases.Count() = 0) then
            if (config.logLevel = 2) then
                print "Ignoring TestSuite " ; itGroup.name ; " - NO TEST CASES"
            end if
            goto skipItGroup
        end if
        print ""
        print rooibos_Common_fillText("> GROUP: " + itGroup.name, ">", 80)
        if rooibos_Common_isFunction(testSuite.SetUp) then
            testSuite.SetUp()
        end if
        rooibos_TestRunnerMixin_runTestCases(metaTestSuite, itGroup, testSuite, totalStatObj, config, runtimeConfig)
        if rooibos_Common_isFunction(testSuite.TearDown) then
            testSuite.TearDown()
        end if
        if (totalStatObj.testRunHasFailures = true and config.failFast = true) then
            exit for
        end if
        skipItGroup:
    end for
end sub

sub rooibos_TestRunnerMixin_runTestCases(metaTestSuite, itGroup, testSuite, totalStatObj, config, runtimeConfig)
    suiteStatObj = rooibos_Stats_createSuiteStatistic(itGroup.name)
    testSuite.global = runtimeConfig.global
    for each testCase in testSuite.testCases
        metaTestCase = itGroup.testCaseLookup[testCase.name]
        metaTestCase.time = 0
        if (runtimeConfig.hasSoloTests and not metaTestCase.isSolo) then
            goto skipTestCase
        end if
        print ""
        print rooibos_Common_fillText("> TEST: " + testCase.name + " ", ">", 80)
        if rooibos_Common_isFunction(testSuite.beforeEach) then
            testSuite.beforeEach()
        end if
        testTimer = createObject("roTimespan")
        testCaseTimer = createObject("roTimespan")
        testStatObj = rooibos_Stats_createTestStatistic(testCase.name)
        testSuite.testCase = testCase.Func
        testStatObj.filePath = metaTestSuite.filePath
        testStatObj.metaTestCase = metaTestCase
        testSuite.currentResult = rooibos_UnitTestResult()
        testStatObj.metaTestCase.testResult = testSuite.currentResult
        if (metaTestCase.isParamsValid) then
            if (metaTestCase.isParamTest) then
                testCaseParams = []
                for paramIndex = 0 to metaTestCase.rawParams.count()
                    paramValue = metaTestCase.rawParams[paramIndex]
                    if type(paramValue) = "roString" and len(paramValue) >= 8 and left(paramValue, 8) = "#RBSNode" then
                        nodeType = "ContentNode"
                        paramDirectiveArgs = paramValue.split("|")
                        if paramDirectiveArgs.count() > 1 then
                            nodeType = paramDirectiveArgs[1]
                        end if
                        paramValue = createObject("roSGNode", nodeType)
                    end if
                    testCaseParams.push(paramValue)
                end for
                testCaseTimer.mark()
                'up to 10 param args supported for now
                if (metaTestCase.expectedNumberOfParams = 1) then
                    testSuite.testCase(testCaseParams[0])
                else if (metaTestCase.expectedNumberOfParams = 2) then
                    testSuite.testCase(testCaseParams[0], testCaseParams[1])
                else if (metaTestCase.expectedNumberOfParams = 3) then
                    testSuite.testCase(testCaseParams[0], testCaseParams[1], testCaseParams[2])
                else if (metaTestCase.expectedNumberOfParams = 4) then
                    testSuite.testCase(testCaseParams[0], testCaseParams[1], testCaseParams[2], testCaseParams[3])
                else if (metaTestCase.expectedNumberOfParams = 5) then
                    testSuite.testCase(testCaseParams[0], testCaseParams[1], testCaseParams[2], testCaseParams[3], testCaseParams[4])
                else if (metaTestCase.expectedNumberOfParams = 6) then
                    testSuite.testCase(testCaseParams[0], testCaseParams[1], testCaseParams[2], testCaseParams[3], testCaseParams[4], testCaseParams[5])
                else if (metaTestCase.expectedNumberOfParams = 7) then
                    testSuite.testCase(testCaseParams[0], testCaseParams[1], testCaseParams[2], testCaseParams[3], testCaseParams[4], testCaseParams[5], testCaseParams[6])
                else if (metaTestCase.expectedNumberOfParams = 8) then
                    testSuite.testCase(testCaseParams[0], testCaseParams[1], testCaseParams[2], testCaseParams[3], testCaseParams[4], testCaseParams[5], testCaseParams[6], testCaseParams[7])
                else if (metaTestCase.expectedNumberOfParams = 9) then
                    testSuite.testCase(testCaseParams[0], testCaseParams[1], testCaseParams[2], testCaseParams[3], testCaseParams[4], testCaseParams[5], testCaseParams[6], testCaseParams[7], testCaseParams[8])
                else if (metaTestCase.expectedNumberOfParams = 10) then
                    testSuite.testCase(testCaseParams[0], testCaseParams[1], testCaseParams[2], testCaseParams[3], testCaseParams[4], testCaseParams[5], testCaseParams[6], testCaseParams[7], testCaseParams[8], testCaseParams[9])
                else if (metaTestCase.expectedNumberOfParams = 11) then
                    testSuite.testCase(testCaseParams[0], testCaseParams[1], testCaseParams[2], testCaseParams[3], testCaseParams[4], testCaseParams[5], testCaseParams[6], testCaseParams[7], testCaseParams[8], testCaseParams[9], testCaseParams[10])
                else if (metaTestCase.expectedNumberOfParams = 12) then
                    testSuite.testCase(testCaseParams[0], testCaseParams[1], testCaseParams[2], testCaseParams[3], testCaseParams[4], testCaseParams[5], testCaseParams[6], testCaseParams[7], testCaseParams[8], testCaseParams[9], testCaseParams[10], testCaseParams[11])
                else if (metaTestCase.expectedNumberOfParams > 12) then
                    testSuite.fail("Test case had more than 12 params. Max of 12 params is supported")
                end if
                metaTestCase.time = testCaseTimer.totalMilliseconds()
            else
                testCaseTimer.mark()
                testSuite.testCase()
                metaTestCase.time = testCaseTimer.totalMilliseconds()
            end if
        else
            testSuite.Fail("Could not parse args for test ")
        end if
        if testSuite.isAutoAssertingMocks = true then
            testSuite.AssertMocks()
            testSuite.CleanMocks()
            testSuite.CleanStubs()
        end if
        runResult = testSuite.currentResult.getResult()
        if runResult <> "" then
            testStatObj.result = "Fail"
            testStatObj.error.Code = 1
            testStatObj.error.Message = runResult
        else
            testStatObj.result = "Success"
        end if
        testStatObj.time = testTimer.totalMilliseconds()
        rooibos_Stats_appendTestStatistic(suiteStatObj, testStatObj)
        if rooibos_Common_isFunction(testSuite.afterEach) then
            testSuite.afterEach()
        end if
        if testStatObj.result <> "Success" then
            totalStatObj.testRunHasFailures = true
        end if
        if testStatObj.result = "Fail" and config.failFast = true then
            exit for
        end if
        skipTestCase:
    end for
    suiteStatObj.metaTestSuite = metaTestSuite
    rooibos_Stats_appendSuiteStatistic(totalStatObj, suiteStatObj)
end sub