!macro customCheckAppRunning
  DetailPrint "Closing running TypeUp processes before install..."
  ExecWait 'taskkill /IM "TypeUp.exe" /T /F' $0
  ExecWait 'taskkill /IM "TypeUpAgent.exe" /T /F' $0
!macroend

!macro customInstall
  ${if} ${FileExists} "$INSTDIR\uninstallerIcon.ico"
    ${if} ${FileExists} "$newStartMenuLink"
      CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\uninstallerIcon.ico" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    ${endIf}

    ${if} ${FileExists} "$newDesktopLink"
      CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\uninstallerIcon.ico" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${endIf}

    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${endIf}
!macroend
