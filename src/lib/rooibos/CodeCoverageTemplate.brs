

'+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
'++ rooibos code coverage util functions DO NOT MODIFY
'+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

function RBS_CC_#ID#_reportLine(lineNumber, reportType = 1)
  if m.global = invalid
    '? "global is not available in this scope!! it is not possible to record coverage: #FILE_PATH#(lineNumber)"
    return true
  else
    if m._rbs_ccn = invalid
     '? "Coverage maps are not created - creating now"
      if m.global._rbs_ccn = invalid
        '? "Coverage maps are not created - creating now"
          m.global.addFields({
            "_rbs_ccn": createObject("roSGnode", "CodeCoverage")
          })
      end if
      m._rbs_ccn = m.global._rbs_ccn
     end if
  end if

  m._rbs_ccn.entry = {"f":"#ID#", "l":stri(lineNumber), "r":reportType}
  return true
end function
