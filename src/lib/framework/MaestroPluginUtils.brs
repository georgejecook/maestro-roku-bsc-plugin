function mc_private_taskExec(instance as dynamic)
    instance.delete("top")
    instance.delete("global")
    top = m.top
    m.append(instance)
    m.__isVMCreated = true
    m.new()
    m.top = top
    args = m.top.args
    maxTaskRetries = 1
    if args <> invalid and args.maxTaskRetries <> invalid
        maxTaskRetries = args.maxTaskRetries
    end if
    lastResult = { isOk: false }
    attempt = 0
    while attempt < maxTaskRetries
        try
            if m._execute <> invalid
                result = m._execute(args)
            else
                result = m.execute(args)
            end if
            if type(result) = "<uninitialized>"
                result = { isOk: false, message: "no result returned" }
            else if result = invalid or getInterface(result, "ifAssociativeArray") = invalid or result.isOk = invalid
                result = { isOk: true, data: result }
            end if
            if result.isOk = true
                return result
            else
                lastResult = result
            end if
        catch error
            m.log.error("error occurred executing task", m.top.subType(), m.top.id, error)
            if error <> invalid
                errorMessage = errorMessage.message
            else
                errorMessage = ""
            end if
            lastResult = { isOk: false, data: error, message: errorMessage }
        end try
        attempt++
    end while

    return lastResult
end function
