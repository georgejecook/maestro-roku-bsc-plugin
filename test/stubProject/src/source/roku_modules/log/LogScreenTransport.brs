'@Namespace rLogST rLogScreenTransport  
function log___LogScreenTransport_builder()
    instance = {}
    instance.new = function(mLog)
        m.screenLogger = createObject("roSGNode", "log_LogScreenTransport")
        mLog._screenLogger = screenLogger
    end function
    instance.log = function(args)
        m.screenLogger.logLine = args.text
    end function
    return instance
end function
function log_LogScreenTransport(mLog)
    instance = log___LogScreenTransport_builder()
    instance.new(mLog)
    return instance
end function