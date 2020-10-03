function log___LogPrintTransport_builder()
    instance = {}
    instance.new = function(mLog)
        m.managesFiltering = false
    end function
    instance.rLogPT_log = function(args)
        print args.text
    end function
    return instance
end function
function log_LogPrintTransport(mLog)
    instance = log___LogPrintTransport_builder()
    instance.new(mLog)
    return instance
end function