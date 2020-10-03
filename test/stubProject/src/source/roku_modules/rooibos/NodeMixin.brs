' /**
'  * @memberof module:TestRunner
'  * @name Rooibos_RunNodeTests
'  * @function
'  * @instance
'  * @description interface hook for exeucting tests on nodes. This method is for internal use only. Only the Rooibos framework should invoke this method
'  * @param {Dynamic} args - associated array, containing all the information required to execute the tests.
'  * @returns {Object} test stats object, for merging into main test stats
'  */
function rooibos_RunNodeTests(args) as object
    print " RUNNING NODE TESTS"
    totalStatObj = rooibos_Stats_CreateTotalStatistic()
    TestRunnerMixin.RunItGroups(args.metaTestSuite, totalStatObj, args.testUtilsDecoratorMethodName, args.config, args.runtimeConfig, m)
    return totalStatObj
end function

' /**
'  * @memberof module:TestRunner
'  * @name CreateTestNode
'  * @function
'  * @instance
'  * @description interface hook for correctly creating nodes that get tested. This ensures they are in the correct scope.
'  * This method must be defined in your tests scene xml.
'  * @param {String} nodeType - name of node to create. The framework will pass this in as required
'  * @returns {Object} the required node, or invalid if it could not be invoked.
'  */
function rooibos_CreateTestNode(nodeType) as object
    node = createObject("roSGNode", nodeType)
    if (type(node) = "roSGNode" and node.subType() = nodeType) then
        m.top.AppendChild(node)
        return node
    else
        print " Error creating test node of type " ; nodeType
        return invalid
    end if
end function