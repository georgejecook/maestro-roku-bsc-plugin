function rooibos___UnitTestCase_builder()
    instance = {}
    'Map with which the testsuite processor can take the index of a an assert line, and map it to the line Number
    instance.new = function(name as string, func as dynamic, funcName as string, isSolo as boolean, isIgnored as boolean, lineNumber as integer, params = invalid, paramTestIndex = 0, paramLineNumber = 0)
        m.isSolo = invalid
        m.func = invalid
        m.funcName = invalid
        m.isIgnored = invalid
        m.name = invalid
        m.lineNumber = invalid
        m.paramLineNumber = invalid
        m.assertIndex = 0
        m.assertLineNumberMap = {}
        m.getTestLineIndex = 0
        m.rawParams = invalid
        m.paramTestIndex = invalid
        m.isParamTest = false
        m.time = 0
        m.isSolo = isSolo
        m.func = func
        m.funcName = funcName
        m.isIgnored = isIgnored
        m.name = name
        m.lineNumber = lineNumber
        m.paramLineNumber = paramLineNumber
        m.rawParams = params
        m.paramTestIndex = paramTestIndex
        if (params <> invalid) then
            m.name = m.name + stri(m.paramTestIndex)
        end if
        return this
    end function
    return instance
end function
function rooibos_UnitTestCase(name as string, func as dynamic, funcName as string, isSolo as boolean, isIgnored as boolean, lineNumber as integer, params = invalid, paramTestIndex = 0, paramLineNumber = 0)
    instance = rooibos___UnitTestCase_builder()
    instance.new(name, func, funcName, isSolo, isIgnored, lineNumber, params, paramTestIndex, paramLineNumber)
    return instance
end function