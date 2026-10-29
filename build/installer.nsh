; Close a leftover Amplite audio engine so the update can replace it.
!macro customInit
  nsExec::Exec 'taskkill /F /IM librespot.exe'
!macroend
