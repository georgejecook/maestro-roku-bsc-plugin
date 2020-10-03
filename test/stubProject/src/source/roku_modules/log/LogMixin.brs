' /**
'  * @module LogMixin
'  * @description Mixin method for mLog - this is the main entry point for integrating with the mLog framework
'  */

' /**
'  * @member initializeLog
'  * @memberof module:LogMixin
'  * @instance
'  * @description creates mLog, and places it on global
'  *              expects to have access to globalNode on m.global (i.e. from within an SG control)
'  *              to disable logging, simply never call initializeLog - and your app will
'  *              not incur any logging costs beyond the initial method invocation
'  * @param {boolean} isForcedOff - if true, mLog will noop all log invocations
'  * @param {boolean} isLightForcedOn - if true, mLog will for light mode on for all loggers
'  * @param {boolean} isLightForcedOff - if true, mLog will for light mode off for all loggers
'  * @param {boolean} isPrintingName - if true, mLog will for print out the name. For best results - use burp-brightscript, and leave this as false
'  * @returns {RLog} RLog instance for further configuration
'  */
function log_initializeLog(isForcedOff = false, isLightForcedOn = false, isLightForcedOff = false, isPrintingName = false) as object
    mLog = CreateObject("roSGNode", "log_Log")
    m.global.addFields({
        "mLog": mLog
    })
    mLog.isLightForcedOff = isLightForcedOff
    mLog.isLightForcedOn = isLightForcedOn
    mLog.isForcedOff = isForcedOff
    mLog.isPrintingName = isPrintingName
    return mLog
end function

' /**
'  * @member registerLogger
'  * @memberof module:LogMixin
'  * @instance
'  * @description registers this object (module/SGNode - whatever m is) as a logger
'  *              using the light logger, which will only print
'  *              use this for performance sensitive situation
'  *              note - filtering of levels is not yet supported
'  * @param {string} name of the logger
'  * @param {boolean} isLight - if true, then a cheap print logger is used for performance reasons
'  * @returns {object} target object which had log applied to it
'  *                   (target, or m if target was invalid and using a light logger)
'  */
function log_registerLogger(name = "general", isLight = false, target = invalid) as object
    if target = invalid then
        target = m
        isSettingOnModule = false
    else
        isSettingOnModule = true
    end if
    target.rLog_name = " " + name + " "
    target.rLog_levelTexts = [
        "[ERROR]",
        "[WARN]",
        "[INFO]",
        "[VERBOSE]",
        "[DEBUG]"
    ]
    target.rLog_isLight = isLight
    target.rLog_instance = m.global.mLog
    target.isPrintingName = target.rLog_instance.isPrintingName
    target.logImpl = logImpl
    if isSettingOnModule = true then
        target.logDebug = logDebug
        target.logVerbose = logVerbose
        target.logInfo = logInfo
        target.logMethod = logMethod
        target.logWarn = logWarn
        target.logError = logError
    end if
    return target
end function

function log_logDebug(message, value = "#RLN#", value2 = "#RLN#", value3 = "#RLN#", value4 = "#RLN#", value5 = "#RLN#", value6 = "#RLN#", value7 = "#RLN#", value8 = "#RLN#", value9 = "#RLN#") as void
    if m.rLog_instance = invalid or m.rLog_instance.isForcedOff = true then
        return
    end if
    m.logImpl(4, message, value, value2, value3, value4, value5, value6, value7, value8, value9)
end function

function log_logVerbose(message, value = "#RLN#", value2 = "#RLN#", value3 = "#RLN#", value4 = "#RLN#", value5 = "#RLN#", value6 = "#RLN#", value7 = "#RLN#", value8 = "#RLN#", value9 = "#RLN#") as void
    if m.rLog_instance = invalid or m.rLog_instance.isForcedOff = true then
        return
    end if
    m.logImpl(3, message, value, value2, value3, value4, value5, value6, value7, value8, value9)
end function

function log_logInfo(message, value = "#RLN#", value2 = "#RLN#", value3 = "#RLN#", value4 = "#RLN#", value5 = "#RLN#", value6 = "#RLN#", value7 = "#RLN#", value8 = "#RLN#", value9 = "#RLN#") as void
    if m.rLog_instance = invalid or m.rLog_instance.isForcedOff = true then
        return
    end if
    m.logImpl(2, message, value, value2, value3, value4, value5, value6, value7, value8, value9)
end function

function log_logWarn(message, value = "#RLN#", value2 = "#RLN#", value3 = "#RLN#", value4 = "#RLN#", value5 = "#RLN#", value6 = "#RLN#", value7 = "#RLN#", value8 = "#RLN#", value9 = "#RLN#") as void
    if m.rLog_instance = invalid or m.rLog_instance.isForcedOff = true then
        return
    end if
    m.logImpl(1, message, value, value2, value3, value4, value5, value6, value7, value8, value9)
