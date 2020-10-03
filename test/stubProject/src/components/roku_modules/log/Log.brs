'import "pkg:/source/roku_modules/log/LogPrintTransport.bs"
'import "pkg:/source/roku_modules/log/LogNodeTransport.bs"
'import "pkg:/source/roku_modules/log/LogScreenTransport.bs"

'@Only
' /**
'  * @module mLog
'  * @description implementation of mLog node
'  */
function Init() as void
    m.transportImpls = []
    m.top.filters = []
    m.top.excludeFilters = []
    m.pendingItems = []
    m.top.transports = [
        "printTransport"
    ]
end function

function log_onLogEntryChange() as void
    if m.top.logEntry <> invalid then
        log_addItemToPending(m.top.logEntry)
    end if
end function

function log_addItemToPending(item) as void
    m.pendingItems.push(item)
    if m.pendingItems.count() > 20 then
        for i = 0 to m.pendingItems.count() - 1
            log_logItem(m.pendingItems[i])
        end for
        m.pendingItems = []
    end if
end function

function log_logItem(args) as void
    passesFilter = m.top.logLevel >= args.level and log_matchesFilter(args) and not log_isExcluded(args)
    passesFilter = true
    for each transport in m.transportImpls
        if not transport.managesFiltering or passesFilter then
            transport.log(args)
        end if
    end for
end function

function log_matchesFilter(args) as boolean
    if m.top.filters.count() = 0 then
        return true
    else
        for each filter in m.top.filters
            if type(box(filter)) = "roString" and filter = args.name then
                return true
            end if
        end for
    end if
    return false
end function

function log_isExcluded(args) as boolean
    if m.top.excludeFilters.count() = 0 then
        return false
    else
        for each filter in m.top.excludeFilters
            if type(box(filter)) = "roString" and filter = args.name then
                return true
            end if
        end for
    end if
    return false
end function

function log_onTransportsChange(event)
    print "[METHOD] onTransportsChange"
    m.transportImpls = []
    for each transportType in m.top.transports
        transport = log_getTransport(transportType)
        if transport <> invalid then
            m.transportImpls.push(transport)
        else
            print "found illegal transportType " ; transportType
        end if
    end for
end function

function log_getTransport(transportType)
    if transportType = "print" then
        return log_LogPrintTransport(m.top)
    else if transportType = "node" then
        return log_LogNodeTransport(m.top)
    else if transportType = "screen" then
        return log_LogScreenTransport(m.top)
    end if
end function