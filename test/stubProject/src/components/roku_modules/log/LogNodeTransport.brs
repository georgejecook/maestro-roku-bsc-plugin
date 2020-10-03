' /**
'  * @module rLogSGNodeTransport
'  * @description implementation of mLog node transport used for sending logs to RALE inspectable nodes
'  */
function Init() as void
    'IMPLEMENT ME!
    m.top.logOutput = []
    m.top._rawItems = []
end function

function log_updateLogOutput(args) as void
    item = m.top.modifiedProgressItem
    progressById = m.top.progressById
    items = m.top._rawItems
    index = items.count() - 1
    loggedTexts = []
    level = m.top.rlog.logLevel
    filter = m.top.mLog.filters
    excludefilter = m.top.mLog.excludeFilters
    logText = ""
    jsonTexts = []
    while index >= 0
        item = items[index]
        passesFilter = level >= item.level and log_matchesFilter(filter, item) and not log_isExcluded(excludeFilter, item)
        if (passesFilter) then
            loggedTexts.push(item.text)
            jsonTexts.push(item.text)
            logText += chr(10) + "\n" + item.text
        end if
        index--
    end while
    m.top._logText = logText
    m.top._logOutput = loggedTexts
    m.top._jsonOutput = formatJson(jsonTexts)
end function

function log_matchesFilter(filters, item) as boolean
    if filters.count() = 0 then
        return true
    else
        for each filter in filters
            if type(box(filter)) = "roString" and filter = item.name then
                return true
            end if
        end for
    end if
    return false
end function

function log_isExcluded(excludeFilters, item) as boolean
    if excludeFilters.count() = 0 then
        return false
    else
        for each filter in excludeFilters
            if type(box(filter)) = "roString" and filter = item.name then
                return true
            end if
        end for
    end if
    return false
end function