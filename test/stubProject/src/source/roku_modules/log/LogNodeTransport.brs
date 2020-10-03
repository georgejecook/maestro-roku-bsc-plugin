function log___LogNodeTransport_builder()
    instance = {}
    instance.new = function(mLog)
        m.managesFiltering = true
        m.nodeLogger = createObject("roSGNode", "log_LogNodeTransport")
        m.nodeLogger.mLog = mLog
    end function
    instance.log = function(args)
        items = m.nodeLogger._rawItems
        if items.count() > m.nodeLogger.maxItems then
            items.delete(0)
        end if
        item = {
            "level": args.level,
            "text": text,
            "name": args.name
        }
        items.push(item)
        m.nodeLogger._rawItems = items
    end function
    return instance
end function
function log_LogNodeTransport(mLog)
    instance = log___LogNodeTransport_builder()
    instance.new(mLog)
    return instance
end function