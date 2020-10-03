function rooibos___Logger_builder()
    instance = {}
    instance.new = function(config)
        m.config = config
        m.verbosityLevel = {
            basic: 0,
            normal: 1,
            verbose: 2
        }
        m.verbosity = m.config.logLevel
    end function
    '----------------------------------------------------------------
    ' Print statistic object with specified verbosity.
    '
    ' @param statObj (object) A statistic object to print.
    '----------------------------------------------------------------
    instance.printStatistic = sub(statObj as object)
        m.PrintStart()
        previousfile = invalid
        for each testSuite in statObj.Suites
            if (not statObj.testRunHasFailures or ((not m.config.showOnlyFailures) or testSuite.fail > 0 or testSuite.crash > 0)) then
                if (testSuite.metaTestSuite.filePath <> previousfile) then
                    m.PrintMetaSuiteStart(testSuite.metaTestSuite)
                    previousfile = testSuite.metaTestSuite.filePath
                end if
                m.PrintSuiteStatistic(testSuite, statObj.testRunHasFailures)
            end if
        end for
        print ""
        m.PrintEnd()
        'bs:disable-next-line
        ignoredInfo = RBSFM_getIgnoredTestInfo()
        print "Total  = " ; rooibos_Common_AsString(statObj.Total) ; " ; Passed  = " ; statObj.Correct ; " ; Failed   = " ; statObj.Fail ; " ; Ignored   = " ; ignoredInfo.count
        print " Time spent: " ; statObj.Time ; "ms"
        print ""
        print ""
        if (ignoredInfo.count > 0) then
            print "IGNORED TESTS:"
            for each ignoredItemName in ignoredInfo.items
                print ignoredItemName
            end for
        end if
        if (statObj.ignored > 0) then
            print "IGNORED TESTS:"
            for each ignoredItemName in statObj.IgnoredTestNames
                print ignoredItemName
            end for
        end if
        if (statObj.Total = statObj.Correct) then
            overrallResult = "Success"
        else
            overrallResult = "Fail"
        end if
        print "RESULT: " ; overrallResult
    end sub
    '----------------------------------------------------------------
    ' Print test suite statistic.
    '
    ' @param statSuiteObj (object) A target test suite object to print.
    '----------------------------------------------------------------
    instance.printSuiteStatistic = sub(statSuiteObj as object, hasFailures)
        m.PrintSuiteStart(statSuiteObj.Name)
        for each testCase in statSuiteObj.Tests
            if (not hasFailures or ((not m.config.showOnlyFailures) or testCase.Result <> "Success")) then
                m.PrintTestStatistic(testCase)
            end if
        end for
        print " |"
    end sub
    instance.printTestStatistic = sub(testCase as object)
        metaTestCase = testCase.metaTestCase
        if (LCase(testCase.Result) <> "success") then
            testChar = "-"
            if metaTestCase.testResult.failedMockLineNumber > - 1 then
                lineNumber = metaTestCase.testResult.failedMockLineNumber
            else
                assertIndex = metaTestCase.testResult.failedAssertIndex
                lineNumber = rooibos_Common_getAssertLine(metaTestCase, assertIndex)
            end if
            if lineNumber <> invalid then
                locationLine = StrI(lineNumber).trim()
            else
                locationLine = StrI(metaTestCase.lineNumber).trim()
            end if
        else
            testChar = "|"
            locationLine = StrI(metaTestCase.lineNumber).trim()
        end if
        locationText = "pkg:/" + testCase.filePath.trim() + "(" + locationLine + ")"
        if m.config.printTestTimes = true then
            timeText = " (" + stri(metaTestCase.time).trim() + "ms)"
        else
            timeText = ""
        end if
        insetText = ""
        if (metaTestcase.isParamTest <> true) then
            messageLine = rooibos_Common_fillText(" " + testChar + " |--" + metaTestCase.Name + " : ", ".", 80)
            print messageLine ; testCase.Result ; timeText
        else if (metaTestcase.paramTestIndex = 0) then
            name = metaTestCase.Name
            if (len(name) > 1 and right(name, 1) = "0") then
                name = left(name, len(name) - 1)
            end if
            print " " + testChar + " |--" + name + " : "
        end if
        if (metaTestcase.isParamTest = true) then
            insetText = "  "
            if type(metaTestCase.rawParams) = "roAssociativeArray" then
                rawParams = {}
                for each key in metaTestCase.rawParams
                    if type(metaTestCase.rawParams[key]) <> "Function" and type(metaTestCase.rawParams[key]) <> "roFunction" then
                        rawParams[key] = metaTestCase.rawParams[key]
                    end if
                end for
            else
                rawParams = metaTestCase.rawParams
            end if
            messageLine = rooibos_Common_fillText(" " + testChar + insetText + " |--" + formatJson(rawParams) + " : ", ".", 80)
            print messageLine ; testCase.Result ; timeText
        end if
        if LCase(testCase.Result) <> "success" then
            print " | " ; insettext ; "  |--Location: " ; locationText
            if (metaTestcase.isParamTest = true) then
                print " | " ; insettext ; "  |--Param Line: " ; StrI(metaTestCase.paramlineNumber).trim()
            end if
            print " | " ; insettext ; "  |--Error Message: " ; testCase.Error.Message
        end if
    end sub
    '----------------------------------------------------------------
    ' Print testting start message.
    '----------------------------------------------------------------
    instance.printStart = sub()
        print ""
        print "[START TEST REPORT]"
        print ""
    end sub
    '----------------------------------------------------------------
    ' Print testing end message.
    '----------------------------------------------------------------
    instance.printEnd = sub()
        print ""
        print "[END TEST REPORT]"
        print ""
    end sub
    '----------------------------------------------------------------
    ' Print test suite SetUp message.
    '----------------------------------------------------------------
    instance.printSuiteSetUp = sub(sName as string)
        if m.verbosity = m.verbosityLevel.verbose then
            print "================================================================="
            print "===   SetUp " ; sName ; " suite."
            print "================================================================="
        end if
    end sub
    '----------------------------------------------------------------
    ' Print test suite start message.
    '----------------------------------------------------------------
    instance.printMetaSuiteStart = sub(metaTestSuite)
        print metaTestSuite.name ; " " ; "pkg:/" ; metaTestSuite.filePath + "(1)"
    end sub
    '----------------------------------------------------------------
    ' Print '@It group start message.
    '----------------------------------------------------------------
    instance.printSuiteStart = sub(sName as string)
        '  ? "It "; sName
        print " |-" ; sName
        '  ? ""
    end sub
    '----------------------------------------------------------------
    ' Print test suite TearDown message.
    '----------------------------------------------------------------
    instance.printSuiteTearDown = sub(sName as string)
        if m.verbosity = m.verbosityLevel.verbose then
            print "================================================================="
            print "===   TearDown " ; sName ; " suite."
            print "================================================================="
        end if
    end sub
    '----------------------------------------------------------------
    ' Print test setUp message.
    '----------------------------------------------------------------
    instance.printTestSetUp = sub(tName as string)
        if m.verbosity = m.verbosityLevel.verbose then
            print "----------------------------------------------------------------"
            print "---   SetUp " ; tName ; " test."
            print "----------------------------------------------------------------"
        end if
    end sub
    '----------------------------------------------------------------
    ' Print test TearDown message.
    '----------------------------------------------------------------
    instance.printTestTearDown = sub(tName as string)
        if m.verbosity = m.verbosityLevel.verbose then
            print "----------------------------------------------------------------"
            print "---   TearDown " ; tName ; " test."
            print "----------------------------------------------------------------"
        end if
    end sub
    return instance
end function
function rooibos_Logger(config)
    instance = rooibos___Logger_builder()
    instance.new(config)
    return instance
end function