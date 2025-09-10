Set sh = CreateObject("WScript.Shell")
sh.Run "powershell -WindowStyle Hidden -Command Start-Process 'dist\win-unpacked\Quide.exe'", 0, False