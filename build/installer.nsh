!macro customCheckAppRunning
  DetailPrint "Closing running TypeUp processes before install..."
  ExecWait 'taskkill /IM "TypeUp.exe" /T /F' $0
  ExecWait 'taskkill /IM "TypeUpAgent.exe" /T /F' $0
!macroend
