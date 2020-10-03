'import ""pkg:/source/roku_modules/rooibos/BaseTestSuite.bs""
'import ""pkg:/source/roku_modules/rooibos/CommonUtils.bs""
function rooibos___ItGroup_builder()
    instance = {}
    instance.new = function(groupData)
        for each field in groupData
            m[field] = groupData[field]
        end for
    end function
    instance.getTestCases = function() as object
        if (m.hasSoloTests = true) then
            return m.soloTestCases
        else
            return m.testCases
        end if
    end function
    instance.getRunnableTestSuite = function() as object
        testCases = Rooibos.ItGroup.getTestCases(group)
        runnableSuite = rooibos_BaseTestSuite()
        runnableSuite.name = group.name
        runnableSuite.isLegacy = group.isLegacy = true
        if group.testCaseLookup = invalid then
            group.testCaseLookup = {}
        end if
        for each testCase in testCases
            name = testCase.name
            if (testCase.isSolo = true) then
                name = name + " [SOLO] "
            end if
            testFunction = rooibos_Common_getFunction(m.filename, testCase.funcName)
            runnableSuite.addTest(name, testFunction, testCase.funcName)
            m.testCaseLookup[name] = testCase
        end for
        runnableSuite.SetUp = rooibos_Common_getFunction(m.filename, m.setupFunctionName)
        runnableSuite.TearDown = rooibos_Common_getFunction(m.filename, m.teardownFunctionName)
        runnableSuite.BeforeEach = rooibos_Common_getFunction(m.filename, m.beforeEachFunctionName)
        runnableSuite.AfterEach = rooibos_Common_getFunction(m.filename, m.afterEachFunctionName)
        return runnableSuite
    end function
    return instance
end function
function rooibos_ItGroup(groupData)
    instance = rooibos___ItGroup_builder()
    instance.new(groupData)
    return instance
end function