end function

function log_logError(message, value = "#RLN#", value2 = "#RLN#", value3 = "#RLN#", value4 = "#RLN#", value5 = "#RLN#", value6 = "#RLN#", value7 = "#RLN#", value8 = "#RLN#", value9 = "#RLN#") as void
    if m.rLog_instance = invalid or m.rLog_instance.isForcedOff = true then
        return
    end if
    m.logImpl(0, message, value, value2, value3, value4, value5, value6, value7, value8, value9)
end function

function log_logMethod(methodName, value = "#RLN#", value2 = "#RLN#", value3 = "#RLN#", value4 = "#RLN#", value5 = "#RLN#", value6 = "#RLN#", value7 = "#RLN#", value8 = "#RLN#", value9 = "#RLN#") as void
    if m.rLog_instance = invalid or m.rLog_instance.isForcedOff = true then
        return
    end if
    m.logImpl(2, methodName, value, value2, value3, value4, value5, value6, value7, value8, value9, true)
end function

function log_logImpl(level, message, value = "#RLN#", value2 = "#RLN#", value3 = "#RLN#", value4 = "#RLN#", value5 = "#RLN#", value6 = "#RLN#", value7 = "#RLN#", value8 = "#RLN#", value9 = "#RLN#", isMethod = false) as void
    if m.rLog_instance = invalid or m.rLog_instance.isForcedOff = true then
        return
    end if
    if m.isPrintingName = true then
        if m.rLog_name <> invalid then
            name = m.rLog_name
        else
            name = " General "
        end if
    else
        name = ""
    end if
    if m.rLog_instance.isLightForcedOn = true then
        isLight = true
    else if m.rLog_instance.isLightForcedOff = true then
        isLight = false
    else
        isLight = m.rLog_isLight
    end if
    if isLight = true then
        if isMethod = true then
            print "*[METHOD]" ; name ; message ; " " ; log_rLog_ToString(value) ; " " ; log_rLog_ToString(value2) ; " " ; log_rLog_ToString(value3) ; " " ; log_rLog_ToString(value4)
            print " " ; log_rLog_ToString(value5) ; " " ; log_rLog_ToString(value6) ; " " ; log_rLog_ToString(value7) ; " " ; log_rLog_ToString(value8) ; " " ; log_rLog_ToString(value9)
        else
            print "*" ; m.rLog_levelTexts[level] ; name ; message ; " " ; log_rLog_ToString(value) ; " " ; log_rLog_ToString(value2) ; " " ; log_rLog_ToString(value3) ; " " ; log_rLog_ToString(value4)
            print " " ; log_rLog_ToString(value5) ; " " ; log_rLog_ToString(value6) ; " " ; log_rLog_ToString(value7) ; " " ; log_rLog_ToString(value8) ; " " ; log_rLog_ToString(value9)
        end if
        return
    else
        if isMethod = true then
            text = "[METHOD]" + name + log_rLog_ToString(message) + " " + log_rLog_ToString(value) + " " + log_rLog_ToString(value2) + " " + log_rLog_ToString(value3) + " " + log_rLog_ToString(value4) + " " + log_rLog_ToString(value5) + " " + log_rLog_ToString(value6) + " " + log_rLog_ToString(value7) + " " + log_rLog_ToString(value8) + " " + log_rLog_ToString(value9)
        else
            text = m.rLog_levelTexts[level] + name + log_rLog_ToString(message) + " " + log_rLog_ToString(value) + " " + log_rLog_ToString(value2) + " " + log_rLog_ToString(value3) + " " + log_rLog_ToString(value4) + " " + log_rLog_ToString(value5) + " " + log_rLog_ToString(value6) + " " + log_rLog_ToString(value7) + " " + log_rLog_ToString(value8) + " " + log_rLog_ToString(value9)
        end if
        logEntry = {
            "name": name,
            "level": level,
            "text": text
        }
        m.rLog_instance.callFunc("logItem", logEntry) ' m.rLog_instance.logEntry = arglogEntry
    end if
end function

function log_rLog_ToString(value as dynamic) as string
    valueType = type(value)
    if valueType = "<uninitialized>" then
        return "UNINIT"
    else if value = invalid then
        return "INVALID"
    else if GetInterface(value, "ifString") <> invalid then
        if value = "#RLN#" then
            return ""
        else
            return value
        end if
    else if valueType = "roInt" or valueType = "roInteger" or valueType = "Integer" then
        return value.tostr()
    else if GetInterface(value, "ifFloat") <> invalid then
        return Str(value).Trim()
    else if valueType = "roSGNode" then
        return "Node(" + value.subType() + ")"
    else if valueType = "roAssociativeArray" then
        return "AA(" + formatJson(value) + ")"
    else if valueType = "roBoolean" or valueType = "Boolean" then
        return value.tostr()
    else
        return ""
    end if
end function