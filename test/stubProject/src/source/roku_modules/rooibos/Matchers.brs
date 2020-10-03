function rooibos_Matcher_anyString(value)
    return rooibos_Common_isString(value)
end function

function rooibos_Matcher_anyBool(value)
    return rooibos_Common_isBoolean(value)
end function

function rooibos_Matcher_anyNumber(value)
    return rooibos_Common_isNumber(value)
end function

function rooibos_Matcher_anyAA(value)
    return rooibos_Common_isAssociativeArray(value)
end function

function rooibos_Matcher_anyArray(value)
    return rooibos_Common_isArray(value)
end function

function rooibos_Matcher_anyNode(value)
    return rooibos_Common_isSGNode(value)
end function