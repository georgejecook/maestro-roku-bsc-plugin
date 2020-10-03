function rooibos___UnitTestRuntimeConfig_builder()
    instance = {}
    instance.new = function()
        m.hasSoloSuites = false
        m.hasSoloGroups = false
        m.hasSoloTests = false
        m.suites = m.CreateSuites()
    end function
    instance.createSuites = function()
        'bs:disable-next-line
        suites = RBSFM_getTestSuitesForProject()
        includedSuites = []
        for i = 0 to suites.count() - 1
            suite = suites[i]
            if (suite.valid) then
                if (suite.isSolo) then
                    m.hasSoloSuites = true
                end if
                if (suite.hasSoloTests = true) then
                    m.hasSoloTests = true
                end if
                if (suite.hasSoloGroups = true) then
                    m.hasSoloGroups = true
                end if
                '          ? "valid - suite"
                includedSuites.push(suite)
            else
                print "ERROR! suite was not valid - ignoring"
            end if
        end for
        return includedSuites
    end function
    return instance
end function
function rooibos_UnitTestRuntimeConfig()
    instance = rooibos___UnitTestRuntimeConfig_builder()
    instance.new()
    return instance
end function