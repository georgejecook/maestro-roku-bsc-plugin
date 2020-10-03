function rooibos___UnitTestResult_builder()
    instance = {}
    instance.new = sub()
        m.messages = []
        m.isFail = false
        m.currentAssertIndex = 0
        m.failedAssertIndex = 0
        m.failedMockLineNumber = - 1
    end sub
    instance.reset = function() as void
        m.isFail = false
        m.failedMockLineNumber = - 1
        m.messages = []
    end function
    instance.addResult = function(message as string) as string
        if (message <> "") then
            m.messages.push(message)
            if (not m.isFail) then
                m.failedAssertIndex = m.currentAssertIndex
            end if
            m.isFail = true
        end if
        m.currentAssertIndex++
        return message
    end function
    instance.addMockResult = function(lineNumber, message as string) as string
        if (message <> "") then
            m.messages.push(message)
            if (not m.isFail) then
                m.failedMockLineNumber = lineNumber
            end if
            m.isFail = true
        end if
        return message
    end function
    instance.getResult = function() as string
        if (m.isFail) then
            msg = m.messages.peek()
            if (msg <> invalid) then
                return msg
            else
                return "unknown test failure"
            end if
        else
            return ""
        end if
    end function
    return instance
end function
function rooibos_UnitTestResult()
    instance = rooibos___UnitTestResult_builder()
    instance.new()
    return instance
end function